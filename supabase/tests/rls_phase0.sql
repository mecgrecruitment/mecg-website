-- Phase 0 RLS smoke tests. Run against the LOCAL stack only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_phase0.sql
-- Everything runs inside one transaction and rolls back. Prints PASS lines;
-- any failure aborts with an exception (ON_ERROR_STOP).
-- CI-grade pgTAP harness is a Track B follow-up.

\set ON_ERROR_STOP on

begin;

-- Stash seeded identities in GUCs (psql vars don't interpolate into DO blocks).
select set_config('test.board_uid',     (select id::text from auth.users where email = 'annie.callam@umich.edu'), false);
select set_config('test.committee_uid', (select id::text from auth.users where email = 'committee.test@umich.edu'), false);
select set_config('test.member_uid',    (select id::text from auth.users where email = 'member.test@umich.edu'), false);
select set_config('test.cand_id',       (select id::text from public.candidates where per_cycle_seq = 1), false);
select set_config('test.rubric_id',     (select id::text from public.rubric_versions limit 1), false);
select set_config('test.board_mid',     (select id::text from public.members where email = 'annie.callam@umich.edu'), false);

-- Setup: a submitted scorecard by the board member on C01 (as superuser).
insert into public.score_submissions (candidate_id, evaluator_id, stage, rubric_version_id)
values (
  current_setting('test.cand_id')::uuid,
  current_setting('test.board_mid')::uuid,
  'applied',
  current_setting('test.rubric_id')::uuid
);

insert into public.scores (candidate_id, rubric_criterion_id, rubric_version_id, evaluator_id, stage, value)
select
  current_setting('test.cand_id')::uuid,
  rc.id,
  current_setting('test.rubric_id')::uuid,
  current_setting('test.board_mid')::uuid,
  'applied',
  4
from public.rubric_criteria rc
where rc.rubric_version_id = current_setting('test.rubric_id')::uuid;

-- ── 1. anon: no base-table access at all; public views readable ─────────────
set local role anon;

do $$
declare n int;
begin
  begin
    select count(*) into n from public.members;
    raise exception 'FAIL: anon read members';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.candidates;
    raise exception 'FAIL: anon read candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.audit_log;
    raise exception 'FAIL: anon read audit_log';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.v_team_public;
  assert n = 10, format('FAIL: anon v_team_public expected 10 rows, got %s', n);

  raise notice 'PASS: anon — base tables denied, v_team_public has 10 rows';
end $$;

reset role;

-- ── 2. general member: own row + public members; roster gated on open rush ──
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.member_uid'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.members;
  assert n = 11, format('FAIL: member sees %s members rows (expected 11: self + 10 public board)', n);

  select count(*) into n from public.candidates;
  assert n = 0, format('FAIL: member sees %s candidates base rows (expected 0)', n);

  select count(*) into n from public.v_candidate_roster;
  assert n = 0, format('FAIL: roster shows %s rows while open rush is OFF (expected 0)', n);

  select count(*) into n from public.scores;
  assert n = 0, format('FAIL: member sees %s scores (expected 0)', n);

  raise notice 'PASS: general member — 11 members, 0 candidates, 0 roster (rush off), 0 scores';
end $$;

reset role;
update public.recruitment_cycles set is_open_rush = true where name = 'Fall 2026';
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.member_uid'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.v_candidate_roster;
  assert n = 4, format('FAIL: roster shows %s rows with open rush ON (expected 4)', n);
  raise notice 'PASS: general member — roster shows 4 rows once open rush is on';
end $$;

reset role;

-- ── 3. committee: candidates visible; blind-until-submitted; no audit ────────
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.committee_uid'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.candidates;
  assert n = 4, format('FAIL: committee sees %s candidates (expected 4)', n);

  -- Blind: the board member''s submitted scores are invisible pre-submission.
  select count(*) into n from public.scores
   where candidate_id = current_setting('test.cand_id')::uuid;
  assert n = 0, format('FAIL: committee sees %s peer scores BEFORE submitting (expected 0)', n);

  select count(*) into n from public.audit_log;
  assert n = 0, format('FAIL: committee sees %s audit rows (expected 0)', n);

  -- Submit own scorecard for (C01, applied) → unlocks peers.
  insert into public.score_submissions (candidate_id, evaluator_id, stage, rubric_version_id)
  values (
    current_setting('test.cand_id')::uuid,
    public.current_member_id(),
    'applied',
    current_setting('test.rubric_id')::uuid
  );

  select count(*) into n from public.scores
   where candidate_id = current_setting('test.cand_id')::uuid;
  assert n = 4, format('FAIL: committee sees %s peer scores AFTER submitting (expected 4)', n);

  raise notice 'PASS: committee — 4 candidates, blind until submitted (0 → 4 scores), audit denied';
end $$;

reset role;

-- ── 4. board: full visibility ────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.board_uid'), 'role', 'authenticated')::text, true);

do $$
declare n int;
begin
  select count(*) into n from public.members;
  assert n = 12, format('FAIL: board sees %s members (expected 12)', n);

  select count(*) into n from public.audit_log;
  assert n > 0, 'FAIL: board sees no audit rows';

  select count(*) into n from public.scores;
  assert n = 4, format('FAIL: board sees %s scores (expected 4)', n);

  raise notice 'PASS: board — all members, audit trail, all scores';
end $$;

reset role;

-- ── 5. append-only enforcement (even as superuser) ───────────────────────────
do $$
begin
  begin
    update public.score_submissions set stage = 'interview'
     where candidate_id = current_setting('test.cand_id')::uuid;
    raise exception 'FAIL: score_submissions UPDATE was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  begin
    delete from public.score_submissions
     where candidate_id = current_setting('test.cand_id')::uuid;
    raise exception 'FAIL: score_submissions DELETE was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  raise notice 'PASS: append-only — score_submissions UPDATE/DELETE blocked';
end $$;

-- ── 6. signup gate: non-umich and non-allowlisted emails rejected ────────────
do $$
begin
  begin
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', 'intruder@gmail.com');
    raise exception 'FAIL: gmail signup was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  begin
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', 'not.invited@umich.edu');
    raise exception 'FAIL: non-allowlisted umich signup was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  raise notice 'PASS: signup gate — gmail and non-allowlisted umich rejected';
end $$;

rollback;

\echo 'RLS PHASE 0: ALL CHECKS PASSED (transaction rolled back)'
