-- Greenfield CRM : ne garder que les contours CADGIS des titres présents dans le CRM
-- A exécuter dans Supabase (SQL Editor > New query > coller > Run). Relançable.
-- Un terrain ajouté plus tard avec un nouveau TF n'aura son contour qu'après un nouvel import.

-- Les clés des TF du CRM sont calculées une seule fois, puis comparées aux contours (quelques secondes)
create temporary table garder as
  select distinct unnest(public.tf_cles(tf)) as cle from public.terrains;

delete from public.terrain_contours c
 where not exists (select 1 from garder g where g.cle = c.cle);

drop table garder;

select count(*) as contours_conserves from public.terrain_contours;
