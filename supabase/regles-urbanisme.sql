-- Référentiel des plans d'aménagement et des règles de zone (Agence Urbaine de Casablanca).
-- Utilisé par la page Rendement et la fiche terrain du CRM.
-- Relançable : ne crée que ce qui manque. Les données (plans, règles, rattachement des localisations)
-- ont été chargées directement dans Supabase le 14/11/2026.
-- Source : PDF officiels de auc.ma (e-documents, décrets d'homologation des PA), lus le 14/11/2026.

create table if not exists public.plans_amenagement (
  code text primary key,                 -- ex. DAR-BOUAZZA
  nom text not null,                     -- ex. Dar Bouazza
  decret text,
  date_bo date,                          -- publication au Bulletin officiel
  fin_effets date,                       -- date_bo + 10 ans (loi 12-90)
  page_url text,                         -- page officielle AUC
  planche_url text,                      -- plan graphique (planche d'ensemble)
  reglement_url text,                    -- règlement général
  zones jsonb not null default '{}',     -- PDF du règlement de chaque zone : {"B": "https://...", ...}
  remarque text
);

create table if not exists public.regles_urbanisme (
  id bigserial primary key,
  plan text not null references public.plans_amenagement(code) on delete cascade,
  zone text not null,                    -- zone du règlement : A, B, BT, D, I...
  secteur text not null,                 -- secteur tel qu'écrit dans le CRM : B3, D2S, I2S1...
  typologie text,                        -- ex. villas isolées, immeubles R+4
  cos numeric,                           -- coefficient d'occupation du sol (plancher / terrain)
  emprise numeric,                       -- emprise au sol maximale, en % (CUS au sens des règlements AUC)
  hauteur numeric,                       -- hauteur maximale en mètres
  niveaux text,                          -- ex. R+3
  lot_min numeric,                       -- surface minimale de parcelle, m²
  facade_min numeric,                    -- façade ou largeur minimale, m
  remarque text,
  verifie boolean not null default false,-- chiffres contrôlés à l'œil sur le PDF
  unique (plan, secteur)
);

create table if not exists public.localisations_plan (
  localisation text primary key,         -- valeur du champ terrains.localisation
  plan text not null references public.plans_amenagement(code) on delete cascade
);

alter table public.plans_amenagement enable row level security;
alter table public.regles_urbanisme enable row level security;
alter table public.localisations_plan enable row level security;

drop policy if exists "pa_lecture" on public.plans_amenagement;
create policy "pa_lecture" on public.plans_amenagement for select to authenticated using (true);
drop policy if exists "ru_lecture" on public.regles_urbanisme;
create policy "ru_lecture" on public.regles_urbanisme for select to authenticated using (true);
drop policy if exists "lp_lecture" on public.localisations_plan;
create policy "lp_lecture" on public.localisations_plan for select to authenticated using (true);
drop policy if exists "lp_ecriture" on public.localisations_plan;
create policy "lp_ecriture" on public.localisations_plan for all to authenticated using (true) with check (true);
