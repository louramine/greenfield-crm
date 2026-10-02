-- Taches sur les deals, assignables a un membre de l'equipe
create table if not exists public.deal_taches (
  id bigint generated always as identity primary key,
  deal_id bigint not null references public.deals(id) on delete cascade,
  deal_label text,
  titre text not null,
  assigne_a text not null,
  echeance date,
  statut text not null default 'a_faire' check (statut in ('a_faire','fait')),
  cree_par text,
  created_at timestamptz not null default now()
);

alter table public.deal_taches enable row level security;
drop policy if exists "taches_admin" on public.deal_taches;
drop policy if exists "taches_lecture" on public.deal_taches;
drop policy if exists "taches_ajout" on public.deal_taches;
drop policy if exists "taches_modif" on public.deal_taches;
drop policy if exists "taches_suppression" on public.deal_taches;

create policy "taches_admin" on public.deal_taches for all to authenticated
  using (public.mon_role() = 'admin') with check (public.mon_role() = 'admin');

-- Lecture et modification : le proprietaire du deal ou la personne assignee
create policy "taches_lecture" on public.deal_taches for select to authenticated
  using (assigne_a = public.mon_nom()
         or exists (select 1 from public.deals d where d.id = deal_id and d.associe = public.mon_nom()));
create policy "taches_modif" on public.deal_taches for update to authenticated
  using (assigne_a = public.mon_nom()
         or exists (select 1 from public.deals d where d.id = deal_id and d.associe = public.mon_nom()))
  with check (assigne_a = public.mon_nom()
         or exists (select 1 from public.deals d where d.id = deal_id and d.associe = public.mon_nom()));

-- Ajout et suppression : le proprietaire du deal
create policy "taches_ajout" on public.deal_taches for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_id and d.associe = public.mon_nom()));
create policy "taches_suppression" on public.deal_taches for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id and d.associe = public.mon_nom()));
