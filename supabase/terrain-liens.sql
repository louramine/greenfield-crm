-- Terrains liés entre eux : même propriétaire, terrains contigus, ou autre raison (note libre).
-- Un lien relie deux terrains, sans sens : la paire est rangée avec le plus petit id en premier.
-- Relançable.

create table if not exists public.terrain_liens (
  id bigint generated always as identity primary key,
  terrain_a integer not null references public.terrains(id) on delete cascade,
  terrain_b integer not null references public.terrains(id) on delete cascade,
  motifs text[] not null default '{}',
  note text,
  cree_par text,
  created_at timestamptz not null default now(),
  constraint terrain_liens_ordre check (terrain_a < terrain_b),
  constraint terrain_liens_motifs check (motifs <@ array['meme_proprietaire', 'contigus', 'autre']::text[] and cardinality(motifs) > 0),
  constraint terrain_liens_paire unique (terrain_a, terrain_b)
);

create index if not exists terrain_liens_b on public.terrain_liens (terrain_b);

alter table public.terrain_liens enable row level security;
drop policy if exists "liens_lecture" on public.terrain_liens;
drop policy if exists "liens_ajout" on public.terrain_liens;
drop policy if exists "liens_modif" on public.terrain_liens;
drop policy if exists "liens_suppression" on public.terrain_liens;

-- Qui voit les deux terrains voit le lien (les règles des terrains s'appliquent)
create policy "liens_lecture" on public.terrain_liens for select to authenticated
  using (exists (select 1 from public.terrains t where t.id = terrain_a)
         and exists (select 1 from public.terrains t where t.id = terrain_b));
create policy "liens_ajout" on public.terrain_liens for insert to authenticated
  with check (exists (select 1 from public.terrains t where t.id = terrain_a)
              and exists (select 1 from public.terrains t where t.id = terrain_b));
create policy "liens_modif" on public.terrain_liens for update to authenticated
  using ((select public.mon_role()) in ('admin', 'associe') or cree_par = (select public.mon_nom()))
  with check (exists (select 1 from public.terrains t where t.id = terrain_a)
              and exists (select 1 from public.terrains t where t.id = terrain_b));
create policy "liens_suppression" on public.terrain_liens for delete to authenticated
  using ((select public.mon_role()) in ('admin', 'associe') or cree_par = (select public.mon_nom()));

grant select, insert, update, delete on public.terrain_liens to authenticated;
