begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data)
 select ('55000000-0000-4000-8000-00000000000'||n)::uuid,'incident-fixture'||n||'@example.invalid','{}'::jsonb
 from generate_series(1,7) n;
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'http://127.0.0.1:54321/auth/v1',('55000000-0000-4000-8000-00000000000'||n),('55000000-0000-4000-8000-00000000000'||n)::uuid
 from generate_series(1,7) n on conflict(issuer,subject) do nothing;
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('incident-cycle-a','Incident fixture A','IN_PROCESS'),('incident-cycle-b','Incident fixture B','CLOSED');
insert into rush.memberships(user_id,cycle_id,role) values
 ('55000000-0000-4000-8000-000000000001','incident-cycle-a','OWNER'),
 ('55000000-0000-4000-8000-000000000002','incident-cycle-b','OWNER'),
 ('55000000-0000-4000-8000-000000000003','incident-cycle-a','BOARD'),
 ('55000000-0000-4000-8000-000000000004','incident-cycle-a','PANEL'),
 ('55000000-0000-4000-8000-000000000005','incident-cycle-a','RECRUITMENT_COMMITTEE'),
 ('55000000-0000-4000-8000-000000000006','incident-cycle-a','MEMBER');

select extensions.ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='rush.provisioning_incidents'::regclass),'incidents enforce row-level security');
select extensions.ok(not has_table_privilege('anon','rush.provisioning_incidents','SELECT'),'anonymous actors cannot read incidents');
select extensions.ok(not has_table_privilege('authenticated','rush.provisioning_incidents','INSERT') and not has_any_column_privilege('authenticated','rush.provisioning_incidents','INSERT'),'authenticated actors cannot create incidents');
select extensions.ok(not has_table_privilege('authenticated','rush.provisioning_incidents','UPDATE') and not has_table_privilege('authenticated','rush.provisioning_incidents','DELETE'),'authenticated actors cannot directly rewrite/delete incidents');
select extensions.ok(not has_table_privilege('service_role','rush.provisioning_incidents','SELECT') and not has_table_privilege('service_role','rush.provisioning_incidents','UPDATE') and not has_table_privilege('service_role','rush.provisioning_incidents','DELETE'),'service writer has no read/update/delete table privileges');
select extensions.ok(has_column_privilege('service_role','rush.provisioning_incidents','email','INSERT') and not has_column_privilege('service_role','rush.provisioning_incidents','resolved_at','INSERT'),'service writer can record lookup identity but cannot pre-resolve incidents');
select extensions.ok(not exists(select 1 from information_schema.columns where table_schema='rush' and table_name='provisioning_incidents' and (column_name like '%password%' or column_name like '%error%')),'incident schema has no credential or provider-error fields');
select extensions.ok(not exists(select 1 from pg_constraint where conrelid='rush.provisioning_incidents'::regclass and contype='f' and pg_get_constraintdef(oid) like '%app_user_id%'),'target profile id survives compensation deletion without a foreign key');
select extensions.ok(not has_function_privilege('anon','rush.resolve_provisioning_incident(uuid)','EXECUTE'),'anonymous actors cannot resolve incidents');

set local role service_role;
insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,clerk_user_id,app_user_id,phase,clerk_cleanup_failed,profile_cleanup_failed) values
 ('55000000-0000-4000-8000-000000000011','incident-cycle-a','55000000-0000-4000-8000-000000000001','failed-account@example.invalid','user_fixture_partial','55000000-0000-4000-8000-000000000007','IDENTITY_LINK',true,true),
 ('55000000-0000-4000-8000-000000000012','incident-cycle-b','55000000-0000-4000-8000-000000000002','uncertain-account@example.invalid',null,null,'CREATE_ACCOUNT',false,false);
select extensions.throws_ok($$insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,phase,clerk_cleanup_failed,profile_cleanup_failed,resolved_at,resolved_by) values('55000000-0000-4000-8000-000000000013','incident-cycle-a','55000000-0000-4000-8000-000000000001','forged@example.invalid','CREATE_ACCOUNT',false,false,now(),'55000000-0000-4000-8000-000000000001')$$,'42501',null,'service inserts cannot forge owner resolution');
select extensions.throws_ok($$insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,phase,clerk_cleanup_failed,profile_cleanup_failed) values('55000000-0000-4000-8000-000000000013','incident-cycle-a','55000000-0000-4000-8000-000000000001','bad-phase@example.invalid','RAW_PROVIDER_ERROR',false,false)$$,'23514',null,'incident phase is restricted to known provisioning steps');
select extensions.throws_ok($$insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,clerk_user_id,phase,clerk_cleanup_failed,profile_cleanup_failed) values('55000000-0000-4000-8000-000000000013','incident-cycle-a','55000000-0000-4000-8000-000000000001','oversize@example.invalid',repeat('u',201),'CREATE_ACCOUNT',false,false)$$,'23514',null,'provider lookup identity is bounded');
select extensions.throws_ok($$insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,phase,clerk_cleanup_failed,profile_cleanup_failed) values('55000000-0000-4000-8000-000000000013','incident-cycle-a','55000000-0000-4000-8000-000000000001',repeat('e',321),'CREATE_ACCOUNT',false,false)$$,'23514',null,'email lookup identity is bounded');
set local role postgres;
select extensions.is((select count(*) from rush.provisioning_incidents where cycle_id like 'incident-cycle-%'),2::bigint,'service records both partial-account and uncertain-creation incidents');
select extensions.ok((select created_at is not null and resolved_at is null and resolved_by is null from rush.provisioning_incidents where id='55000000-0000-4000-8000-000000000011'),'incident timestamp is generated and starts unresolved');
delete from rush.profiles where id='55000000-0000-4000-8000-000000000007';
select extensions.is((select app_user_id from rush.provisioning_incidents where id='55000000-0000-4000-8000-000000000011'),'55000000-0000-4000-8000-000000000007'::uuid,'failed target profile can be cleaned up without losing incident evidence');

