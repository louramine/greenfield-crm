-- Greenfield CRM : ne garder que les contours CADGIS des titres présents dans le CRM
-- A exécuter dans Supabase (SQL Editor > New query > coller > Run). Relançable.
-- Un terrain ajouté plus tard avec un nouveau TF n'aura son contour qu'après un nouvel import.
-- Une seule instruction : les clés des TF du CRM sont calculées une fois, puis comparées aux contours.

with garder as materialized (
  select distinct unnest(public.tf_cles(tf)) as cle from public.terrains
  union
  select ref from public.terrains where ref is not null   -- contours rattachés par la référence du terrain
)
delete from public.terrain_contours c
 where not exists (select 1 from garder g where g.cle = c.cle);

select count(*) as contours_conserves from public.terrain_contours;
