begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(18);

select extensions.has_table('rush', 'speed_dating_pairs', 'Speed Dating pairs exist');
select extensions.has_table('rush', 'speed_dating_pair_members', 'pair membership exists');
select extensions.has_table('rush', 'speed_dating_pair_claims', 'evaluator claims exist');
select extensions.col_is_pk('rush', 'speed_dating_pair_claims', array['pair_id', 'evaluator_id'], 'a member claims a pair at most once');
select extensions.has_function('rush', 'replace_speed_dating_pairs', array['text', 'jsonb', 'boolean'], 'Board pair replacement function exists');
select extensions.has_function('rush', 'my_speed_dating_pairs', array['text'], 'member pair queue function exists');
select extensions.has_function('rush', 'claim_speed_dating_pair', array['text'], 'pair claim function exists');
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.replace_speed_dating_pairs(text,jsonb,boolean)'::regprocedure),
  'pair replacement is a hardened security definer'
);
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.my_speed_dating_pairs(text)'::regprocedure),
  'pair queue is a hardened security definer'
);
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.claim_speed_dating_pair(text)'::regprocedure),
  'pair claim is a hardened security definer'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.claim_speed_dating_pair(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'rush.claim_speed_dating_pair(text)', 'EXECUTE'),
  'only authenticated actors can call pair claim'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'rush.speed_dating_pairs', 'SELECT')
  and not has_table_privilege('authenticated', 'rush.speed_dating_pair_members', 'SELECT')
  and not has_table_privilege('authenticated', 'rush.speed_dating_pair_claims', 'SELECT'),
  'pair data is exposed only through guarded functions'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'rush.speed_dating_pairs'::regclass),
  'pairs force row-level security'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'rush.speed_dating_pair_members'::regclass),
  'pair members force row-level security'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'rush.speed_dating_pair_claims'::regclass),
  'claims force row-level security'
);
select extensions.ok(
  position('conflict_declarations' in pg_get_functiondef('rush.my_speed_dating_pairs(text)'::regprocedure)) > 0,
  'member search omits conflicted pairs'
);
select extensions.ok(
  position('is_active_screening_reviewer' in pg_get_functiondef('rush.my_speed_dating_pairs(text)'::regprocedure)) > 0
  and position('is_active_screening_reviewer' in pg_get_functiondef('rush.claim_speed_dating_pair(text)'::regprocedure)) > 0,
  'screening reviewers cannot search or claim identified pairs'
);
select extensions.ok(
  position('on conflict' in lower(pg_get_functiondef('rush.claim_speed_dating_pair(text)'::regprocedure))) > 0,
  'claim retries are idempotent'
);

select * from extensions.finish();
rollback;
