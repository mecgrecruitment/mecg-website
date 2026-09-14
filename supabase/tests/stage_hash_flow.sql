-- A GROUP_CASE stage hash from open to close: the ballot is empty until the
-- board opens the stage, only OWNER/BOARD can open it, the ballot lists exactly
-- the GROUP_CASE applicants minus the voter's conflicts, votes upsert per
-- (application, voter, stage), the tally and notes are board-only and carry no
-- voter identity, a YES majority moves the applicant to IN_PROCESS while a NO
-- majority or a tie rejects, applying takes the applicant off the ballot, the
-- bulk apply picks up whatever else reached quorum, and closing empties the
-- ballot without deleting the votes.
begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(31);

insert into auth.users(id, email, raw_user_meta_data) values
  ('40000000-0000-4000-8000-000000000001', 'sh-owner@example.invalid', '{"display_name":"Stage hash owner"}'::jsonb),
  ('40000000-0000-4000-8000-000000000002', 'sh-member-one@example.invalid', '{"display_name":"Stage hash member one"}'::jsonb),
  ('40000000-0000-4000-8000-000000000003', 'sh-member-two@example.invalid', '{"display_name":"Stage hash member two"}'::jsonb),
  ('40000000-0000-4000-8000-000000000004', 'sh-member-three@example.invalid', '{"display_name":"Stage hash member three"}'::jsonb),
  ('40000000-0000-4000-8000-000000000005', 'sh-committee@example.invalid', '{"display_name":"Stage hash committee"}'::jsonb);

