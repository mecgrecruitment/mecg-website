-- Behavioral replacement for the obsolete frozen-output source-string assertion.
-- The September explicit release gate superseded name-stripped result copies.
begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(12);
insert into auth.users(id,email,raw_user_meta_data) values
 ('89000000-0000-4000-8000-000000000001','sv-owner@example.invalid','{"display_name":"Visibility owner"}'),
 ('89000000-0000-4000-8000-000000000002','sv-board@example.invalid','{"display_name":"Visibility board"}'),
 ('89000000-0000-4000-8000-000000000003','sv-committee@example.invalid','{"display_name":"Visibility committee"}'),
 ('89000000-0000-4000-8000-000000000004','sv-member@example.invalid','{"display_name":"Visibility member"}'),
 ('89000000-0000-4000-8000-000000000005','sv-reader@example.invalid','{"display_name":"Synthetic reader"}');
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values ('sv-cycle','Visibility test','OPEN');
insert into rush.memberships(user_id,cycle_id,role) values
 ('89000000-0000-4000-8000-000000000001','sv-cycle','OWNER'),
 ('89000000-0000-4000-8000-000000000002','sv-cycle','BOARD'),
 ('89000000-0000-4000-8000-000000000003','sv-cycle','RECRUITMENT_COMMITTEE'),
 ('89000000-0000-4000-8000-000000000004','sv-cycle','MEMBER');
insert into rush.pnms(id,name,contact,normalized_contact,uniqname) values ('sv-pnm','Synthetic applicant','sv-applicant@example.invalid','sv-applicant@example.invalid','svapplicant');
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at) values ('sv-app','sv-pnm','sv-cycle','SUBMITTED',now());
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values ('sv-round','sv-cycle','APPLICATION_SCREEN','Written review','FROZEN',0);
insert into rush.rubrics(id,round_id,version) values ('sv-rubric','sv-round',1);
insert into rush.rubric_criteria(id,rubric_id,key,name,description,weight,required,position) values ('sv-criterion','sv-rubric','reasoning','Reasoning','Synthetic criterion',100,true,0);
insert into rush.screening_batches(id,cycle_id,rubric_id,status,created_by) values ('sv-batch','sv-cycle','sv-rubric','FROZEN','89000000-0000-4000-8000-000000000001');
insert into rush.screening_packets(id,batch_id,application_id,candidate_code,content,content_hash) values ('sv-packet','sv-batch','sv-app','SV01','{"responses":[{"question":"Test","answer":"Synthetic answer"}]}','fixture');
insert into rush.screening_assignments(id,packet_id,reviewer_id,status) values ('sv-assignment','sv-packet','89000000-0000-4000-8000-000000000005','LOCKED');
insert into rush.screening_reviews(id,assignment_id,reviewer_id,recommendation,evidence,score) values ('sv-review','sv-assignment','89000000-0000-4000-8000-000000000005','ADVANCE','Synthetic review evidence sufficient for a test.',75);
insert into rush.screening_ratings(review_id,criterion_id,score,note) values ('sv-review','sv-criterion',4,'Synthetic private rating note');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000001';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(jsonb_array_length(rush.screening_admin_overview('sv-cycle')->'results'),1,'owner can inspect frozen results before release');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000002';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results','[]'::jsonb,'board cannot inspect unreleased results');
select extensions.throws_ok($$select rush.release_screening_results('sv-batch')$$,'42501','forbidden','board cannot release screening results');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000003';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results','[]'::jsonb,'committee cannot inspect unreleased results');
select extensions.ok(not ((rush.screening_admin_overview('sv-cycle')->'packets'->0) ?| array['applicantName','content','assignments']),'unreleased frozen packets omit identifying content for committee');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000001';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.lives_ok($$select rush.release_screening_results('sv-batch')$$,'owner explicitly releases frozen results');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000002';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results'->0->>'applicantName','Synthetic applicant','board sees released applicant identity');
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results'->0->>'reviewerName','Synthetic reader','board sees released reviewer identity');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000003';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results'->0->>'evidence','Synthetic review evidence sufficient for a test.','committee receives evidence only after explicit release');
select extensions.is(rush.screening_admin_overview('sv-cycle')->'results'->0->'ratings'->0->>'note','Synthetic private rating note','committee receives notes after explicit release');
set local "request.jwt.claim.sub"='89000000-0000-4000-8000-000000000004';
set local "request.jwt.claims"='{"iss":"http://127.0.0.1:54321/auth/v1","sub":"89000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.ok(rush.screening_admin_overview('sv-cycle') is null,'ordinary members cannot inspect the admin overview after release');
set local role postgres;
select extensions.is((select count(*) from rush.audit_events where cycle_id='sv-cycle' and action='SCREENING_RESULTS_RELEASED'),1::bigint,'explicit release records one audit event');
select * from extensions.finish();
rollback;
