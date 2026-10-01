-- A executer apres droits-deals-et-sourceurs.sql
-- Les sourceurs voient, ajoutent et modifient uniquement leurs propres acheteurs (pas de suppression).
drop policy if exists "sourceur_acheteurs_lecture" on public.acheteurs;
drop policy if exists "sourceur_acheteurs_ajout" on public.acheteurs;
drop policy if exists "sourceur_acheteurs_modif" on public.acheteurs;
create policy "sourceur_acheteurs_lecture" on public.acheteurs for select to authenticated
  using (public.mon_role() = 'sourceur' and associe = public.mon_nom());
create policy "sourceur_acheteurs_ajout" on public.acheteurs for insert to authenticated
  with check (public.mon_role() = 'sourceur' and associe = public.mon_nom());
create policy "sourceur_acheteurs_modif" on public.acheteurs for update to authenticated
  using (public.mon_role() = 'sourceur' and associe = public.mon_nom())
  with check (public.mon_role() = 'sourceur' and associe = public.mon_nom());
