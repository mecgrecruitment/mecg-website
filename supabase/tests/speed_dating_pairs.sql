begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(24);

select extensions.has_table('rush', 'speed_dating_pairs', 'Speed Dating pairs exist');
select extensions.has_table('rush', 'speed_dating_pair_members', 'pair membership exists');
select extensions.has_table('rush', 'speed_dating_pair_claims', 'evaluator claims exist');
select extensions.col_is_pk('rush', 'speed_dating_pair_claims', array['pair_id', 'evaluator_id'], 'a member claims a pair at most once');
select extensions.has_function('rush', 'start_speed_dating_group', array['text', 'text[]', 'integer', 'integer'], 'evaluator group start function exists');
select extensions.has_function('rush', 'my_speed_dating_pairs', array['text'], 'member pair queue function exists');
select extensions.has_function('rush', 'discard_speed_dating_group', array['text'], 'group discard function exists');
select extensions.hasnt_function('rush', 'replace_speed_dating_pairs', array['text', 'jsonb', 'boolean'], 'the Board no longer builds pairs');
select extensions.hasnt_function('rush', 'claim_speed_dating_pair', array['text'], 'claims happen when a group starts');
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.start_speed_dating_group(text,text[],integer,integer)'::regprocedure),
  'group start is a hardened security definer'
);
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.my_speed_dating_pairs(text)'::regprocedure),
  'pair queue is a hardened security definer'
);
select extensions.ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'rush.discard_speed_dating_group(text)'::regprocedure),
  'group discard is a hardened security definer'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.start_speed_dating_group(text,text[],integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'rush.start_speed_dating_group(text,text[],integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'rush.discard_speed_dating_group(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'rush.discard_speed_dating_group(text)', 'EXECUTE'),
  'only authenticated actors can start or discard a group'
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
  and position('is_active_screening_reviewer' in pg_get_functiondef('rush.start_speed_dating_group(text,text[],integer,integer)'::regprocedure)) > 0,
  'screening reviewers cannot search applicants or start identified groups'
);
select extensions.ok(
  position('You already scored' in pg_get_functiondef('rush.start_speed_dating_group(text,text[],integer,integer)'::regprocedure)) > 0
  and position('submitted groups cannot be discarded' in pg_get_functiondef('rush.discard_speed_dating_group(text)'::regprocedure)) > 0,
  'a group cannot re-score an applicant and a submitted group cannot be discarded'
);

select extensions.has_column('rush', 'speed_dating_pairs', 'session', 'a pair belongs to a session');
select extensions.has_column('rush', 'speed_dating_pair_members', 'session', 'pair membership carries the session');
select extensions.ok(
  not exists(select 1 from pg_constraint where conrelid = 'rush.speed_dating_pair_members'::regclass
    and conname in ('speed_dating_pair_members_round_id_session_application_id_key', 'speed_dating_pair_members_round_id_application_id_key')),
  'several evaluators at one table may each start a group for the same applicants'
);
select extensions.ok(
  position('between 1 and 3' in pg_get_constraintdef((select oid from pg_constraint where conrelid = 'rush.speed_dating_pair_members'::regclass
    and conname = 'speed_dating_pair_members_position_check'))) > 0,
  'a group seats up to three applicants'
);

select * from extensions.finish();
rollback;
