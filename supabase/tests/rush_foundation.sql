begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(188);
select extensions.has_schema('rush', 'rush schema exists');
select extensions.has_table('rush','profiles','profiles table exists');
select extensions.has_table('rush','rush_cycles','cycles table exists');
select extensions.has_table('rush','applications','applications table exists');
select extensions.has_table('rush','evaluations','evaluations table exists');
select extensions.has_table('rush','audit_events','audit table exists');
select extensions.has_table('rush','application_questions','intake questions exist');
select extensions.has_table('rush','application_responses','intake responses exist');
select extensions.ok(exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'rush' and t.typname = 'member_role' and e.enumlabel = 'RECRUITMENT_COMMITTEE'), 'committee role exists');
select extensions.has_function('rush','has_cycle_capability',array['text','text'],'capability helper exists');
select extensions.has_function('rush','submit_application',array['text','text','text','text','text','text','text','text','jsonb','boolean','text','text','text','text'],'application function exists');
select extensions.has_function('rush','submit_evaluation',array['text','jsonb','text'],'evaluation function exists');
select extensions.has_function('rush','declare_conflict',array['text','text'],'conflict function exists');
select extensions.has_function('rush','create_decision',array['text','text','rush.decision_outcome','text'],'decision function exists');
select extensions.has_function('rush','approve_decision',array['text'],'approval function exists');
select extensions.has_function('rush','release_decision',array['text'],'release function exists');
select extensions.has_function('rush','set_application_status',array['text','rush.application_status'],'status function exists');
select extensions.has_function('rush','create_event_slot',array['text','timestamptz','timestamptz','integer'],'event slot function exists');
select extensions.has_function('rush','rotate_event_token',array['text'],'token rotation function exists');
select extensions.has_function('rush','create_case_group',array['text','text','text'],'case group function exists');
select extensions.has_function('rush','assign_case_group',array['text','text'],'case assignment function exists');
select extensions.has_function('rush','set_decision_preview',array['text','text'],'decision preview function exists');
select extensions.has_table('rush','application_documents','resume document lifecycle table exists');
select extensions.has_function('rush','begin_resume_upload',array['text','integer'],'resume upload start function exists');
select extensions.has_function('rush','pending_resume_upload',array['text'],'pending resume lookup exists');
select extensions.has_function('rush','finalize_resume_upload',array['text','integer','text','integer'],'resume finalization function exists');
select extensions.has_function('rush','reject_resume_upload',array['text','text'],'resume rejection function exists');
select extensions.has_function('rush','my_ready_resume',array['text'],'applicant ready-resume lookup exists');
select extensions.has_function('rush','authorize_resume_access',array['text'],'internal resume authorization exists');
select extensions.has_function('rush','create_screening_batch',array['text','uuid[]'],'screening batch function exists');
select extensions.has_function('rush','screening_admin_overview',array['text'],'screening overview function exists');
select extensions.has_function('rush','freeze_screening_batch',array['text'],'screening freeze function exists');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='has_cycle_capability' and p.prosecdef and p.proconfig @> array['search_path=""']), 'capability helper is security definer with empty search path');
select extensions.ok(position('rubric_criteria' in pg_get_functiondef('rush.create_screening_batch(text,uuid[])'::regprocedure)) > 0, 'screening batch inserts default criteria');
select extensions.ok(position('invalid response content' in pg_get_functiondef('rush.update_screening_packet_content(text,jsonb)'::regprocedure)) > 0, 'screening response validation exists');
select extensions.ok(position('proposal contains an ineligible assignment' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'screening assignment eligibility validation exists');
select extensions.ok(position('reviewer capacity exceeded' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'screening capacity validation exists');
select extensions.ok(position('three submitted reviews are required' in pg_get_functiondef('rush.freeze_screening_batch(text)'::regprocedure)) > 0, 'screening freeze completeness validation exists');
select extensions.ok(position('jsonb_build_object(''assignments'',inserted_count)' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'distribution audit includes assignment count');
select extensions.ok(position('FINAL_REVIEW' in pg_get_functiondef('rush.set_application_status(text,rush.application_status)'::regprocedure)) > 0 and position('next_status=''DRAFT''' in pg_get_functiondef('rush.set_application_status(text,rush.application_status)'::regprocedure)) = 0, 'application transition graph is forward-only');
select extensions.ok(position('is_active_screening_reviewer' in pg_get_functiondef('rush.member_applicants(text)'::regprocedure)) > 0, 'active screening reviewers are excluded from applicants');
select extensions.ok(position('NOT rush.is_active_screening_reviewer(cycle_id)' in pg_get_expr((select polqual from pg_policy where polname='applications_read_internal' and polrelid='rush.applications'::regclass),'rush.applications'::regclass)) > 0, 'application access excludes active reviewers');
select extensions.ok(position('NOT rush.is_active_screening_reviewer(cycle_id)' in pg_get_expr((select polqual from pg_policy where polname='applications_read_internal' and polrelid='rush.applications'::regclass),'rush.applications'::regclass)) > 0 and position('actor_has_application_conflict' in pg_get_expr((select polqual from pg_policy where polname='applications_read_internal' and polrelid='rush.applications'::regclass),'rush.applications'::regclass)) > 0, 'evaluator access preserves reviewer and conflict guards');
select extensions.ok(position('invalid assignment identifiers' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0 and position('22023' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'assignment identifiers validate before UUID casts');
select extensions.ok(position('duplicate assignment proposal' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'duplicate packet reviewer pairs are rejected');
select extensions.ok(position('jsonb_typeof(x->''question'')<>''string''' in pg_get_functiondef('rush.update_screening_packet_content(text,jsonb)'::regprocedure)) > 0 and position('char_length(trim(x->>''question''))=0' in pg_get_functiondef('rush.update_screening_packet_content(text,jsonb)'::regprocedure)) > 0, 'packet responses require non-empty strings');
select extensions.ok(position('required_count' in pg_get_functiondef('rush.freeze_screening_batch(text)'::regprocedure)) > 0 and position('<>3' in pg_get_functiondef('rush.freeze_screening_batch(text)'::regprocedure)) = 0, 'screening freeze uses batch review count');
select extensions.ok(position('slot outside event bounds' in pg_get_functiondef('rush.create_event_slot(text,timestamptz,timestamptz,integer)'::regprocedure)) > 0 and position('between 1 and 80' in pg_get_functiondef('rush.create_event_slot(text,timestamptz,timestamptz,integer)'::regprocedure)) > 0, 'event slots enforce event bounds and table capacity');
select extensions.ok(position('array[''applicantName'',''evidence'']' in pg_get_functiondef('rush.screening_admin_overview(text)'::regprocedure)) > 0 and position('b.status=''FROZEN''' in pg_get_functiondef('rush.screening_admin_overview(text)'::regprocedure)) > 0, 'frozen screening output redacts committee identity and evidence');
select extensions.ok(position('CLOSED' in pg_get_functiondef('rush.has_cycle_capability(text,text)'::regprocedure)) > 0 and position('ARCHIVED' in pg_get_functiondef('rush.has_cycle_capability(text,text)'::regprocedure)) > 0 and position('ROUND_COORDINATION' in pg_get_functiondef('rush.has_cycle_capability(text,text)'::regprocedure)) = 0 and position('ATTENDANCE_EXPORT' in pg_get_functiondef('rush.has_cycle_capability(text,text)'::regprocedure)) = 0 and position('DECISION_PREVIEW' in pg_get_functiondef('rush.has_cycle_capability(text,text)'::regprocedure)) = 0, 'committee capabilities end for closed cycles and exclude transitions, export, and preview');
select extensions.ok(position('has_cycle_role' in pg_get_functiondef('rush.set_round_status(text,rush.round_status)'::regprocedure)) > 0 and position('ROUND_COORDINATION' in pg_get_functiondef('rush.set_round_status(text,rush.round_status)'::regprocedure)) = 0, 'round transitions retain strict board authorization');
select extensions.ok(position('has_cycle_role' in pg_get_functiondef('rush.export_attendance(text)'::regprocedure)) > 0 and position('has_cycle_capability' in pg_get_functiondef('rush.export_attendance(text)'::regprocedure)) = 0, 'attendance export retains strict board authorization');
select extensions.ok(position('has_cycle_role' in pg_get_functiondef('rush.set_decision_preview(text,text)'::regprocedure)) > 0 and position('DECISION_PREVIEW' in pg_get_functiondef('rush.set_decision_preview(text,text)'::regprocedure)) = 0, 'decision preview retains strict panel authorization');
select extensions.ok(position('resource' in pg_get_expr((select polqual from pg_policy where polname='audit_events_read_internal' and polrelid='rush.audit_events'::regclass),'rush.audit_events'::regclass)) > 0 and position('''Decision''' in pg_get_expr((select polqual from pg_policy where polname='audit_events_read_internal' and polrelid='rush.audit_events'::regclass),'rush.audit_events'::regclass)) = 0 and position('''Evaluation''' in pg_get_expr((select polqual from pg_policy where polname='audit_events_read_internal' and polrelid='rush.audit_events'::regclass),'rush.audit_events'::regclass)) = 0, 'committee audit policy excludes decision and evaluation evidence');
select extensions.ok(position('m.role=''MEMBER''' in pg_get_functiondef('rush.is_eligible_screening_reviewer(text,uuid)'::regprocedure)) > 0 and position('RECRUITMENT_COMMITTEE' in pg_get_functiondef('rush.is_eligible_screening_reviewer(text,uuid)'::regprocedure)) > 0 and position('not exists' in lower(pg_get_functiondef('rush.is_eligible_screening_reviewer(text,uuid)'::regprocedure))) > 0, 'screening eligibility requires active member status without a privileged role');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.is_active_screening_reviewer(text)'::regprocedure)) > 0, 'active screening reviewer rechecks current role eligibility');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.my_screening_queue(text)'::regprocedure)) > 0, 'reviewer queue rechecks current role eligibility');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.screening_assignment_detail(text)'::regprocedure)) > 0, 'reviewer detail rechecks current role eligibility');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.submit_screening_review(text,jsonb,text,text)'::regprocedure)) > 0, 'review submission rechecks current role eligibility');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.recuse_screening_assignment(text,text)'::regprocedure)) > 0, 'reviewer recusal rechecks current role eligibility');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.screening_assignment_inputs(text)'::regprocedure)) > 0, 'assignment inputs exclude reviewers whose roles changed');
select extensions.ok(position('is_eligible_screening_reviewer' in pg_get_functiondef('rush.commit_screening_assignments(text,jsonb,text,jsonb)'::regprocedure)) > 0, 'assignment commit rejects reviewers whose roles changed');
select extensions.ok(position('update rush.applications' in pg_get_functiondef('rush.approve_decision(text)'::regprocedure)) = 0 and position('LOCKED' in pg_get_functiondef('rush.approve_decision(text)'::regprocedure)) > 0, 'decision approval locks without exposing the application outcome');
select extensions.ok(position('update rush.applications' in pg_get_functiondef('rush.release_decision(text)'::regprocedure)) > 0 and position('OFFERED' in pg_get_functiondef('rush.release_decision(text)'::regprocedure)) > 0 and position('RELEASED' in pg_get_functiondef('rush.release_decision(text)'::regprocedure)) > 0, 'decision release atomically applies the application outcome');
select extensions.ok(position('has_cycle_capability' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0 and position('RECRUITMENT_COMMITTEE' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0, 'committee colleague profiles follow active-cycle capability');
select extensions.ok(position('c.event_id=e.id' in pg_get_functiondef('rush.export_attendance(text)'::regprocedure)) > 0 and position('BOARD' in pg_get_functiondef('rush.export_attendance(text)'::regprocedure)) > 0, 'attendance export counts only events in the target cycle and remains board-only');
select extensions.has_function('rush','grant_membership',array['uuid','text','rush.member_role'],'membership grant function retains its signature');
select extensions.ok(position('screening_reviewers' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('screening_batches' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('sr.reviewer_id=target_user_id' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('b.cycle_id=target_cycle_id' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership grants reject any screening reviewer from the same cycle');
select extensions.ok(position('RECRUITMENT_COMMITTEE' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('BOARD' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('PANEL' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('OWNER' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0, 'reviewer guard covers every privileged role');
select extensions.ok(position('has_cycle_role(target_cycle_id,array[''OWNER'']' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership grants remain owner-only');
select extensions.ok(position('auth.uid()=target_user_id' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('self grant forbidden' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership grants retain self-grant protection');
select extensions.ok(position('MEMBERSHIP_GRANTED' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('audit_events' in pg_get_functiondef('rush.grant_membership(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership grants retain audit logging');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='grant_membership' and p.prosecdef and p.proconfig @> array['search_path=""']), 'membership grants remain security definer with empty search path');
select extensions.has_function('rush','set_membership_role',array['uuid','text','rush.member_role'],'membership role function exists');
select extensions.ok(exists(select 1 from pg_proc p where p.oid='rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']), 'membership role changes are security definer with empty search path');
select extensions.ok(has_function_privilege('authenticated','rush.set_membership_role(uuid,text,rush.member_role)','EXECUTE') and not has_function_privilege('anon','rush.set_membership_role(uuid,text,rush.member_role)','EXECUTE'), 'membership role ACL excludes anonymous callers');
select extensions.ok(position('owner required' in pg_get_functiondef('rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure)) > 0 and position('self role change forbidden' in pg_get_functiondef('rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership role changes remain owner-only and reject self-promotion');
select extensions.ok(position('screening reviewer cannot receive a privileged role' in pg_get_functiondef('rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership role changes protect screening independence');
select extensions.ok(position('cycle must retain an owner' in pg_get_functiondef('rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership role changes preserve a cycle owner');
select extensions.ok(position('MEMBERSHIP_ROLE_CHANGED' in pg_get_functiondef('rush.set_membership_role(uuid,text,rush.member_role)'::regprocedure)) > 0, 'membership role changes retain audit logging');
select extensions.ok(position('committee.role' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0 and position('RECRUITMENT_COMMITTEE' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0 and position('CLOSED' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0 and position('ARCHIVED' in pg_get_functiondef('rush.actor_can_read_colleague_profile(uuid)'::regprocedure)) > 0, 'closed-cycle committee membership restricts additive member profile access');
select extensions.ok(position('CANDIDATE_ACCESS' in pg_get_functiondef('rush.board_can_view_resume(text)'::regprocedure)) > 0 and position('PANEL' in pg_get_functiondef('rush.board_can_view_resume(text)'::regprocedure)) > 0 and position('actor_has_application_conflict' in pg_get_functiondef('rush.board_can_view_resume(text)'::regprocedure)) > 0, 'resume access supports active-cycle operators and panel while preserving recusal');
select extensions.ok((select p.prosecdef and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner)='postgres' from pg_proc p where p.oid='rush.actor_can_read_colleague_profile(uuid)'::regprocedure) and (select p.prosecdef and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner)='postgres' from pg_proc p where p.oid='rush.create_cycle(text)'::regprocedure), 'authorization functions are postgres-owned security definers with empty search paths');
select extensions.ok(has_function_privilege('authenticated','rush.actor_can_read_colleague_profile(uuid)','EXECUTE') and not has_function_privilege('anon','rush.actor_can_read_colleague_profile(uuid)','EXECUTE') and has_function_privilege('authenticated','rush.create_cycle(text)','EXECUTE') and not has_function_privilege('anon','rush.create_cycle(text)','EXECUTE'), 'authorization function ACLs exclude anonymous callers');
select extensions.ok(position('actor_can_read_colleague_profile' in pg_get_expr((select polqual from pg_policy where polname='profiles_read_cycle_colleagues' and polrelid='rush.profiles'::regclass),'rush.profiles'::regclass)) > 0, 'profile colleague policy delegates to the non-recursive helper');
select extensions.ok(position('public.members' in pg_get_functiondef('rush.create_cycle(text)'::regprocedure)) = 0 and position('rush.memberships' in pg_get_functiondef('rush.create_cycle(text)'::regprocedure)) > 0 and position('rush.profiles' in pg_get_functiondef('rush.create_cycle(text)'::regprocedure)) > 0 and position('CYCLE_CREATED' in pg_get_functiondef('rush.create_cycle(text)'::regprocedure)) > 0, 'cycle creation uses active rush identities and retains audit logging');
select extensions.ok((select pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid='rush.submit_application_self_test(text,text)'::regprocedure), 'workflow fixture is postgres-owned security definer with an empty search path');
select extensions.ok(has_function_privilege('service_role','rush.submit_application_self_test(text,text)','EXECUTE') and not has_function_privilege('anon','rush.submit_application_self_test(text,text)','EXECUTE') and not has_function_privilege('authenticated','rush.submit_application_self_test(text,text)','EXECUTE') and not exists(select 1 from aclexplode((select p.proacl from pg_proc p where p.oid='rush.submit_application_self_test(text,text)'::regprocedure)) a where a.grantee=0 and a.privilege_type='EXECUTE'), 'workflow fixture execute ACL is service-role only');
select extensions.ok(position('auth.role() is distinct from ''service_role''' in pg_get_functiondef('rush.submit_application_self_test(text,text)'::regprocedure)) > 0 and position('service role required' in pg_get_functiondef('rush.submit_application_self_test(text,text)'::regprocedure)) > 0, 'workflow fixture checks service role before writes');
select extensions.ok(
  not exists (
    select 1
    from pg_policy p
    where p.polname in (
      'cycles_read_participant',
      'rounds_read_cycle_participant',
      'rubrics_read_cycle_participant',
      'rubric_criteria_read_cycle_participant',
      'events_read_participant'
    )
      and pg_get_expr(p.polqual, p.polrelid) like '%rush.applications%'
  ),
  'participant read policies do not re-enter applications RLS'
);

insert into auth.users(id,email,raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001','pgtap-profile-owner@example.invalid','{}'::jsonb),
  ('10000000-0000-4000-8000-000000000002','pgtap-profile-member@example.invalid','{}'::jsonb),
  ('10000000-0000-4000-8000-000000000003','pgtap-profile-outsider@example.invalid','{}'::jsonb);
insert into rush.rush_cycles(id,name,status) values
  ('10000000-0000-4000-8000-000000000011','pgTAP profile cycle','OPEN'),
  ('10000000-0000-4000-8000-000000000012','pgTAP outsider cycle','OPEN');
insert into rush.memberships(user_id,cycle_id,role) values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','OWNER'),
  ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','MEMBER'),
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000012','MEMBER');

create temporary table rush_foundation_results(key text primary key,value bigint);
grant insert,select on rush_foundation_results to authenticated;
insert into rush_foundation_results values ('fixture_writes_before',
  (select count(*) from rush.applications) +
  (select count(*) from rush.application_documents) +
  (select count(*) from storage.objects));

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
insert into rush_foundation_results values ('allowed_profile',(select count(*) from rush.profiles where id='10000000-0000-4000-8000-000000000002'::uuid));
insert into rush_foundation_results values ('workspace_cycle',(select count(*) from rush.memberships m join rush.rush_cycles c on c.id=m.cycle_id where m.user_id=auth.uid()));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='allowed_profile'),1::bigint,'active cycle owner reads a colleague profile without RLS recursion');
select extensions.is((select value from rush_foundation_results where key='workspace_cycle'),1::bigint,'authenticated workspace lookup joins memberships to cycles without RLS recursion');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.submit_application_self_test('Denied Applicant','workflow-10000000-0000-4000-8000-000000000002@example.invalid')$$,'42501','permission denied for function submit_application_self_test','authenticated callers cannot execute the workflow fixture');
set local role postgres;
select extensions.is(
  (select count(*) from rush.applications) +
  (select count(*) from rush.application_documents) +
  (select count(*) from storage.objects),
  (select value from rush_foundation_results where key='fixture_writes_before'),
  'denied workflow fixture invocation performs no writes'
);

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into rush_foundation_results values ('denied_profile',(select count(*) from rush.profiles where id='10000000-0000-4000-8000-000000000002'::uuid));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='denied_profile'),0::bigint,'unrelated member cannot read a colleague profile');

update rush.profiles set active=false where id='10000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
insert into rush_foundation_results values ('inactive_profile',(select count(*) from rush.profiles where id='10000000-0000-4000-8000-000000000002'::uuid));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='inactive_profile'),0::bigint,'inactive profile cannot read a colleague profile');
update rush.profiles set active=true where id='10000000-0000-4000-8000-000000000001';

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.lives_ok($$select rush.create_cycle('pgTAP owner-created cycle')$$,'active owner can create a cycle');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$select rush.create_cycle('pgTAP member-denied cycle')$$,'42501','forbidden','non-owner cannot create a cycle');
select extensions.ok(exists(select 1 from rush.audit_events a join rush.rush_cycles c on c.id=a.cycle_id where c.name='pgTAP owner-created cycle' and a.actor_id='10000000-0000-4000-8000-000000000001'::uuid and a.action='CYCLE_CREATED' and a.resource='RushCycle' and a.resource_id=c.id), 'cycle creation retains actor-scoped audit behavior');

-- Reapplication. rush.is_applicant answers "have you ever applied", which is
-- the wrong question for routing: it pinned a rejected applicant to /applicant
-- while /apply redirected them back, so they could never apply again.
-- rush.can_start_application answers "is there an open cycle you have not
-- applied to yet". These assertions pin both behaviours.
set local role postgres;
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='can_start_application' and p.pronargs=0 and p.prosecdef and p.proconfig @> array['search_path=""']), 'reapplication eligibility function exists and is security definer with empty search path');

-- The portal allowlist gates every applicant write. Emptying it inside this
-- transaction opens the portal for the fixture; the rollback restores it.
delete from rush.application_portal_allowlist;

insert into auth.users(id,email,raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000004','pgtap-reapplicant@example.invalid','{}'::jsonb);

-- now() is fixed for the whole transaction, so every fixture cycle would share
-- a created_at and "newest open cycle" would be arbitrary. Set them explicitly.
insert into rush.rush_cycles(id,name,status,created_at) values
  ('10000000-0000-4000-8000-000000000013','pgTAP past cycle','CLOSED',now() - interval '1 year'),
  ('10000000-0000-4000-8000-000000000014','pgTAP reapply cycle','OPEN',now() + interval '1 day');
insert into rush.pnms(id,auth_user_id,name,contact,normalized_contact) values
  ('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000004','pgTAP Reapplicant','pgtap-reapplicant@example.invalid','pgtap-reapplicant@example.invalid');
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at) values
  ('10000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000013','REJECTED',now() - interval '1 year');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
insert into rush_foundation_results values ('reapply_can_start',(select case when rush.can_start_application() then 1 else 0 end));
insert into rush_foundation_results values ('reapply_is_applicant',(select case when rush.is_applicant() then 1 else 0 end));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='reapply_can_start'),1::bigint,'a rejected applicant may start an application in a newly opened cycle');
select extensions.is((select value from rush_foundation_results where key='reapply_is_applicant'),1::bigint,'is_applicant stays true for the past cycle, so routing cannot use it alone');

insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at) values
  ('10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000014','SUBMITTED',now());
set local role authenticated;
insert into rush_foundation_results values ('reapply_after_submit',(select case when rush.can_start_application() then 1 else 0 end));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='reapply_after_submit'),0::bigint,'applying in the open cycle closes the new-application route');

update rush.rush_cycles set status='CLOSED' where status='OPEN';
set local role authenticated;
insert into rush_foundation_results values ('reapply_no_open_cycle',(select case when rush.can_start_application() then 1 else 0 end));
set local role postgres;
select extensions.is((select value from rush_foundation_results where key='reapply_no_open_cycle'),0::bigint,'no open cycle means no new application route');


-- Application question editor. The prompts were previously only changeable by
-- writing a migration; these pin the write path's authorization, its ordering,
-- and its refusal to edit under a cohort that has started submitting.
set local role postgres;
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='set_application_questions' and p.prosecdef and p.proconfig @> array['search_path=""']), 'question writer exists and is security definer with empty search path');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='cycle_application_questions' and p.prosecdef and p.proconfig @> array['search_path=""']), 'question reader exists and is security definer with empty search path');

-- ...0002 is a plain MEMBER of cycle ...0011.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.set_application_questions('10000000-0000-4000-8000-000000000011','[]'::jsonb)$$,'42501','forbidden','a plain member cannot edit application questions');
select extensions.is(rush.cycle_application_questions('10000000-0000-4000-8000-000000000011'),'[]'::jsonb,'a plain member reads no questions back');

-- ...0001 is OWNER of cycle ...0011, which has no applications at all.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is(
  rush.set_application_questions('10000000-0000-4000-8000-000000000011',
    '[{"key":"second_q","prompt":"Second prompt","inputType":"short_text","required":false},
      {"key":"first_q","prompt":"First prompt","inputType":"long_text","required":true}]'::jsonb),
  2,
  'an owner replaces the question set and gets the written count back');
select extensions.is(
  rush.cycle_application_questions('10000000-0000-4000-8000-000000000011') -> 0 ->> 'key',
  'second_q',
  'questions read back in submitted order, not alphabetically');
select extensions.throws_ok($$select rush.set_application_questions('10000000-0000-4000-8000-000000000011','[{"key":"Bad Key","prompt":"x"}]'::jsonb)$$,'22023','invalid question key','a malformed key is rejected');
select extensions.throws_ok($$select rush.set_application_questions('10000000-0000-4000-8000-000000000011','[{"key":"dup","prompt":"a"},{"key":"dup","prompt":"b"}]'::jsonb)$$,'23505','duplicate question key','duplicate keys are rejected');

-- Cycle ...0014 holds the SUBMITTED reapplication fixture above.
set local role postgres;
insert into rush.memberships(user_id,cycle_id,role) values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000014','OWNER');
set local role authenticated;
select extensions.throws_ok($$select rush.set_application_questions('10000000-0000-4000-8000-000000000014','[]'::jsonb)$$,'55000','applications already submitted','questions freeze once a cohort has submitted');
set local role postgres;


-- Rubric criteria editor. The version-bump rule is the important one: criteria
-- are referenced by criterion_ratings with no cascade, so a rubric that has
-- been scored against must never be edited in place.
set local role postgres;
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='set_rubric_criteria' and p.prosecdef and p.proconfig @> array['search_path=""']), 'rubric writer exists and is security definer with empty search path');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='cycle_rubrics' and p.prosecdef and p.proconfig @> array['search_path=""']), 'rubric reader exists and is security definer with empty search path');

insert into rush.rounds(id,cycle_id,kind,name,status,weight) values
  ('10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000011','PGTAP_ROUND','pgTAP round','DRAFT',50);

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.set_rubric_criteria('10000000-0000-4000-8000-000000000041','[{"key":"a","name":"A","weight":10}]'::jsonb)$$,'42501','forbidden','a plain member cannot edit a rubric');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$select rush.set_rubric_criteria('10000000-0000-4000-8000-000000000041','[]'::jsonb)$$,'22023','a rubric needs at least one criterion','an empty rubric is rejected');
select extensions.throws_ok($$select rush.set_rubric_criteria('10000000-0000-4000-8000-000000000041','[{"key":"a","name":"A","weight":0}]'::jsonb)$$,'22023','invalid criterion weight','a zero weight is rejected');
select extensions.throws_ok($$select rush.set_rubric_criteria('10000000-0000-4000-8000-000000000041','[{"key":"a","name":"A","weight":10},{"key":"a","name":"B","weight":10}]'::jsonb)$$,'23505','duplicate criterion key','duplicate criterion keys are rejected');

