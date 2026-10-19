-- Terrains favoris : une liste par utilisateur, visible seulement par lui.
-- A executer dans Supabase > SQL Editor, en une seule fois.

create table if not exists public.terrain_favoris (
  user_id uuid not null default auth.uid(),
  terrain_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, terrain_id)
);

alter table public.terrain_favoris enable row level security;
drop policy if exists "favoris_lecture" on public.terrain_favoris;
drop policy if exists "favoris_ajout" on public.terrain_favoris;
drop policy if exists "favoris_suppression" on public.terrain_favoris;

create policy "favoris_lecture" on public.terrain_favoris for select to authenticated
  using (user_id = auth.uid());
create policy "favoris_ajout" on public.terrain_favoris for insert to authenticated
  with check (user_id = auth.uid());
create policy "favoris_suppression" on public.terrain_favoris for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.terrain_favoris to authenticated;

select count(*) as favoris_enregistres from public.terrain_favoris;