-- Every non-owner staff role is exercised through actual authenticated RLS.
set local role authenticated;
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.is((select count(*) from rush.provisioning_incidents),0::bigint,'Board cannot inspect incident identity');
select extensions.throws_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000011')$$,'42501','owner role required','Board cannot resolve incidents');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.is((select count(*) from rush.provisioning_incidents),0::bigint,'Panel cannot inspect incident identity');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000005","role":"authenticated"}';
select extensions.is((select count(*) from rush.provisioning_incidents),0::bigint,'recruitment committee cannot inspect incident identity');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000006","role":"authenticated"}';
select extensions.is((select count(*) from rush.provisioning_incidents),0::bigint,'ordinary member cannot inspect incident identity');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is((select count(*) from rush.provisioning_incidents),1::bigint,'an owner can read only their own cycle incident');
select extensions.is((select count(*) from rush.provisioning_incidents where cycle_id='incident-cycle-a'),0::bigint,'other-cycle owner has no read access to the target incident');
select extensions.throws_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000011')$$,'42501','owner role required','other-cycle owner cannot resolve target incident');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"55000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is((select email from rush.provisioning_incidents where id='55000000-0000-4000-8000-000000000011'),'failed-account@example.invalid','same-cycle owner can retrieve necessary lookup identity');
select extensions.throws_ok($$update rush.provisioning_incidents set email='rewritten@example.invalid' where id='55000000-0000-4000-8000-000000000011'$$,'42501',null,'owner cannot alter incident facts directly');
select extensions.throws_ok($$delete from rush.provisioning_incidents where id='55000000-0000-4000-8000-000000000011'$$,'42501',null,'owner cannot delete incident evidence');
select extensions.throws_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000099')$$,'P0002','incident missing','missing incident returns a bounded lookup error');
select extensions.lives_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000011')$$,'same-cycle owner can mark the incident resolved');
select extensions.ok((select resolved_at is not null and resolved_by='55000000-0000-4000-8000-000000000001'::uuid from rush.provisioning_incidents where id='55000000-0000-4000-8000-000000000011'),'resolution records owner identity and timestamp');
select extensions.lives_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000011')$$,'repeat resolution is a safe no-op');
set local role postgres;
select extensions.is((select count(*) from rush.audit_events where action='PROVISIONING_INCIDENT_RESOLVED' and resource_id='55000000-0000-4000-8000-000000000011'),1::bigint,'idempotent resolution emits one operational audit event');
select extensions.is((select metadata from rush.audit_events where action='PROVISIONING_INCIDENT_RESOLVED' and resource_id='55000000-0000-4000-8000-000000000011'),jsonb_build_object('incidentId','55000000-0000-4000-8000-000000000011'::uuid),'operational audit metadata contains only incident id, no account lookup identity');
-- Isolate the incident FK from the independent append-only audit trigger on
-- the resolver above: this requester has no audit events or memberships.
insert into auth.users(id,email,raw_user_meta_data) values('55000000-0000-4000-8000-000000000008','incident-fk@example.invalid','{}');
insert into rush.provisioning_incidents(id,cycle_id,requested_by,email,phase,clerk_cleanup_failed,profile_cleanup_failed)
 values('55000000-0000-4000-8000-000000000014','incident-cycle-a','55000000-0000-4000-8000-000000000008','incident-fk-target@example.invalid','CREATE_ACCOUNT',false,false);
select extensions.throws_ok($$delete from rush.profiles where id='55000000-0000-4000-8000-000000000008'$$,'23503',null,'requester deletion cannot cascade away incident evidence');
update rush.memberships set active=false,revoked_at=now() where user_id='55000000-0000-4000-8000-000000000001' and cycle_id='incident-cycle-a';
set local role authenticated;
select extensions.is((select count(*) from rush.provisioning_incidents),0::bigint,'revoked owner immediately loses incident access');
select extensions.throws_ok($$select rush.resolve_provisioning_incident('55000000-0000-4000-8000-000000000011')$$,'42501','owner role required','even resolved incidents require current owner authorization');
select * from extensions.finish();
rollback;