select rush.set_rubric_criteria(
  '10000000-0000-4000-8000-000000000041',
  '[{"key":"clarity","name":"Clarity","description":"","weight":30,"required":true},
    {"key":"rigour","name":"Rigour","description":"","weight":20,"required":false}]'::jsonb);
set local role postgres;
insert into rush_foundation_results values ('rubric_first_version',
  (select max(b.version) from rush.rubrics b where b.round_id='10000000-0000-4000-8000-000000000041'));
select extensions.is((select value from rush_foundation_results where key='rubric_first_version'),1::bigint,'a round with no rubric gets version 1');
select extensions.is(
  (select count(*) from rush.rubric_criteria c join rush.rubrics b on b.id=c.rubric_id where b.round_id='10000000-0000-4000-8000-000000000041'),
  2::bigint,
  'editing in place replaces criteria rather than appending');

-- Re-saving with no evaluations against the rubric must stay on version 1.
set local role authenticated;
select rush.set_rubric_criteria(
  '10000000-0000-4000-8000-000000000041',
  '[{"key":"clarity","name":"Clarity again","description":"","weight":40,"required":true}]'::jsonb);
set local role postgres;
insert into rush_foundation_results values ('rubric_reedit_version',
  (select max(b.version) from rush.rubrics b where b.round_id='10000000-0000-4000-8000-000000000041'));
