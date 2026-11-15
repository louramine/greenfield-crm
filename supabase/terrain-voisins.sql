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
-- Security definer pour profiter de l'index spatial (les règles d'accès ligne par ligne l'empêchent) :
-- l'accès est vérifié au début, comme pour les terrains et les contours (tout membre actif de l'équipe voit tout).
create or replace function public.terrain_voisins(p_id integer, p_metres numeric default 8)
returns table (terrain_id integer, distance_m numeric, meme_titre boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with acces as (
    select public.mon_role() is not null as ok
  ), moi as (
    select array_append(public.tf_cles(t.tf), t.ref) as cles
      from public.terrains t, acces
     where t.id = p_id and acces.ok
  ), mes_contours as materialized (
    select c.cle, c.geo
      from public.terrain_contours c, moi
     where c.cle = any(moi.cles) and c.geo is not null
  ), zone as materialized (
    select extensions.st_union(geo) as geo, extensions.st_union(geo)::extensions.geography as geog from mes_contours
  ), proches as materialized (
    select c.cle, extensions.st_distance(c.geo::extensions.geography, zone.geog) as d
      from public.terrain_contours c, zone
     where zone.geo is not null
       and c.geo operator(extensions.&&) extensions.st_expand(zone.geo, 0.0003)
       and extensions.st_dwithin(c.geo::extensions.geography, zone.geog, p_metres::float8)
  ), candidats as (
    select t.id, array_append(public.tf_cles(t.tf), t.ref) as cles
      from public.terrains t
     where t.id <> p_id
       and array_append(public.tf_cles(t.tf), t.ref) operator(pg_catalog.&&) (select array_agg(cle) from proches)
  )
  select a.id,
         round(min(p.d)::numeric, 1),
         bool_or(p.cle in (select cle from mes_contours))
    from candidats a
    join proches p on p.cle = any(a.cles)
   where not exists (
     select 1 from public.terrain_liens l
      where l.terrain_a = least(a.id, p_id) and l.terrain_b = greatest(a.id, p_id))
   group by a.id
   order by 2, 1
$$;

create index if not exists terrains_cles_gin on public.terrains using gin ((array_append(public.tf_cles(tf), ref)));

grant execute on function public.terrain_voisins(integer, numeric) to authenticated;
revoke execute on function public.terrain_voisins(integer, numeric) from anon, public;
