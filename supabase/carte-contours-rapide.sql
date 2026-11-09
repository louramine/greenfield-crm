-- A executer dans Supabase > SQL Editor (tout le script). Relancable.
-- Corrige la lenteur de la carte apres mymaps-contours-09-11-2026.sql : les contours par TF sont calcules une seule fois.
-- Ne modifie aucune donnee, remplace seulement deux fonctions.

create or replace function public.carte_contours()
returns table (terrain_id bigint, cle text, surface_plan numeric, geom jsonb, geom_approx jsonb,
               lat double precision, lng double precision, lat_approx double precision, lng_approx double precision)
language sql stable security invoker set search_path = public as $$
  -- les contours par TF sont calculés une seule fois, puis complétés par les contours par référence
  with par_tf as materialized (
    select t.id as terrain_id, c.cle, c.surface_plan, c.geom, c.geom_approx, c.lat, c.lng, c.lat_approx, c.lng_approx
    from public.terrains t
    cross join lateral unnest(public.tf_cles(t.tf)) as k(cle)
    join public.terrain_contours c on c.cle = k.cle
  )
  select * from par_tf
  union all
  select t.id, c.cle, c.surface_plan, c.geom, c.geom_approx, c.lat, c.lng, c.lat_approx, c.lng_approx
  from public.terrains t
  join public.terrain_contours c on c.cle = t.ref
  where t.id not in (select p.terrain_id from par_tf p)
$$;
grant execute on function public.carte_contours() to authenticated;

create or replace function public.carte_publique(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.carte_liens;
  res jsonb;
begin
  select * into l from public.carte_liens where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if l.revoque then return jsonb_build_object('ok', false, 'raison', 'revoque'); end if;
  if l.expire_le < now() then return jsonb_build_object('ok', false, 'raison', 'expire'); end if;

  update public.carte_liens
     set vues = vues + 1, premiere_vue = coalesce(premiere_vue, now()), derniere_vue = now()
   where id = l.id;

  with base as (
    select t.id, t.ref, coalesce(nullif(t.quartier, ''), t.localisation) as quartier, t.urba,
           public.carte_num(t.superficie::text) as s, public.carte_num(t.prix::text) as pm,
           coalesce(public.carte_num(t.forfait::text), public.carte_num(t.prix::text) * public.carte_num(t.superficie::text)) as pf,
           -- contour du TF, sinon contour enregistré sous la référence du terrain
           case when exists (select 1 from unnest(public.tf_cles(t.tf)) as k0(cle) join public.terrain_contours c0 on c0.cle = k0.cle)
                then public.tf_cles(t.tf) else array[t.ref] end as cles,
           public.gm_coords(t.google_map) as gm
      from public.terrains t
     where (l.terrain_ids is null and coalesce(t.statut, '') = 'Disponible')
        or (l.terrain_ids is not null and t.id = any(l.terrain_ids) and coalesce(t.statut, '') <> 'Vendu')
  ), geo as (
    select b.*,
           (select jsonb_agg(r) from public.terrain_contours c, jsonb_array_elements(c.geom) r where c.cle = any(b.cles)) as g,
           (select jsonb_agg(r) from public.terrain_contours c, jsonb_array_elements(c.geom_approx) r where c.cle = any(b.cles)) as ga,
           (select avg(c.lat) from public.terrain_contours c where c.cle = any(b.cles)) as clat,
           (select avg(c.lng) from public.terrain_contours c where c.cle = any(b.cles)) as clng,
           (select avg(c.lat_approx) from public.terrain_contours c where c.cle = any(b.cles)) as alat,
           (select avg(c.lng_approx) from public.terrain_contours c where c.cle = any(b.cles)) as alng
      from base b
  ), pos as (
    select g.*,
           -- décalage stable de 150 à 400 m pour les terrains sans contour, en version découverte
           ((abs(hashtext(coalesce(g.ref, g.id::text))) % 1000) / 1000.0 - 0.5) * 0.007 as dlat,
           ((abs(hashtext(coalesce(g.ref, g.id::text) || 'x')) % 1000) / 1000.0 - 0.5) * 0.008 as dlng
      from geo g
     where g.g is not null or g.gm is not null
  )
  select coalesce(jsonb_agg(
    case when l.version = 'qualifie' then jsonb_strip_nulls(jsonb_build_object(
      'id', p.ref, 'q', p.quartier, 'z', p.urba, 's', p.s, 'pm', p.pm, 'pf', p.pf,
      'g', p.g, 'lat', coalesce(p.clat, p.gm[1]), 'lng', coalesce(p.clng, p.gm[2]), 'pt', p.g is null))
    else jsonb_strip_nulls(jsonb_build_object(
      'id', p.ref, 'q', p.quartier, 'z', p.urba, 's', public.carte_arrondi_surface(p.s),
      'pmlo', case when p.pm > 0 then floor(p.pm * 0.9 / (case when p.pm < 2000 then 100 when p.pm < 5000 then 250 else 1000 end)) * (case when p.pm < 2000 then 100 when p.pm < 5000 then 250 else 1000 end) end,
      'pmhi', case when p.pm > 0 then ceil(p.pm * 1.1 / (case when p.pm < 2000 then 100 when p.pm < 5000 then 250 else 1000 end)) * (case when p.pm < 2000 then 100 when p.pm < 5000 then 250 else 1000 end) end,
      'pflo', case when p.pf > 0 then floor(p.pf / 1e6 * 0.9 / (case when p.pf < 2e7 then 1 when p.pf < 1e8 then 5 else 10 end)) * (case when p.pf < 2e7 then 1 when p.pf < 1e8 then 5 else 10 end) end,
      'pfhi', case when p.pf > 0 then ceil(p.pf / 1e6 * 1.1 / (case when p.pf < 2e7 then 1 when p.pf < 1e8 then 5 else 10 end)) * (case when p.pf < 2e7 then 1 when p.pf < 1e8 then 5 else 10 end) end,
      'g', p.ga,
      'lat', round(coalesce(p.alat, p.gm[1] + p.dlat)::numeric, 4), 'lng', round(coalesce(p.alng, p.gm[2] + p.dlng)::numeric, 4),
      'pt', p.ga is null))
    end), '[]'::jsonb)
  into res
  from pos p;

  return jsonb_build_object('ok', true, 'version', l.version,
                            'prospect', coalesce(l.prospect, (select a.nom from public.acheteurs a where a.id = l.acheteur_id)),
                            'contact', l.cree_par,
                            'expire_le', l.expire_le, 'terrains', res);
end;
$$;
revoke all on function public.carte_publique(text) from public;
grant execute on function public.carte_publique(text) to anon, authenticated;

notify pgrst, 'reload schema';

select count(distinct terrain_id) as terrains_avec_contour, count(*) as contours from public.carte_contours();
