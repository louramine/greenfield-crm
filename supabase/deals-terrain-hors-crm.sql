-- Autorise les deals sur un terrain hors CRM (terrain_id vide, libelle dans terrain_label)
-- Sans danger si la colonne l'accepte deja.
alter table public.deals alter column terrain_id drop not null;
