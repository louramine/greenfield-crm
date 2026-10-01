-- Les sourceurs voient tout le CRM sauf les deals des autres.
-- Terrains : lecture de tous, ajout et modification des leurs. Acheteurs et interactions : lecture, ajout, modification. Pas de suppression.
drop policy if exists "sourceur_terrains_lecture" on public.terrains;
create policy "sourceur_terrains_lecture" on public.terrains for select to authenticated
  using (public.mon_role() = 'sourceur');

drop policy if exists "sourceur_acheteurs_lecture" on public.acheteurs;
drop policy if exists "sourceur_acheteurs_ajout" on public.acheteurs;
drop policy if exists "sourceur_acheteurs_modif" on public.acheteurs;
create policy "sourceur_acheteurs_lecture" on public.acheteurs for select to authenticated
  using (public.mon_role() = 'sourceur');
create policy "sourceur_acheteurs_ajout" on public.acheteurs for insert to authenticated
  with check (public.mon_role() = 'sourceur');
create policy "sourceur_acheteurs_modif" on public.acheteurs for update to authenticated
  using (public.mon_role() = 'sourceur') with check (public.mon_role() = 'sourceur');

drop policy if exists "sourceur_interactions_lecture" on public.interactions;
drop policy if exists "sourceur_interactions_ajout" on public.interactions;
create policy "sourceur_interactions_lecture" on public.interactions for select to authenticated
  using (public.mon_role() = 'sourceur');
create policy "sourceur_interactions_ajout" on public.interactions for insert to authenticated
  with check (public.mon_role() = 'sourceur');
