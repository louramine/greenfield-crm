-- Greenfield CRM : demandes attribuées à toute l'équipe
-- A exécuter une fois dans Supabase (SQL Editor > New query > coller > Run). Relançable sans effet de bord.
-- Une « Nouvelle demande » est un deal sans terrain, dont le libellé commence par « Demande : ».
-- Quand elle est attribuée à toute l'équipe, son responsable est « Équipe » :
-- chaque membre actif de l'équipe (admin, associé ou sourceur) peut alors la voir, la créer et la marquer traitée.

-- Les deals sans terrain sont acceptés (déjà le cas si deals-terrain-hors-crm.sql a été exécuté)
alter table public.deals alter column terrain_id drop not null;

drop policy if exists "deals_equipe" on public.deals;
create policy "deals_equipe" on public.deals for all to authenticated
  using (public.mon_role() is not null and associe = 'Équipe')
  with check (public.mon_role() is not null and associe = 'Équipe');