select extensions.is((select value from rush_foundation_results where key='rubric_reedit_version'),1::bigint,'an unscored rubric is edited in place, not versioned');

update rush.rounds set status='PUBLISHED' where id='10000000-0000-4000-8000-000000000041';
update rush.rounds set status='ACTIVE' where id='10000000-0000-4000-8000-000000000041';
set local role authenticated;
select extensions.throws_ok(
  $$select rush.set_rubric_criteria('10000000-0000-4000-8000-000000000041','[{"key":"a","name":"A","weight":10}]'::jsonb)$$,
  '55000','round is already under way','a round under way has a fixed rubric');
set local role postgres;


-- Applicant withdrawal. WITHDRAWN was unreachable before this function: four
-- guards checked for it and nothing could set it.
set local role postgres;
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='withdraw_application' and p.prosecdef and p.proconfig @> array['search_path=""']), 'withdrawal function exists and is security definer with empty search path');

-- ...0002 does not own the reapplicant's application ...032.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.withdraw_application('10000000-0000-4000-8000-000000000032')$$,'42501','forbidden','one applicant cannot withdraw another applicant''s application');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.throws_ok($$select rush.withdraw_application('10000000-0000-4000-8000-000000000031')$$,'55000','application cannot be withdrawn','a rejected application cannot be withdrawn');
select extensions.ok(rush.withdraw_application('10000000-0000-4000-8000-000000000032'), 'the owner withdraws their submitted application');
set local role postgres;
select extensions.is((select status::text from rush.applications where id='10000000-0000-4000-8000-000000000032'),'WITHDRAWN','withdrawal reaches the previously unreachable status');
select extensions.ok(exists(select 1 from rush.audit_events where resource='Application' and resource_id='10000000-0000-4000-8000-000000000032' and action='APPLICATION_WITHDRAWN' and actor_id='10000000-0000-4000-8000-000000000004'::uuid), 'withdrawal is recorded in the audit log with the applicant as actor');
set local role authenticated;
select extensions.throws_ok($$select rush.withdraw_application('10000000-0000-4000-8000-000000000032')$$,'55000','application cannot be withdrawn','withdrawing twice is refused');
set local role postgres;


