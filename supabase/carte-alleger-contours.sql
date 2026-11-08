-- Greenfield CRM : ne garder que les contours CADGIS des titres présents dans le CRM
-- A exécuter dans Supabase (SQL Editor > New query > coller > Run).
-- Un terrain ajouté plus tard avec un nouveau TF n'aura son contour qu'après un nouvel import.

delete from public.terrain_contours c
 where not exists (
   select 1 from public.terrains t
    where c.cle = any(public.tf_cles(t.tf))
 );

-- L'espace disque est récupéré automatiquement par Supabase dans les minutes qui suivent
select count(*) as contours_conserves from public.terrain_contours;
