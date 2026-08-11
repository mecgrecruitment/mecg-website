-- Transactional recruitment-write smoke tests. Runs entirely in a transaction
-- and rolls back. Requires the seeded local database.

\set ON_ERROR_STOP on

begin;

select set_config('test.board_uid', (select id::text from auth.users where email = 'annie.callam@umich.edu'), false);
select set_config('test.committee_uid', (select id::text from auth.users where email = 'committee.test@umich.edu'), false);
select set_config('test.committee_mid', (select id::text from public.members where email = 'committee.test@umich.edu'), false);
select set_config('test.cand_id', (select id::text from public.candidates where per_cycle_seq = 1), false);
select set_config('test.other_cand_id', (select id::text from public.candidates where per_cycle_seq = 2), false);
select set_config('test.rubric_id', (
  select id::text from public.rubric_versions where stage = 'speed_dating' and is_active limit 1
), false);

update public.candidates
   set current_stage = 'speed_dating', status = 'active'
 where id = current_setting('test.cand_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.committee_uid'), 'role', 'authenticated')::text, true);

do $$
declare
  payload jsonb;
begin
  select jsonb_agg(jsonb_build_object('criterion_id', id, 'value', 4) order by display_order)
    into payload
    from public.rubric_criteria
   where rubric_version_id = current_setting('test.rubric_id')::uuid;

  begin
    perform public.submit_candidate_score(
      current_setting('test.cand_id')::uuid,
      'speed_dating',
      current_setting('test.rubric_id')::uuid,
      payload
    );
    raise exception 'FAIL: unassigned evaluator submitted a scorecard';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  raise notice 'PASS: score RPC rejects an unassigned evaluator';
end $$;

reset role;

insert into public.evaluator_assignments (cycle_id, stage, evaluator_id, candidate_id)
select cycle_id, 'speed_dating', current_setting('test.committee_mid')::uuid, id
  from public.candidates
 where id = current_setting('test.cand_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.committee_uid'), 'role', 'authenticated')::text, true);

do $$
declare
  payload jsonb;
  score_count integer;
  submission_count integer;
begin
  select jsonb_agg(jsonb_build_object('criterion_id', id, 'value', 4) order by display_order)
    into payload
    from public.rubric_criteria
   where rubric_version_id = current_setting('test.rubric_id')::uuid;

  perform public.submit_candidate_score(
    current_setting('test.cand_id')::uuid,
    'speed_dating',
    current_setting('test.rubric_id')::uuid,
    payload
  );

  select count(*) into score_count
    from public.scores
   where candidate_id = current_setting('test.cand_id')::uuid
     and evaluator_id = current_setting('test.committee_mid')::uuid
     and stage = 'speed_dating';
  select count(*) into submission_count
    from public.score_submissions
   where candidate_id = current_setting('test.cand_id')::uuid
     and evaluator_id = current_setting('test.committee_mid')::uuid
     and stage = 'speed_dating';

  assert score_count = jsonb_array_length(payload), 'FAIL: score RPC did not save the complete rubric';
  assert submission_count = 1, 'FAIL: score RPC did not create exactly one submission header';
  raise notice 'PASS: assigned evaluator scorecard committed atomically';
end $$;

reset role;

update public.candidates
   set current_stage = 'interview', status = 'active'
 where id = current_setting('test.cand_id')::uuid;

update public.hash_sessions set is_active = false where is_active;

insert into public.hash_sessions (cycle_id, stage, name, is_active, started_at, started_by)
select c.cycle_id, 'interview', 'Integrity Test', true, now(), m.id
  from public.candidates c
  cross join public.members m
 where c.id = current_setting('test.cand_id')::uuid
   and m.user_id = current_setting('test.board_uid')::uuid
returning id \gset test_session_

select set_config('test.session_id', :'test_session_id', false);

insert into public.hash_session_participants (session_id, member_id)
values (:'test_session_id', current_setting('test.committee_mid')::uuid);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.committee_uid'), 'role', 'authenticated')::text, true);

select public.submit_hash_vote(:'test_session_id', current_setting('test.cand_id')::uuid, 'advance');

do $$
begin
  begin
    perform public.submit_hash_vote(
      current_setting('test.session_id')::uuid,
      current_setting('test.other_cand_id')::uuid,
      'advance'
    );
    raise exception 'FAIL: vote RPC accepted a candidate outside the session stage';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: vote RPC rejects candidates outside the session stage';
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.board_uid'), 'role', 'authenticated')::text, true);

select public.record_hash_decision(
  :'test_session_id',
  current_setting('test.cand_id')::uuid,
  'accepted',
  'Integrity test'
);

do $$
declare
  candidate_ok boolean;
  decision_count integer;
  transition_count integer;
begin
  select status = 'accepted' and current_stage = 'decided' into candidate_ok
    from public.candidates where id = current_setting('test.cand_id')::uuid;
  select count(*) into decision_count from public.decisions
   where session_id = current_setting('test.session_id')::uuid
     and candidate_id = current_setting('test.cand_id')::uuid;
  select count(*) into transition_count from public.stage_transitions
   where candidate_id = current_setting('test.cand_id')::uuid
     and to_stage = 'decided';

  assert candidate_ok, 'FAIL: decision RPC did not update the candidate';
  assert decision_count = 1, 'FAIL: decision RPC did not append one decision';
  assert transition_count = 1, 'FAIL: decision RPC did not append one transition';
  raise notice 'PASS: decision, candidate status, and transition committed together';
end $$;

rollback;

\echo 'RECRUITMENT WRITE INTEGRITY: ALL CHECKS PASSED (transaction rolled back)'