-- Cycle clone. The rule that matters is what it does not copy: no applicant
-- data may cross a cycle boundary.
set local role postgres;
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='clone_cycle' and p.prosecdef and p.proconfig @> array['search_path=""']), 'clone function exists and is security definer with empty search path');

-- ...0002 is a MEMBER, not an OWNER anywhere.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.clone_cycle('10000000-0000-4000-8000-000000000011','pgTAP member clone')$$,'42501','forbidden','a non-owner cannot clone a cycle');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$select rush.clone_cycle('10000000-0000-4000-8000-000000000011','pgTAP profile cycle')$$,'23505','cycle exists','a duplicate cycle name is rejected');
select rush.clone_cycle('10000000-0000-4000-8000-000000000011','pgTAP cloned cycle');
set local role postgres;
select extensions.is((select status::text from rush.rush_cycles where name='pgTAP cloned cycle'),'DRAFT','a cloned cycle starts as a draft');
select extensions.is(
  (select count(*) from rush.rounds r join rush.rush_cycles c on c.id=r.cycle_id where c.name='pgTAP cloned cycle'),
  (select count(*) from rush.rounds r where r.cycle_id='10000000-0000-4000-8000-000000000011'),
  'every round is carried across');
select extensions.is(
  (select count(*) from rush.rubric_criteria rc join rush.rubrics b on b.id=rc.rubric_id join rush.rounds r on r.id=b.round_id join rush.rush_cycles c on c.id=r.cycle_id where c.name='pgTAP cloned cycle'),
  1::bigint,
  'the edited rubric criteria come across, not the create_cycle defaults');
