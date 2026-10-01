-- A executer dans Supabase > SQL Editor (une seule fois)
-- 1. Table equipe, colonnes acheteurs, roles et droits d'acces

create table if not exists public.equipe (
  id bigint generated always as identity primary key,
  nom text not null,
  email text not null unique,
  role text not null default 'sourceur' check (role in ('admin','associe','sourceur')),
  specialite text,
  zones text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.acheteurs add column if not exists associe text;
alter table public.acheteurs add column if not exists villes text[] not null default '{}';

-- Membres actuels (modifiez les roles ensuite depuis la page Equipe)
insert into public.equipe (nom, email, role, specialite) values
  ('Amine',  'louramine@gmail.com',      'admin',  null),
  ('Hachim', 'hachimkherraz@gmail.com',  'admin',  null),
  ('Ayoub',  'ayoublyaf@gmail.com',      'admin',  null)
on conflict (email) do nothing;

-- Role de l'utilisateur connecte
create or replace function public.mon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.equipe
  where lower(email) = lower(auth.jwt() ->> 'email') and actif
  limit 1
$$;
grant execute on function public.mon_role() to authenticated;

-- Droits
alter table public.equipe enable row level security;
drop policy if exists "equipe_lecture" on public.equipe;
drop policy if exists "equipe_admin" on public.equipe;
create policy "equipe_lecture" on public.equipe for select to authenticated using (true);
create policy "equipe_admin" on public.equipe for all to authenticated
  using (public.mon_role() = 'admin') with check (public.mon_role() = 'admin');

do $$
declare t text;
begin
  foreach t in array array['terrains','acheteurs','deals','interactions','activity_log'] loop
    execute format('drop policy if exists "acces_equipe" on public.%I', t);
    execute format('drop policy if exists "staff_total" on public.%I', t);
    execute format('create policy "staff_total" on public.%I for all to authenticated using (public.mon_role() in (''admin'',''associe'')) with check (public.mon_role() in (''admin'',''associe''))', t);
  end loop;
end $$;

-- Les sourceurs voient et ajoutent des terrains uniquement
drop policy if exists "sourceur_terrains_lecture" on public.terrains;
drop policy if exists "sourceur_terrains_ajout" on public.terrains;
create policy "sourceur_terrains_lecture" on public.terrains for select to authenticated using (public.mon_role() = 'sourceur');
create policy "sourceur_terrains_ajout" on public.terrains for insert to authenticated with check (public.mon_role() = 'sourceur');
drop policy if exists "sourceur_log_ajout" on public.activity_log;
create policy "sourceur_log_ajout" on public.activity_log for insert to authenticated with check (public.mon_role() = 'sourceur');
