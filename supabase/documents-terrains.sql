-- Documents des terrains : Plan cadastral, Note de renseignement, Certificat de propriete
-- Les fichiers sont stockes dans un bucket prive "terrain-docs", la liste dans la table terrain_documents.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('terrain-docs', 'terrain-docs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

create table if not exists public.terrain_documents (
  id bigint generated always as identity primary key,
  terrain_id text not null,
  type text not null check (type in ('plan_cadastral', 'note_renseignement', 'certificat_propriete')),
  nom_fichier text not null,
  chemin text not null unique,
  taille bigint,
  mime text,
  ajoute_par text,
  created_at timestamptz not null default now(),
  unique (terrain_id, type)
);

alter table public.terrain_documents enable row level security;
drop policy if exists "docs_lecture" on public.terrain_documents;
drop policy if exists "docs_ajout" on public.terrain_documents;
drop policy if exists "docs_modif" on public.terrain_documents;
drop policy if exists "docs_suppression" on public.terrain_documents;

-- Qui voit un terrain voit ses documents (les regles des terrains s'appliquent)
create policy "docs_lecture" on public.terrain_documents for select to authenticated
  using (exists (select 1 from public.terrains t where t.id::text = terrain_id));
create policy "docs_ajout" on public.terrain_documents for insert to authenticated
  with check (exists (select 1 from public.terrains t where t.id::text = terrain_id));
create policy "docs_modif" on public.terrain_documents for update to authenticated
  using (exists (select 1 from public.terrains t where t.id::text = terrain_id))
  with check (exists (select 1 from public.terrains t where t.id::text = terrain_id));
create policy "docs_suppression" on public.terrain_documents for delete to authenticated
  using (public.mon_role() = 'admin' or ajoute_par = public.mon_nom());

grant select, insert, update, delete on public.terrain_documents to authenticated;

-- Acces aux fichiers : le premier dossier du chemin est l'id du terrain
drop policy if exists "terrain_docs_lecture" on storage.objects;
drop policy if exists "terrain_docs_ajout" on storage.objects;
drop policy if exists "terrain_docs_modif" on storage.objects;
drop policy if exists "terrain_docs_suppression" on storage.objects;

create policy "terrain_docs_lecture" on storage.objects for select to authenticated
  using (bucket_id = 'terrain-docs'
         and exists (select 1 from public.terrains t where t.id::text = (storage.foldername(name))[1]));
create policy "terrain_docs_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'terrain-docs'
              and exists (select 1 from public.terrains t where t.id::text = (storage.foldername(name))[1]));
create policy "terrain_docs_modif" on storage.objects for update to authenticated
  using (bucket_id = 'terrain-docs'
         and exists (select 1 from public.terrains t where t.id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'terrain-docs');
create policy "terrain_docs_suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'terrain-docs'
         and (public.mon_role() = 'admin'
              or exists (select 1 from public.terrain_documents d where d.chemin = name and d.ajoute_par = public.mon_nom())));