select extensions.is(
  (select max(b.version) from rush.rubrics b join rush.rounds r on r.id=b.round_id join rush.rush_cycles c on c.id=r.cycle_id where c.name='pgTAP cloned cycle'),
  1,
  'rubric versions restart at 1 in the new cycle');
select extensions.is(
  (select count(*) from rush.application_questions q join rush.rush_cycles c on c.id=q.cycle_id where c.name='pgTAP cloned cycle'),
  1::bigint,
  'the edited application questions come across');
select extensions.is(
  (select count(*) from rush.applications a join rush.rush_cycles c on c.id=a.cycle_id where c.name='pgTAP cloned cycle'),
  0::bigint,
  'no applicant data crosses a cycle boundary');
select extensions.ok(
  exists(select 1 from rush.memberships m join rush.rush_cycles c on c.id=m.cycle_id where c.name='pgTAP cloned cycle' and m.user_id='10000000-0000-4000-8000-000000000002'::uuid),
  'the roster is carried across');


-- Member profiles and the directory. The directory must be scoped to a cycle
-- the caller actually belongs to, and must not leak contact details.
set local role postgres;
select extensions.has_column('rush','profiles','position_title','profiles carry an org position');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='update_my_profile' and p.prosecdef and p.proconfig @> array['search_path=""']), 'profile writer exists and is security definer with empty search path');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='cycle_directory' and p.prosecdef and p.proconfig @> array['search_path=""']), 'directory reader exists and is security definer with empty search path');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.ok(rush.update_my_profile('pgTAP Member','Winter 2027','Industrial Engineering','Engagement lead','Short bio.'), 'a member updates their own profile');
select extensions.throws_ok($$select rush.update_my_profile('','','','','')$$,'22023','invalid display name','a blank display name is rejected');
set local role postgres;
select extensions.is((select position_title from rush.profiles where id='10000000-0000-4000-8000-000000000002'),'Engagement lead','the profile write lands on the caller''s own row');

