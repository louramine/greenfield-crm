-- A executer dans Supabase > SQL Editor APRES avoir cree l'utilisateur equipe@greenfield.plus
-- Verrouille les tables : seuls les utilisateurs connectes peuvent lire et ecrire.
do $$
declare t text; pol record;
begin
  foreach t in array array['terrains','acheteurs','deals','interactions','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "acces_equipe" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
