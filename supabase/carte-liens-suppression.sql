-- Suppression des liens envoyés de la carte Atlas : par l'auteur du lien, un associé ou un admin.
-- Les sélections reçues par un lien supprimé partent avec lui (clé étrangère en cascade).
-- Relançable.
drop policy if exists "liens_suppression" on public.carte_liens;
create policy "liens_suppression" on public.carte_liens for delete to authenticated
  using ((select public.mon_role()) in ('admin', 'associe') or cree_par = (select public.mon_nom()));
grant delete on public.carte_liens to authenticated;