set local role authenticated;
select extensions.ok(
  jsonb_array_length(rush.cycle_directory('10000000-0000-4000-8000-000000000011')) > 0,
  'a member of the cycle reads its directory');
select extensions.ok(
  not (rush.cycle_directory('10000000-0000-4000-8000-000000000011')::text like '%@%'),
  'the directory carries no email addresses');
-- ...0003 belongs to cycle ...0012 only.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.is(rush.cycle_directory('10000000-0000-4000-8000-000000000011'),'[]'::jsonb,'an outsider reads an empty directory');
set local role postgres;


-- Message log. The point of the log is that a failed send is recorded, so that
-- is what the assertions pin, alongside who may write one.
set local role postgres;
select extensions.has_table('rush','messages','message log table exists');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='log_message' and p.prosecdef and p.proconfig @> array['search_path=""']), 'message logger exists and is security definer with empty search path');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='release_ready_decisions' and p.prosecdef and p.proconfig @> array['search_path=""']), 'batch release exists and is security definer with empty search path');
select extensions.ok((select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rush' and c.relname='messages'), 'message log has row level security enabled and forced');

-- ...0002 is a plain member of ...0011 and has no role on ...0014, which owns
-- application ...032.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.log_message('10000000-0000-4000-8000-000000000032','TEST','a@example.invalid','Subject',true)$$,'42501','forbidden','an unrelated member cannot log a message against an application');

-- The applicant may log their own intake confirmation.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.ok(rush.log_message('10000000-0000-4000-8000-000000000032','APPLICATION_RECEIVED','pgtap-reapplicant@example.invalid','We received your MECG application',false) is not null, 'the applicant logs their own confirmation');
set local role postgres;
select extensions.is(
  (select delivered from rush.messages where application_id='10000000-0000-4000-8000-000000000032' order by created_at desc limit 1),
  false,
  'a failed send is recorded rather than dropped');
select extensions.is(
  (select cycle_id from rush.messages where application_id='10000000-0000-4000-8000-000000000032' order by created_at desc limit 1),
  '10000000-0000-4000-8000-000000000014',
  'the log takes its cycle from the application, not from the caller');

-- ...0001 owns ...0014 but is not PANEL there, so batch release is refused.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.release_ready_decisions('10000000-0000-4000-8000-000000000011')$$,'42501','panel role required','a non-panel member cannot batch release');
set local role postgres;


