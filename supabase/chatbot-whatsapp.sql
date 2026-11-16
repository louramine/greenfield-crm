-- Greenfield CRM : chatbot WhatsApp (qualification des contacts et préférences des promoteurs)
-- A exécuter une seule fois dans Supabase (SQL Editor > New query > coller > Run),
-- APRÈS le script crm-promoteurs.sql.
-- Sans danger : le script ajoute des colonnes, une table et un espace de fichiers. Il ne supprime aucune donnée.
-- Il peut être relancé sans effet de bord.

-- 1. Historique WhatsApp : pièces jointes et protection contre les doublons
alter table public.whatsapp_messages add column if not exists media_path text;
alter table public.whatsapp_messages add column if not exists media_mime text;
update public.whatsapp_messages m set wa_message_id = null
 where wa_message_id is not null
   and exists (select 1 from public.whatsapp_messages d where d.wa_message_id = m.wa_message_id and d.id < m.id);
create unique index if not exists whatsapp_messages_wa_id_unique on public.whatsapp_messages (wa_message_id);

-- 2. Une conversation par numéro : fiche remplie par le chatbot, avancement, pause du bot
--    Visible par les admins et les associés (les sourceurs ne voient que leurs propres promoteurs).
create table if not exists public.whatsapp_conversations (
  telephone          text primary key,
  nom_profil         text,
  premier_message    text,
  langue             text,
  profil             text,
  acheteur_id        bigint references public.acheteurs(id) on delete set null,
  terrain_id         bigint,
  fiche              jsonb not null default '{}'::jsonb,
  statut             text not null default 'en_cours',
  completude         integer not null default 0,
  bot_actif          boolean not null default true,
  bot_pause_jusqua   timestamptz,
  notes_appel        text,
  dernier_entrant    timestamptz,
  dernier_message_le timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists whatsapp_conversations_maj_idx on public.whatsapp_conversations (dernier_message_le desc);

alter table public.whatsapp_conversations enable row level security;
drop policy if exists "equipe lit conversations" on public.whatsapp_conversations;
drop policy if exists "equipe modifie conversations" on public.whatsapp_conversations;
drop policy if exists "admin supprime conversations" on public.whatsapp_conversations;
create policy "equipe lit conversations" on public.whatsapp_conversations for select to authenticated using (public.mon_role() in ('admin', 'associe'));
create policy "equipe modifie conversations" on public.whatsapp_conversations for update to authenticated using (public.mon_role() in ('admin', 'associe')) with check (public.mon_role() in ('admin', 'associe'));
create policy "admin supprime conversations" on public.whatsapp_conversations for delete to authenticated using (public.mon_role() = 'admin');

-- 3. Espace privé pour les photos, PDF et vocaux reçus sur WhatsApp
insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-media', 'whatsapp-media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "equipe lit medias whatsapp" on storage.objects;
create policy "equipe lit medias whatsapp" on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp-media' and public.mon_role() in ('admin', 'associe'));

-- 4. Contrôle
select
  (select count(*) from public.whatsapp_conversations) as conversations,
  (select count(*) from public.whatsapp_messages) as messages,
  (select count(*) from public.acheteurs where telephone is not null) as promoteurs_avec_numero;
