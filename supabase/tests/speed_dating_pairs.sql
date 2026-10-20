begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(35);

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
-- PostgreSQL normalizes BETWEEN checks into >= / <= expressions. Exercise
-- actual boundary values and the guarded operator RPC instead of SQL spelling.
insert into auth.users(id,email,raw_user_meta_data) values
 ('53000000-0000-4000-8000-000000000001','group-owner@example.invalid','{}'),
 ('53000000-0000-4000-8000-000000000002','group-member@example.invalid','{}');
insert into rush.auth_identities(issuer,subject,app_user_id) values
 ('http://127.0.0.1:54321/auth/v1','53000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002') on conflict(issuer,subject) do nothing;
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('pair-behavior-cycle','Group contract fixture','IN_PROCESS');
insert into rush.memberships(user_id,cycle_id,role) values
 ('53000000-0000-4000-8000-000000000001','pair-behavior-cycle','OWNER'),
 ('53000000-0000-4000-8000-000000000002','pair-behavior-cycle','MEMBER');
insert into rush.pnms(id,name,contact,normalized_contact)
 select 'pair-person'||n,'Synthetic person '||n,'pair'||n||'@example.invalid','pair'||n||'@example.invalid' from generate_series(1,6) n;
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at)
 select 'pair-app'||n,'pair-person'||n,'pair-behavior-cycle',
 case when n=5 then 'WITHDRAWN'::rush.application_status when n=6 then 'DRAFT'::rush.application_status else 'INVITED'::rush.application_status end,now()
 from generate_series(1,6) n;
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values('pair-behavior-round','pair-behavior-cycle','SPEED_DATING','Behavior fixture','ACTIVE',100);
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('pair-behavior-rubric','pair-behavior-round',1,1);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values('pair-behavior-criterion','pair-behavior-rubric','rating','Observed rating',100,true,0);
insert into rush.round_participations(round_id,application_id,rubric_id,required_evaluators,assignment_policy,advanced_by)
 select 'pair-behavior-round','pair-app'||n,'pair-behavior-rubric',2,'{}'::jsonb,'53000000-0000-4000-8000-000000000001' from generate_series(1,6) n;
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id)
 values('pair-behavior-round','pair-behavior-rubric','53000000-0000-4000-8000-000000000002');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"53000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.lives_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app1'],1,1)$$,'a single applicant group is allowed');
select extensions.lives_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app1','pair-app2','pair-app3'],2,2)$$,'a three-applicant group is allowed');
select extensions.throws_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app1','pair-app2','pair-app3','pair-app4'],1,1)$$,'22023','a group needs one to three different applicants','four applicants cannot enter one group');
select extensions.throws_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app1','pair-app1'],1,1)$$,'22023','a group needs one to three different applicants','duplicate identities cannot occupy two seats');
select extensions.throws_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app5'],1,1)$$,'22023','every applicant must be advanced into this round','withdrawal invalidates an old participation row');
select extensions.throws_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app6'],1,1)$$,'22023','every applicant must be advanced into this round','draft status cannot be treated as current enrollment');
select extensions.throws_ok($$select rush.start_speed_dating_group('pair-behavior-round',array['pair-app4'],1,100)$$,'22023','table must be between 1 and 99','table boundaries remain enforced');
set local role postgres;
select extensions.is((select count(*) from rush.speed_dating_pair_members where round_id='pair-behavior-round' and position=3),1::bigint,'the third applicant receives seat three');
select extensions.is((select count(*) from rush.speed_dating_pairs where round_id='pair-behavior-round'),2::bigint,'rejected requests create no partial groups');
select extensions.throws_ok($$update rush.speed_dating_pair_members set position=4 where round_id='pair-behavior-round' and position=3$$,'23514',null,'the physical seat constraint rejects seat four');
select extensions.is((select count(*) from rush.evaluation_assignments where round_id='pair-behavior-round' and application_id in ('pair-app5','pair-app6')),0::bigint,'ineligible applicants receive no grading assignment');
select extensions.is((select count(*) from rush.audit_events where cycle_id='pair-behavior-cycle' and action='SPEED_DATING_GROUP_STARTED'),2::bigint,'only successful group starts are audited');

select * from extensions.finish();
rollback;