-- Offer deadlines. Expiry is enforced in respond_to_offer rather than in the
-- UI, so a page left open overnight cannot accept an offer that has lapsed.
set local role postgres;
select extensions.has_column('rush','applications','offer_expires_at','applications carry an offer deadline');
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='set_offer_deadline' and p.prosecdef and p.proconfig @> array['search_path=""']), 'deadline setter exists and is security definer with empty search path');
select extensions.ok(position('offer expired' in pg_get_functiondef('rush.respond_to_offer(text,boolean)'::regprocedure)) > 0, 'respond_to_offer enforces the deadline itself');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.set_offer_deadline('10000000-0000-4000-8000-000000000031', now() + interval '7 days')$$,'42501','panel role required','a non-panel member cannot set an offer deadline');
set local role postgres;


-- Projects and staffing. The assertion that matters is that a project is
-- private until somebody deliberately publishes it.
set local role postgres;
select extensions.has_table('rush','projects','projects table exists');
select extensions.has_table('rush','project_members','project staffing table exists');
select extensions.ok((select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rush' and c.relname='projects'), 'projects has row level security enabled and forced');

insert into rush.projects (slug, title) values ('pgtap-project','pgTAP project');
select extensions.is((select is_public from rush.projects where slug='pgtap-project'), false, 'a project is private until it is deliberately published');
select extensions.is(rush.public_projects(), '[]'::jsonb, 'a private project is invisible to the public site');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.upsert_project('{"slug":"member-project","title":"Nope"}'::jsonb)$$,'42501','forbidden','a plain member cannot create a project');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$select rush.upsert_project('{"slug":"Bad Slug","title":"Nope"}'::jsonb)$$,'22023','invalid project slug','a malformed slug is rejected');
select extensions.ok(rush.upsert_project('{"slug":"pgtap-project","title":"pgTAP project","isPublic":true}'::jsonb) is not null, 'an owner publishes a project');
set local role postgres;
select extensions.is(jsonb_array_length(rush.public_projects()), 1, 'a published project reaches the public site');
select extensions.is(rush.public_projects() -> 0 ->> 'slug', 'pgtap-project', 'the public payload carries the slug');

