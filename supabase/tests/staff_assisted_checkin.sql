begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(25);

select extensions.has_function(
  'rush', 'staff_assisted_check_in', array['text', 'text', 'text'],
  'staff-assisted check-in RPC exists'
);
select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.staff_assisted_check_in(text,text,text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'staff-assisted check-in is a hardened security definer'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.staff_assisted_check_in(text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.staff_assisted_check_in(text,text,text)', 'EXECUTE'),
  'only authenticated callers can invoke staff-assisted check-in'
);
select extensions.has_column('rush', 'checkins', 'checkin_method', 'check-ins record their method');
select extensions.has_column('rush', 'checkins', 'checked_in_by', 'check-ins record the assisting actor');
select extensions.has_column('rush', 'checkins', 'reason_code', 'check-ins record the assistance reason');

insert into auth.users(id, email, raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001', 'assisted-owner@example.invalid', '{"display_name":"Assisted owner"}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'assisted-member@example.invalid', '{"display_name":"Assisted member"}'::jsonb);

update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('20000000-0000-4000-8000-000000000011', 'Assisted active cycle', 'IN_PROCESS'),
  ('20000000-0000-4000-8000-000000000012', 'Assisted closed cycle', 'CLOSED');
insert into rush.memberships(user_id, cycle_id, role) values
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'OWNER'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000011', 'MEMBER');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('20000000-0000-4000-8000-000000000021', 'Primary Applicant', 'primary@umich.edu', 'primary@umich.edu', 'primary'),
  ('20000000-0000-4000-8000-000000000022', 'Ambiguous Applicant', 'primary', 'primary', 'second'),
  ('20000000-0000-4000-8000-000000000023', 'Other Cycle Applicant', 'other@umich.edu', 'other@umich.edu', 'othercycle'),
  ('20000000-0000-4000-8000-000000000024', 'Walk-up without application', 'walkup@umich.edu', 'walkup@umich.edu', 'walkup'),
  ('20000000-0000-4000-8000-000000000025', 'Withdrawn applicant', 'withdrawn@umich.edu', 'withdrawn@umich.edu', 'withdrawn');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('20000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000011', 'SUBMITTED', now()),
  ('20000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000011', 'SUBMITTED', now()),
  ('20000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000012', 'SUBMITTED', now()),
  ('20000000-0000-4000-8000-000000000034', '20000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000011', 'WITHDRAWN', now());

insert into rush.events(id, cycle_id, name, status, starts_at, ends_at, checkin_opens_at, checkin_closes_at, checkin_token_digest) values
  ('20000000-0000-4000-8000-000000000041', '20000000-0000-4000-8000-000000000011', 'Assisted event', 'PUBLISHED', now(), now() + interval '1 hour', now() - interval '10 minutes', now() + interval '70 minutes', repeat('4', 64)),
  ('20000000-0000-4000-8000-000000000042', '20000000-0000-4000-8000-000000000011', 'Closed check-in event', 'PUBLISHED', now() - interval '2 hours', now() - interval '1 hour', now() - interval '3 hours', now() - interval '1 hour', repeat('5', 64));

insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('20000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000011', 'SCREENING_ASSISTED', 'Assisted screening', 'DRAFT', 0);
insert into rush.rubrics(id, round_id, version) values
  ('20000000-0000-4000-8000-000000000052', '20000000-0000-4000-8000-000000000051', 1);
insert into rush.screening_batches(id, cycle_id, rubric_id, created_by) values
  ('20000000-0000-4000-8000-000000000053', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000052', '20000000-0000-4000-8000-000000000001');
insert into rush.screening_packets(id, batch_id, application_id, candidate_code, content, content_hash) values
  ('20000000-0000-4000-8000-000000000054', '20000000-0000-4000-8000-000000000053', '20000000-0000-4000-8000-000000000031', 'Applicant CODE01', '{}'::jsonb, repeat('6', 64));

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'primary@umich.edu', 'NO_CAMERA')$$,
  '42501', 'forbidden', 'a regular member cannot record assisted attendance'
);

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';
-- Festifall's later walk-up contract intentionally resolves people globally;
-- historical applications in another cycle do not prevent event attendance.
select extensions.is(
  rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'other@umich.edu', 'QR_FAILURE')->>'applicationId',
  null::text, 'a person from another cycle can attend as a walk-up without an application here'
);
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'primary', 'QR_FAILURE')$$,
  '22023', 'ambiguous applicant identifier', 'an identifier matching multiple active-cycle applicants is rejected'
);
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'primary@umich.edu', 'FREE_TEXT')$$,
  '22023', 'invalid assisted check-in details', 'free-form reason codes are rejected'
);
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000042', 'primary@umich.edu', 'NO_CAMERA')$$,
  '55000', 'check-in unavailable', 'staff cannot bypass a closed check-in window'
);

