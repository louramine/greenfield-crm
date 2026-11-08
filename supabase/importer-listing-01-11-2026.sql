-- A executer dans Supabase > SQL Editor, en une seule fois (tout le script).
-- Mise a jour du CRM avec le listing du 1er novembre 2026.
-- 1. Ajoute les 49 nouveaux terrains du listing (N° 936 a 984), references GF-26-0936 a GF-26-0984.
--    Statut "À qualifier" : ils n'apparaissent pas sur la carte prospect tant qu'ils ne sont pas passes en Disponible.
--    Le quartier est rattache au libelle normalise deja utilise dans le CRM quand il existe (ex. Darbouazza -> Dar Bouazza),
--    le libelle du listing est garde dans localisation_origine.
-- 2. Met a jour 3 prix au m² (N° 485, 615, 909), seulement si le prix du CRM est encore l'ancien prix du listing :
--    un prix deja corrige a la main dans le CRM n'est pas ecrase (il apparait dans le rapport).
-- Garde-fous : un terrain deja present (meme reference, ou meme superficie + TF + def urba) n'est pas ajoute une seconde fois.
-- Le script peut etre relance sans creer de doublon. Rien n'est supprime.

create function pg_temp.gf_nz(text) returns text language sql immutable as
$f$ select regexp_replace(lower(coalesce($1, '')), '[^a-z0-9]', '', 'g') $f$;

create temp table gf_new (
  n int primary key, quartier text, urba text, sup numeric, prix numeric,
  tf text, sourceur text, google_map text
);
insert into gf_new values
  (936, 'Darbouazza', 'B3 E2s C2', 60000, 1200, '89379/C', 'Lourak', NULL),
  (937, 'Tit Mellil', 'C4 D1', 30000, 1300, '9333/C - 7732/D2', 'Lourak', NULL),
  (938, 'Skhirate temara', 'B4', 25000, 2250, '54434/R', 'Lourak', NULL),
  (939, 'Rabat Souissi', 'D4', 560000, 3000, '5078/R', 'S.O', NULL),
  (940, 'Marrakech', 'Hca5', 1422, 28000, '43795/04', 'Amur', NULL),
  (941, 'Sidi Moumen', 'A5S', 15000, NULL, '30034/C', 'Mehdi Rhassouli', NULL),
  (942, 'Ibnou Sina', 'D4', 1000, NULL, '36559/C', 'Mehdi Rhassouli', NULL),
  (943, 'Hadda', 'I2', 16731, NULL, '24755/85', 'Abderrezak', NULL),
  (944, 'Ain Diab', 'BT3S1', 18000, 23000, '71429/01', 'Amur', NULL),
  (945, 'Bourgogne', 'B4', 182, 22000, '3725/D', 'Bassim', NULL),
  (946, 'Tanger', 'HP HB', 11000, 22000, '38795/06', 'Amur', NULL),
  (947, 'Ain Diab', 'D1 CV CQS', 38071, 7000, '9057/C', 'Benazzouz', NULL),
  (948, 'Abdelmoumen', 'ZUG', 2187, 30000, '2432/C', 'A qualifier', NULL),
  (949, 'Tanger', 'R+20', 21315, 20000, '458/G', 'Amur', NULL),
  (950, 'Tanger', 'R+5', 7000, 8500, '108870/06', 'Amur', NULL),
  (951, 'Oasis', 'B3S', 2200, 22000, '50100/C - 49806/C - 65538/1 - 49477/C', 'Amur', NULL),
  (952, 'Rabat Souissi', 'A7', 475, 16500, '50496/R', 'Mehdi Rhassouli', NULL),
  (953, 'Sidi Maarouf', 'I5H', 25000, 22500, '13628/C', 'A qualifier', NULL),
  (954, 'Essaouira', 'I', 9461, 5500, '62436/35', 'Amur', NULL),
  (955, 'Gauthier', 'ZUG', 580, 37000, '2354/C', 'A qualifier', NULL),
  (956, 'Marrakech', 'S2', 43520, NULL, '222300/04', 'Habous', NULL),
  (957, 'Fal Fleurie', 'B5', 924, 32000, '21970/D', 'A qualifier', NULL),
  (958, 'Mohammedia', 'I5', 20000, 1500, '34816/C', 'A qualifier', NULL),
  (959, 'France ville', 'B3', 593, 22000, '25379/C', 'Hachim', NULL),
  (960, 'Temara', 'INL IN2', 30000, 1000, '24092/R', 'Hamza', NULL),
  (961, 'Agadir', 'Hca4', 1222, 11500, '23877/60', 'Bassim', NULL),
  (962, 'Oulad Azzouz', 'I8', 66359, 2000, '6776/C', 'Bouchar', NULL),
  (963, 'Centre ville', 'R+1', 275, 10000, '21165/C', 'Bassim', NULL),
  (964, 'Mediouna', 'B3', 45513, NULL, '3148/85 - 3149/C', 'Hachim', NULL),
  (965, 'Par Anfa', 'D4', 2102, NULL, '46572/C', 'Hachim', NULL),
  (966, 'Oulad Saleh', 'RS', 300000, 850, '11528/47', 'Mehdi Rhassouli', NULL),
  (967, 'Roches noires', 'B5', 440, 23000, '42645/C', 'A qualifier', NULL),
  (968, 'Anoual', 'B3s', 9526, 9000, '6286/C', 'Badr Benki', NULL),
  (969, 'Ain Diab', 'C2 D3', 15543, 8000, '76518/C', 'Hachim', NULL),
  (970, 'Roches noires', 'A5', 1800, 22000, '11120/C', 'A qualifier', NULL),
  (971, 'Roches noires', 'I5s5', 2085, 22000, '38532/C', 'A qualifier', NULL),
  (972, 'Mohammedia', 'E3S1', 704, 11000, '13712/C', 'Bassim', NULL),
  (973, 'La vilette', 'B5', 304, 11000, '27614/C', 'Bassim', NULL),
  (974, 'Marrakech Gueliz', 'B5', 560, 30000, '5535/M', 'Bassim', NULL),
  (975, 'Route d''eljadida', 'FB5', 2867, 62500, '44/34', 'Benazzouz', NULL),
  (976, 'Bouskoura', 'E3', 3764, 3000, '17966/63', 'Ayoub', NULL),
  (977, 'Mediouna', 'E3', 10000, 1200, '163749/12', 'Hachim', NULL),
  (978, 'Bouskoura', 'I2S1', 17501, 1400, '9309/33', 'Hachim', NULL),
  (979, 'Oulad Saleh', 'I2', 27965, NULL, '95781/63', 'A qualifier', NULL),
  (980, 'Oasis', 'B3', 749, 20000, '41256/C', 'A qualifier', NULL),
  (981, 'Mediouna', 'E4', 34583, 1500, '3989/85', 'A qualifier', NULL),
  (982, 'Oulad Saleh', 'D1 B4', 40000, NULL, '27149/C', 'Balazi', NULL),
  (983, 'Lahraouiyine', 'I8S1', 17000, 1500, '1196385', 'Hachim', NULL),
  (984, 'Belvedere', 'B5 FB7', 1709, 21000, '27004/C', 'Hachim', NULL);

