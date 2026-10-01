-- A executer dans Supabase > SQL Editor (apres equipe-et-roles.sql)
-- Admins : tout voir. Associes et sourceurs : uniquement leurs propres deals et leur propre journal.
-- Sourceurs : uniquement les terrains dont ils sont le sourceur (lecture, ajout, modification).

create or replace function public.mon_nom() returns text
language sql stable security definer set search_path = public as $$
  select nom from public.equipe
  where lower(email) = lower(auth.jwt() ->> 'email') and actif
  limit 1
$$;
grant execute on function public.mon_nom() to authenticated;

update public.equipe set role = 'admin'  where email in ('louramine@gmail.com', 'ayoublyaf@gmail.com');
update public.equipe set role = 'associe' where email = 'hachimkherraz@gmail.com';

-- Deals
drop policy if exists "staff_total" on public.deals;
drop policy if exists "deals_admin" on public.deals;
drop policy if exists "deals_propres" on public.deals;
create policy "deals_admin" on public.deals for all to authenticated
  using (public.mon_role() = 'admin') with check (public.mon_role() = 'admin');
create policy "deals_propres" on public.deals for all to authenticated
  using (public.mon_role() in ('associe','sourceur') and associe = public.mon_nom())
  with check (public.mon_role() in ('associe','sourceur') and associe = public.mon_nom());

-- Journal d'activite
drop policy if exists "staff_total" on public.activity_log;
drop policy if exists "sourceur_log_ajout" on public.activity_log;
drop policy if exists "log_admin" on public.activity_log;
drop policy if exists "log_propre_lecture" on public.activity_log;
drop policy if exists "log_propre_ajout" on public.activity_log;
create policy "log_admin" on public.activity_log for all to authenticated
  using (public.mon_role() = 'admin') with check (public.mon_role() = 'admin');
create policy "log_propre_lecture" on public.activity_log for select to authenticated
  using (public.mon_role() in ('associe','sourceur') and associe = public.mon_nom());
create policy "log_propre_ajout" on public.activity_log for insert to authenticated
  with check (public.mon_role() in ('associe','sourceur') and associe = public.mon_nom());

-- Terrains des sourceurs
drop policy if exists "sourceur_terrains_lecture" on public.terrains;
drop policy if exists "sourceur_terrains_ajout" on public.terrains;
drop policy if exists "sourceur_terrains_modif" on public.terrains;
create policy "sourceur_terrains_lecture" on public.terrains for select to authenticated
  using (public.mon_role() = 'sourceur' and sourceur = public.mon_nom());
create policy "sourceur_terrains_ajout" on public.terrains for insert to authenticated
  with check (public.mon_role() = 'sourceur' and sourceur = public.mon_nom());
create policy "sourceur_terrains_modif" on public.terrains for update to authenticated
  using (public.mon_role() = 'sourceur' and sourceur = public.mon_nom())
  with check (public.mon_role() = 'sourceur' and sourceur = public.mon_nom());
