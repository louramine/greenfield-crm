select id, ref, localisation, superficie, tf, urba, sourceur, statut
  from public.terrains
 where lower(trim(tf)) in ('5128/c', '100706/c', '45895/c', '42900/c')
 order by tf, id;