create temp table gf_report (ord int, libelle text, valeur text);

-- 1. Nouveaux terrains
with ins as (
  insert into public.terrains (localisation, quartier, localisation_origine, urba, superficie, prix, tf, sourceur,
                               statut, statut_juridique, usage, google_map, ref)
  select coalesce(qn.loc, v.quartier), coalesce(qn.loc, v.quartier), v.quartier,
         v.urba, v.sup, v.prix, v.tf, v.sourceur,
         'À qualifier', 'Non renseigné', 'Mixte', v.google_map,
         format('GF-26-%s', lpad(v.n::text, 4, '0'))
    from gf_new v
    left join lateral (
      select t.localisation as loc
        from public.terrains t
       where pg_temp.gf_nz(v.quartier) <> ''
         and (pg_temp.gf_nz(t.localisation_origine) = pg_temp.gf_nz(v.quartier)
              or pg_temp.gf_nz(t.localisation) = pg_temp.gf_nz(v.quartier))
         and coalesce(t.localisation, '') <> ''
       group by t.localisation
       order by count(*) desc
       limit 1
    ) qn on true
   where not exists (select 1 from public.terrains t where t.ref = format('GF-26-%s', lpad(v.n::text, 4, '0')))
     and not exists (
       select 1 from public.terrains t
        where coalesce(t.superficie, 0) = coalesce(v.sup, 0)
          and pg_temp.gf_nz(t.tf) <> '' and pg_temp.gf_nz(t.tf) = pg_temp.gf_nz(v.tf)
          and pg_temp.gf_nz(t.urba) = pg_temp.gf_nz(v.urba))
   order by v.n
  returning ref
)
insert into gf_report select 10, 'terrains ajoutes', count(*)::text from ins;

insert into gf_report select 20, 'non ajoutes car deja presents', (49 - (select valeur::int from gf_report where ord = 10))::text;

-- 2. Prix modifies dans le listing
create temp table gf_prix (n int primary key, ancien numeric, nouveau numeric);
insert into gf_prix values (485, NULL, 28000), (615, NULL, 2000), (909, 2200, 3000);

with maj as (
  update public.terrains t
     set prix = p.nouveau
    from gf_prix p
   where t.ref ~ ('^GF-[0-9]{2}-' || lpad(p.n::text, 4, '0') || '$')
     and coalesce(t.prix, -1) = coalesce(p.ancien, -1)
  returning t.ref
)
insert into gf_report select 30, 'prix mis a jour', coalesce(string_agg(ref, ', ' order by ref), 'aucun') from maj;

insert into gf_report
select 40, 'prix differents dans le CRM (non modifies)',
       coalesce(string_agg(format('%s : CRM %s, listing %s', t.ref, coalesce(t.prix::text, 'vide'), p.nouveau), ' / ' order by t.ref), 'aucun')
  from gf_prix p
  join public.terrains t on t.ref ~ ('^GF-[0-9]{2}-' || lpad(p.n::text, 4, '0') || '$')
 where coalesce(t.prix, -1) <> p.nouveau;

-- Rapport
insert into gf_report select 50, 'refs GF-26-0936 a 0984 presentes', count(*)::text
  from public.terrains where ref ~ '^GF-26-09(3[6-9]|[4-7][0-9]|8[0-4])$';
insert into gf_report select 60, 'total terrains en base', count(*)::text from public.terrains;
insert into gf_report select 70, 'refs en double', count(*)::text from (select ref from public.terrains group by ref having count(*) > 1) d;
select libelle, valeur from gf_report order by ord;