set local role authenticated;
select extensions.throws_ok(
  $$select rush.set_project_staffing((select id from rush.projects where slug='pgtap-project'), '[{"userId":"10000000-0000-4000-8000-0000000000ff"}]'::jsonb)$$,
  'P0002','unknown member','staffing an unknown member is an error rather than a silent skip');
set local role postgres;


-- Reminders. The idempotency guard is the point: an hourly job must not send
-- the same nudge every hour.
set local role postgres;
select extensions.has_table('rush','reminders_sent','reminder bookkeeping table exists');
select extensions.ok((select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rush' and c.relname='reminders_sent'), 'reminder table has row level security enabled and forced');
select extensions.ok(not exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='rush' and c.relname='reminders_sent'), 'reminder table has no policies, so only service_role reaches it');
select extensions.ok(position('reminders_sent' in pg_get_functiondef('rush.pending_reminders()'::regprocedure)) > 0, 'pending_reminders excludes anyone already reminded');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.mark_reminder_sent('EVALUATION_DUE','x','10000000-0000-4000-8000-000000000001'::uuid)$$,'42501','service role required','an authenticated caller cannot record a reminder');
select extensions.is(rush.pending_reminders(),'[]'::jsonb,'pending_reminders returns nothing to a non-scheduler caller');
set local role postgres;


-- Policy decisions. Each of these encodes a rule that was previously left to
-- convention, so the assertions are the record of what was decided.
set local role postgres;

-- Declining an offer does not bar a later application. can_start_application
-- asks only whether the caller has a row in the open cycle.
select extensions.ok(position('offer_response' in pg_get_functiondef('rush.can_start_application()'::regprocedure)) = 0, 'declining an offer does not bar a later application');

-- Resume replacement is allowed until review starts, not until submission.
select extensions.ok(position('SUBMITTED' in pg_get_functiondef('rush.begin_resume_upload(text,integer)'::regprocedure)) > 0, 'a submitted applicant may still upload a replacement resume');
select extensions.ok(position('screening_packets' in pg_get_functiondef('rush.begin_resume_upload(text,integer)'::regprocedure)) > 0, 'replacement stops once a screening packet exists');
select extensions.ok(position('screening_packets' in pg_get_functiondef('rush.attach_ready_resume()'::regprocedure)) > 0, 'attaching a replacement stops once a screening packet exists');

-- Retention anonymises rather than deletes, so the audit trail survives.
select extensions.ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname='anonymize_archived_applicants' and p.prosecdef and p.proconfig @> array['search_path=""']), 'retention function exists and is security definer with empty search path');
select extensions.ok(position('delete from rush.pnms' in pg_get_functiondef('rush.anonymize_archived_applicants()'::regprocedure)) = 0, 'retention never removes an applicant row, so decisions stay reconstructable');
select extensions.ok(exists(select 1 from cron.job where jobname = 'anonymize-archived-applicants'), 'retention is scheduled rather than merely available');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.anonymize_archived_applicants()$$,'42501','service role required','an authenticated caller cannot run retention');

-- Prior-cycle history is board-only. ...0004 is an applicant, not staff.
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.is(rush.applicant_prior_cycles('10000000-0000-4000-8000-000000000032'),'[]'::jsonb,'an applicant cannot read prior-cycle history through the board function');
set local role postgres;

select * from extensions.finish();
rollback;
