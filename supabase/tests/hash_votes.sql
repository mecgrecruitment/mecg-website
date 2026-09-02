begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(27);

select extensions.has_table('rush', 'referrals', 'referrals are stored');
select extensions.has_table('rush', 'hash_votes', 'hash votes are stored');
select extensions.has_column('rush', 'rush_cycles', 'hash_quorum', 'a cycle carries the vote count a tally needs');

select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'rush.referrals'::regclass),
  'referrals have row level security enabled and forced'
);
select extensions.ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'rush.hash_votes'::regclass),
  'hash votes have row level security enabled and forced'
);

select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.submit_referral(text,text,text,text,text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'submit_referral is a hardened security definer'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.set_referral_status(text,text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'set_referral_status is a hardened security definer'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.cast_hash_vote(text,text,text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'cast_hash_vote is a hardened security definer'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.hash_tally(text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'hash_tally is a hardened security definer'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.apply_hash_result(text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'apply_hash_result is a hardened security definer'
);

select extensions.ok(
  has_function_privilege('authenticated', 'rush.submit_referral(text,text,text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.submit_referral(text,text,text,text,text)', 'EXECUTE'),
  'only authenticated callers can submit a referral'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.set_referral_status(text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.set_referral_status(text,text)', 'EXECUTE'),
  'only authenticated callers can review a referral'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.cast_hash_vote(text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.cast_hash_vote(text,text,text)', 'EXECUTE'),
  'only authenticated callers can vote'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.hash_tally(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.hash_tally(text)', 'EXECUTE'),
  'only authenticated callers can read a tally'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.apply_hash_result(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.apply_hash_result(text)', 'EXECUTE'),
  'only authenticated callers can apply a tally'
);

-- Writes go through the RPCs, so anon holds nothing on either table and
-- authenticated holds select only.
select extensions.ok(
  not has_table_privilege('anon', 'rush.referrals', 'SELECT')
    and not has_table_privilege('anon', 'rush.hash_votes', 'SELECT'),
  'anon cannot read referrals or votes'
);
select extensions.ok(
  has_table_privilege('authenticated', 'rush.referrals', 'SELECT')
    and not has_table_privilege('authenticated', 'rush.referrals', 'INSERT')
    and not has_table_privilege('authenticated', 'rush.referrals', 'UPDATE'),
  'members read referrals but cannot write them directly'
);
select extensions.ok(
  has_table_privilege('authenticated', 'rush.hash_votes', 'SELECT')
    and not has_table_privilege('authenticated', 'rush.hash_votes', 'INSERT')
    and not has_table_privilege('authenticated', 'rush.hash_votes', 'UPDATE'),
  'members read votes but cannot write them directly'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'rush' and tablename = 'hash_votes' and policyname = 'hash_votes_read_own' and cmd = 'SELECT')
    and exists(select 1 from pg_policies where schemaname = 'rush' and tablename = 'referrals' and policyname = 'referrals_read_own_or_staff' and cmd = 'SELECT'),
  'both tables expose a single select-only read policy'
);

select extensions.ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'rush' and tablename = 'hash_votes' and policyname = 'hash_votes_read_own'
      and qual not like '%has_cycle_role%'
  ),
  'no role can read another members ballot'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.hash_notes(text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'hash_notes is a hardened security definer'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.hash_notes(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.hash_notes(text)', 'EXECUTE'),
  'hash_notes is reachable by members but not anon'
);

select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.hash_ballot(text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'hash_ballot is a hardened security definer'
);
-- The ballot must never offer a row that cast_hash_vote would then refuse.
select extensions.ok(
  (select prosrc from pg_proc where oid = 'rush.hash_ballot(text)'::regprocedure) like '%conflict_declarations%'
    and (select prosrc from pg_proc where oid = 'rush.hash_ballot(text)'::regprocedure) like '%WITHDRAWN%',
  'hash_ballot filters conflicts and non-votable applications'
);

-- The bug this guards: a tally-derived decision has no rows in
-- decision_approvals, and approve_decision refuses anything already LOCKED, so
-- without the hash_derived branch in release_decision it could never be sent.
select extensions.ok(
  exists(select 1 from information_schema.columns
    where table_schema = 'rush' and table_name = 'decisions' and column_name = 'hash_derived'),
  'decisions carries the hash_derived flag'
);
select extensions.ok(
  (select prosrc from pg_proc where oid = 'rush.release_decision(text)'::regprocedure) like '%hash_derived%',
  'release_decision accepts a tally in place of two approvals'
);
-- The audit row must not name the voter or the applicant; the pair of those two
-- next to a board-readable tally reconstructs the ballot.
select extensions.ok(
  (select prosrc from pg_proc where oid = 'rush.cast_hash_vote(text,text,text)'::regprocedure) not like '%HASH_VOTE_CAST'', ''Application''%',
  'the vote audit row does not record the applicant'
);

select * from extensions.finish();
rollback;
