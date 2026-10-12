update public.terrains
   set ref = 'GF-' || case when localisation_origine is null then '26' else '25' end || '-' || substring(ref from 4)
 where ref ~ '^GF-[0-9]+$';

alter table public.terrains
  alter column ref set default 'GF-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.terrains_ref_seq')::text, 4, '0');

select count(*) filter (where ref like 'GF-25-%') as refs_2025,
       count(*) filter (where ref like 'GF-26-%') as refs_2026,
       count(*) filter (where ref !~ '^GF-[0-9]{2}-[0-9]+$') as autres
  from public.terrains;