-- rush_cycles_one_non_terminal_idx allows one live cycle at a time.
update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('40000000-0000-4000-8000-000000000011', 'Stage hash open cycle', 'OPEN');
insert into rush.memberships(user_id, cycle_id, role) values
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000011', 'OWNER'),
  ('40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('40000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000011', 'RECRUITMENT_COMMITTEE');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('40000000-0000-4000-8000-000000000021', 'Alpha Applicant', 'shalpha@umich.edu', 'shalpha@umich.edu', 'shalpha'),
  ('40000000-0000-4000-8000-000000000022', 'Bravo Applicant', 'shbravo@umich.edu', 'shbravo@umich.edu', 'shbravo'),
  ('40000000-0000-4000-8000-000000000023', 'Charlie Applicant', 'shcharlie@umich.edu', 'shcharlie@umich.edu', 'shcharlie'),
  ('40000000-0000-4000-8000-000000000024', 'Delta Applicant', 'shdelta@umich.edu', 'shdelta@umich.edu', 'shdelta'),
  ('40000000-0000-4000-8000-000000000025', 'Echo Applicant', 'shecho@umich.edu', 'shecho@umich.edu', 'shecho');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('40000000-0000-4000-8000-000000000031', '40000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('40000000-0000-4000-8000-000000000032', '40000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('40000000-0000-4000-8000-000000000033', '40000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('40000000-0000-4000-8000-000000000034', '40000000-0000-4000-8000-000000000024', '40000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('40000000-0000-4000-8000-000000000035', '40000000-0000-4000-8000-000000000025', '40000000-0000-4000-8000-000000000011', 'INVITED', now());
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('40000000-0000-4000-8000-000000000051', '40000000-0000-4000-8000-000000000011', 'GROUP_CASE', 'Group Case', 'ACTIVE', 40);
insert into rush.conflict_declarations(application_id, declarer_id, reason) values
  ('40000000-0000-4000-8000-000000000031', '40000000-0000-4000-8000-000000000004', 'Roommate');

-- 1. Nothing open yet, as MEMBER 1
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.is(
  (select count(*) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  0::bigint, 'the ballot is empty before a stage is open'
);
select extensions.throws_ok(
  $$select rush.cast_hash_vote('40000000-0000-4000-8000-000000000031', 'YES', '')$$,
  '55000', 'voting is not open', 'a vote before a stage is open is rejected'
);
select extensions.throws_ok(
  $$select rush.open_hash_stage('40000000-0000-4000-8000-000000000011', 'GROUP_CASE', 2)$$,
  '42501', 'forbidden', 'a member cannot open a stage hash'
);

-- 2. OWNER opens Group Case with quorum 2
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';
select rush.open_hash_stage('40000000-0000-4000-8000-000000000011', 'GROUP_CASE', 2);
select extensions.is(rush.current_hash_stage('40000000-0000-4000-8000-000000000011'), 'GROUP_CASE', 'the owner opens the Group Case hash');
set local role postgres;
select extensions.is(
  (select hash_quorum from rush.rush_cycles where id = '40000000-0000-4000-8000-000000000011'),
  2, 'opening stores the quorum on the cycle'
);
set local role authenticated;
select extensions.throws_ok(
  $$select rush.open_hash_stage('40000000-0000-4000-8000-000000000011', 'GROUP_CASE', 2)$$,
  '55000', 'a hash is already open', 'opening a second stage while one is open is refused'
);

-- 3. Ballots
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(
  (select count(*) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  4::bigint, 'member one sees the four Group Case applicants'
);
select extensions.is(
  (select array_agg(name order by name) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  array['Alpha Applicant', 'Bravo Applicant', 'Charlie Applicant', 'Delta Applicant'],
  'the ballot lists Group Case applicants only, not the INVITED one'
);
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.is(
  (select array_agg(id order by id) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  array['40000000-0000-4000-8000-000000000032', '40000000-0000-4000-8000-000000000033', '40000000-0000-4000-8000-000000000034'],
  'a declared conflict hides Alpha from member three'
);
select extensions.throws_ok(
  $$select rush.cast_hash_vote('40000000-0000-4000-8000-000000000031', 'YES', '')$$,
  '42501', 'conflict declared for this applicant', 'a declared conflict blocks voting'
);

-- 4. Votes
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000031', 'YES', 'first note');
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000032', 'NO', '');
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000033', 'YES', '');
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000034', 'YES', '');
select extensions.ok(
  rush.cast_hash_vote('40000000-0000-4000-8000-000000000031', 'YES', 'second note'),
  'a member can change their vote while the stage is open'
);
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}';
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000031', 'YES', 'strong at the table');
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000032', 'NO', '');
select rush.cast_hash_vote('40000000-0000-4000-8000-000000000033', 'NO', '');
select extensions.ok(
  exists (select 1 from rush.hash_stage_rule('GROUP_CASE') r where 'RECRUITMENT_COMMITTEE'::rush.member_role = any(r.voter_roles)),
  'the Group Case rule admits the recruitment committee'
);
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000005';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000005","role":"authenticated"}';
select extensions.ok(
  rush.cast_hash_vote('40000000-0000-4000-8000-000000000034', 'YES', ''),
  'a recruitment committee member can vote at Group Case'
);
set local role postgres;
select extensions.is(
  (select count(*) from rush.hash_votes where application_id = '40000000-0000-4000-8000-000000000031' and voter_id = '40000000-0000-4000-8000-000000000002' and stage = 'GROUP_CASE'),
  1::bigint, 'recasting keeps one row per applicant, voter and stage'
);
select extensions.is(
  (select note from rush.hash_votes where application_id = '40000000-0000-4000-8000-000000000031' and voter_id = '40000000-0000-4000-8000-000000000002' and stage = 'GROUP_CASE'),
  'second note', 'recasting updates the note'
);

-- 5. Tally and notes are board-only
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok(
  $$select rush.hash_tally('40000000-0000-4000-8000-000000000011')$$,
  '42501', 'board role required', 'a member cannot read the tally'
);
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is(
  (select (yes_count, no_count, total_votes, quorum, outcome)::text from rush.hash_tally('40000000-0000-4000-8000-000000000011') where application_id = '40000000-0000-4000-8000-000000000031'),
  '(2,0,2,2,OFFER)', 'Alpha tallies two yes at quorum'
);
select extensions.is(
  (select (yes_count, no_count, total_votes, outcome)::text from rush.hash_tally('40000000-0000-4000-8000-000000000011') where application_id = '40000000-0000-4000-8000-000000000032'),
  '(0,2,2,REJECT)', 'Bravo tallies two no'
);
select extensions.is(
  (select (yes_count, no_count, total_votes, outcome)::text from rush.hash_tally('40000000-0000-4000-8000-000000000011') where application_id = '40000000-0000-4000-8000-000000000033'),
  '(1,1,2,REJECT)', 'Charlie ties and reads as a reject'
);
select extensions.is(
  (select (yes_count, no_count, total_votes, outcome)::text from rush.hash_tally('40000000-0000-4000-8000-000000000011') where application_id = '40000000-0000-4000-8000-000000000034'),
  '(2,0,2,OFFER)', 'Delta counts the committee vote'
);
select extensions.ok(
  exists (select 1 from rush.hash_notes('40000000-0000-4000-8000-000000000011') where application_id = '40000000-0000-4000-8000-000000000031' and note = 'strong at the table'),
  'the owner reads the Alpha note'
);
select extensions.is(
  (select array_agg(distinct k) from rush.hash_notes('40000000-0000-4000-8000-000000000011') n, jsonb_object_keys(to_jsonb(n)) k),
  array['application_id', 'note'], 'notes expose no voter column'
);

-- 6. Applying results
select extensions.is(rush.apply_stage_hash_result('40000000-0000-4000-8000-000000000031'), 'IN_PROCESS', 'a yes majority moves Alpha to IN_PROCESS');
select extensions.is(rush.apply_stage_hash_result('40000000-0000-4000-8000-000000000032'), 'REJECTED', 'a no majority rejects Bravo');
select extensions.is(rush.apply_stage_hash_result('40000000-0000-4000-8000-000000000033'), 'REJECTED', 'a tie rejects Charlie');
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(
  (select array_agg(id) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  array['40000000-0000-4000-8000-000000000034'], 'applied applicants drop off the ballot'
);
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is(rush.apply_stage_hash_results('40000000-0000-4000-8000-000000000011'), 1, 'the bulk apply moves the one remaining applicant at quorum');
set local role postgres;
select extensions.is(
  (select status::text from rush.applications where id = '40000000-0000-4000-8000-000000000034'),
  'IN_PROCESS', 'the bulk apply moves Delta to IN_PROCESS'
);

-- 7. Closing keeps the votes
set local role authenticated;
select rush.close_hash_stage('40000000-0000-4000-8000-000000000011');
select extensions.is(rush.current_hash_stage('40000000-0000-4000-8000-000000000011'), null, 'closing clears the open stage');
set local "request.jwt.claim.sub" = '40000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(
  (select count(*) from rush.hash_ballot('40000000-0000-4000-8000-000000000011')),
  0::bigint, 'the ballot is empty after closing'
);
set local role postgres;
select extensions.is(
  (select count(*) from rush.hash_votes where cycle_id = '40000000-0000-4000-8000-000000000011' and stage = 'GROUP_CASE'),
  8::bigint, 'closing keeps every vote'
);

select * from extensions.finish();
rollback;
