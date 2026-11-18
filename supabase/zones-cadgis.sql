-- A executer dans Supabase > SQL Editor (tout le script). Relancable.
-- Zones CADGIS (18/11/2026) : chaque contour garde la zone du fichier CADGIS dont il vient
-- (Anfa, Maarif, Ain Chock, Ain Sebaa, Ben M'sik et Mediouna, Mohammedia, Benslimane, Had Soualem et Berrechid,
-- Dar Bouazza, Nouaceur, Hay Hassani) ou, hors des fichiers, sa ville (Marrakech, Tanger, Rabat et Salé, Autres villes).
-- Le filtre Zones de la carte du CRM s'appuie sur cette colonne. Les valeurs sont remplies par un script de données à part.

alter table public.terrain_contours add column if not exists zone text;

-- La fonction renvoie une colonne de plus : il faut la supprimer avant de la recréer
drop function if exists public.carte_contours();

create function public.carte_contours()
returns table (terrain_id bigint, cle text, surface_plan numeric, geom jsonb, geom_approx jsonb,
               lat double precision, lng double precision, lat_approx double precision, lng_approx double precision, zone text)
language sql stable security invoker set search_path = public as $$
  -- les contours par TF sont calculés une seule fois, puis complétés par les contours par référence
  with par_tf as materialized (
    select t.id as terrain_id, c.cle, c.surface_plan, c.geom, c.geom_approx, c.lat, c.lng, c.lat_approx, c.lng_approx, c.zone
    from public.terrains t
    cross join lateral unnest(public.tf_cles(t.tf)) as k(cle)
    join public.terrain_contours c on c.cle = k.cle
  )
  select * from par_tf
  union all
  select t.id, c.cle, c.surface_plan, c.geom, c.geom_approx, c.lat, c.lng, c.lat_approx, c.lng_approx, c.zone
  from public.terrains t
  join public.terrain_contours c on c.cle = t.ref
  where t.id not in (select p.terrain_id from par_tf p)
$$;
grant execute on function public.carte_contours() to authenticated;

notify pgrst, 'reload schema';
