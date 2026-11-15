-- Suggestions de terrains contigus : terrains du CRM dont les contours (CADGIS ou MyMaps) se touchent.
-- Utilisé par la section Terrains liés de la fiche terrain (terrain-liens.js).
-- Relançable.

create extension if not exists postgis with schema extensions;

-- Contour jsonb (liste d'anneaux [lat, lng]) vers une géométrie WGS84
create or replace function public.contour_geo(g jsonb)
returns extensions.geometry
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.st_makevalid(extensions.st_collect(
           extensions.st_makepolygon(case when extensions.st_isclosed(l) then l else extensions.st_addpoint(l, extensions.st_startpoint(l)) end)))
    from (
      select extensions.st_makeline(array(
               select extensions.st_makepoint((p->>1)::float8, (p->>0)::float8)
                 from jsonb_array_elements(r) with ordinality as e(p, i)
                order by i)) as l
        from jsonb_array_elements(g) as a(r)
       where jsonb_typeof(r) = 'array' and jsonb_array_length(r) >= 3
    ) s
$$;

alter table public.terrain_contours
  add column if not exists geo extensions.geometry generated always as (public.contour_geo(geom)) stored;
create index if not exists terrain_contours_geo on public.terrain_contours using gist (geo);

-- Terrains voisins d'un terrain : contours à moins de p_metres mètres, hors terrains déjà liés.
-- Les règles d'accès des terrains et des contours s'appliquent (security invoker).
create or replace function public.terrain_voisins(p_id integer, p_metres numeric default 8)
returns table (terrain_id integer, distance_m numeric, meme_titre boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with moi as (
    select t.id, array_append(public.tf_cles(t.tf), t.ref) as cles
      from public.terrains t
     where t.id = p_id
  ), mes_contours as (
    select c.cle, c.geo
      from public.terrain_contours c, moi
     where c.cle = any(moi.cles) and c.geo is not null
  ), zone as (
    select extensions.st_union(geo) as geo from mes_contours
  ), proches as (
    select c.cle, c.geo
      from public.terrain_contours c, zone
     where zone.geo is not null
       and c.geo operator(extensions.&&) extensions.st_expand(zone.geo, 0.0003)
       and extensions.st_dwithin(c.geo::extensions.geography, zone.geo::extensions.geography, p_metres::float8)
  ), autres as (
    select t.id, array_append(public.tf_cles(t.tf), t.ref) as cles
      from public.terrains t
     where t.id <> p_id
  )
  select a.id,
         round(min(extensions.st_distance(p.geo::extensions.geography, z.geo::extensions.geography))::numeric, 1),
         bool_or(p.cle in (select cle from mes_contours))
    from autres a
    join proches p on p.cle = any(a.cles)
    cross join zone z
   where not exists (
     select 1 from public.terrain_liens l
      where l.terrain_a = least(a.id, p_id) and l.terrain_b = greatest(a.id, p_id))
   group by a.id
   order by 2, 1
$$;

grant execute on function public.terrain_voisins(integer, numeric) to authenticated;
revoke execute on function public.terrain_voisins(integer, numeric) from anon, public;