select extensions.is(
  rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'PRIMARY@UMICH.EDU', 'CONNECTIVITY_FAILURE') ->> 'duplicate',
  'false',
  'an authorized operator can check in an exact email case-insensitively'
);
set local role postgres;
select extensions.is((select checkin_method from rush.checkins where event_id = '20000000-0000-4000-8000-000000000041' and pnm_id = '20000000-0000-4000-8000-000000000021'), 'STAFF_ASSISTED', 'attendance records the staff-assisted method');
select extensions.is((select checked_in_by from rush.checkins where event_id = '20000000-0000-4000-8000-000000000041' and pnm_id = '20000000-0000-4000-8000-000000000021'), '20000000-0000-4000-8000-000000000001'::uuid, 'attendance records the operator');
select extensions.is((select reason_code from rush.checkins where event_id = '20000000-0000-4000-8000-000000000041' and pnm_id = '20000000-0000-4000-8000-000000000021'), 'CONNECTIVITY_FAILURE', 'attendance records the bounded reason');
select extensions.ok(exists(
  select 1 from rush.audit_events
  where cycle_id = '20000000-0000-4000-8000-000000000011'
    and action = 'APPLICANT_STAFF_ASSISTED_CHECKIN'
    and actor_id = '20000000-0000-4000-8000-000000000001'::uuid
    and metadata ->> 'reasonCode' = 'CONNECTIVITY_FAILURE'
), 'the assisted check-in is actor-audited');

set local role authenticated;
select extensions.is(
  rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'Applicant CODE01', 'QR_FAILURE') ->> 'duplicate',
  'true',
  'the exact applicant code resolves and a duplicate request is safe'
);
set local role postgres;
select extensions.is((select count(*) from rush.checkins where event_id = '20000000-0000-4000-8000-000000000041' and pnm_id = '20000000-0000-4000-8000-000000000021'), 1::bigint, 'a duplicate request creates no second attendance row');
select extensions.is((select count(*) from rush.audit_events where action = 'APPLICANT_STAFF_ASSISTED_CHECKIN' and resource_id = (select id from rush.checkins where event_id = '20000000-0000-4000-8000-000000000041' and pnm_id = '20000000-0000-4000-8000-000000000021')), 1::bigint, 'a duplicate request creates no second audit event');
select extensions.is((select count(*) from rush.event_impressions where event_id = '20000000-0000-4000-8000-000000000041'), 0::bigint, 'assisted attendance does not create or change scoring evidence');

set local role authenticated;
select extensions.is(
  rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'walkup@umich.edu', 'SIGN_IN_UNAVAILABLE')->>'applicationId',
  null::text, 'a known person with no application can check in through the staffed fallback'
);
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'withdrawn@umich.edu', 'QR_FAILURE')$$,
  'P0002', 'applicant missing', 'a withdrawn application in this cycle still blocks assisted attendance'
);
select extensions.throws_ok(
  $$select rush.staff_assisted_check_in('20000000-0000-4000-8000-000000000041', 'unknown@umich.edu', 'QR_FAILURE')$$,
  'P0002', 'applicant missing', 'an unmatched identity does not create a person or attendance'
);
set local role postgres;
select extensions.is((select count(*) from rush.checkins where event_id='20000000-0000-4000-8000-000000000041'),3::bigint,'primary and both valid walk-ups each have one attendance row');
select extensions.is((select count(*) from rush.applications where pnm_id='20000000-0000-4000-8000-000000000024'),0::bigint,'assisted walk-up does not fabricate an application');

select * from extensions.finish();
rollback;
