\set ON_ERROR_STOP on
-- 1 member, 2 board, 3 owner of 'test' (evidence reviewer), 4 owner of 'other' only, 5 owner with an inactive profile
insert into rush.rush_cycles(id,name,status) values('test','Fall 2026','IN_PROCESS'),('other','Winter 2027','IN_PROCESS'),('old','Fall 2023','ARCHIVED');
insert into rush.profiles(id,display_name,active) values('00000000-0000-4000-8000-000000000001','Member',true),('00000000-0000-4000-8000-000000000002','Board',true),
 ('00000000-0000-4000-8000-000000000003','Owner',true),('00000000-0000-4000-8000-000000000004','Other owner',true),('00000000-0000-4000-8000-000000000005','Gone',false);
insert into rush.memberships(cycle_id,user_id,role,active) values('test','00000000-0000-4000-8000-000000000001','MEMBER',true),('test','00000000-0000-4000-8000-000000000002','BOARD',true),
 ('test','00000000-0000-4000-8000-000000000003','OWNER',true),('other','00000000-0000-4000-8000-000000000004','OWNER',true),('test','00000000-0000-4000-8000-000000000005','OWNER',true);
insert into rush.member_tool_reviewers(cycle_id,kind,user_id) values('test','evidence','00000000-0000-4000-8000-000000000003'),('test','pipeline','00000000-0000-4000-8000-000000000002');
insert into rush.member_tool_records(id,cycle_id,kind,owner_id,content) values
 ('00000000-0000-4000-8000-0000000000a1','test','pipeline','00000000-0000-4000-8000-000000000001','{"title":"Secret prospect"}'),
 ('00000000-0000-4000-8000-0000000000a2','test','evidence','00000000-0000-4000-8000-000000000001','{"title":"Client win"}'),
 ('00000000-0000-4000-8000-0000000000a3','other','evidence','00000000-0000-4000-8000-000000000001','{"title":"Other cycle"}'),
 ('00000000-0000-4000-8000-0000000000a4','old','lab','00000000-0000-4000-8000-000000000001','{"title":"Old demo"}');
-- 'old' was archived three years ago.
insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata,created_at) values
 (null,'old','CYCLE_STATUS_CHANGED','RushCycle','old','{"from":"CLOSED","to":"ARCHIVED"}',now()-interval '36 months'),
 (null,null,'SOMETHING_OLD','X','x','{}',now()-interval '30 months');
insert into rush.projects(id,slug,title,client_label,sort_order) values('p1','acme','Acme pricing','Acme',1);
insert into rush.project_members(project_id,user_id,role_label) values('p1','00000000-0000-4000-8000-000000000001','Analyst');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error % from %',expected,command; exception when others then if sqlstate<>expected then raise;end if;end$$;
set role authenticated;

-- Direct table access and helpers are denied to every signed-in role.
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
select pg_temp.expect_error($q$select * from rush.retention_policies$q$,'42501');
select pg_temp.expect_error($q$select rush.is_any_owner()$q$,'42501');
select pg_temp.expect_error($q$select rush.cycle_archived_at('old')$q$,'42501');
select pg_temp.expect_error($q$select rush.cycle_export_since_close('test')$q$,'42501');

-- Members, board, another cycle's Owner and an inactive Owner cannot export, archive or see the overview of 'test'.
do $$declare who text; begin
 foreach who in array array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005'] loop
  perform set_config('test.actor',who,false);
  perform pg_temp.expect_error($q$select rush.cycle_records_overview('test')$q$,'42501');
  perform pg_temp.expect_error($q$select rush.export_cycle_records('test','all')$q$,'42501');
  perform pg_temp.expect_error($q$select rush.archive_cycle_records('test')$q$,'42501');
 end loop; end$$;
-- Members, board and an inactive Owner cannot read or change retention.
do $$declare who text; begin
 foreach who in array array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005'] loop
  perform set_config('test.actor',who,false);
  perform pg_temp.expect_error($q$select rush.retention_report()$q$,'42501');
  perform pg_temp.expect_error($q$select rush.save_retention_policy('audit_events',12,1)$q$,'42501');
 end loop; end$$;

-- Overview: counts per tool, full only where the Owner is a reviewer, no export yet.
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
do $$declare o jsonb := rush.cycle_records_overview('test'); begin
 if o->'cycle'->>'status'<>'IN_PROCESS' or o->'cycle'->>'name'<>'Fall 2026' then raise exception 'cycle wrong %',o;end if;
 if o->'tools'<>'[{"kind":"pipeline","records":1,"full":false},{"kind":"evidence","records":1,"full":true},{"kind":"lab","records":0,"full":false}]'::jsonb then raise exception 'tools wrong %',o->'tools';end if;
 if (o->>'projects')::int<>1 or o->'lastExportAt'<>'null'::jsonb or o->'exportedSinceClose'<>'null'::jsonb then raise exception 'overview wrong %',o;end if;
end$$;

-- Archive refuses an open cycle.
select pg_temp.expect_error($q$select rush.archive_cycle_records('test')$q$,'55000');

-- Export: evidence (reviewer) is full; pipeline content is withheld; other cycles never appear; audit carries no content.
do $$declare e jsonb := rush.export_cycle_records('test','all'); r jsonb; a jsonb; begin
 if e->>'format'<>'mecg-cycle-records/1' or e->'fullContentTools'<>'["evidence"]'::jsonb then raise exception 'header wrong %',e;end if;
 if jsonb_array_length(e->'memberToolRecords')<>2 then raise exception 'record count %',e->'memberToolRecords';end if;
 select x into r from jsonb_array_elements(e->'memberToolRecords') x where x->>'kind'='pipeline';
 if (r->>'contentWithheld')::boolean is not true or r->'content'<>'null'::jsonb or r->'review'<>'null'::jsonb or r->>'ownerName'<>'Member' or r->>'verification'<>'Pending' then raise exception 'pipeline not withheld %',r;end if;
 select x into r from jsonb_array_elements(e->'memberToolRecords') x where x->>'kind'='evidence';
 if (r->>'contentWithheld')::boolean or r->'content'->>'title'<>'Client win' or r->'review'->>'sharing'<>'Restricted' then raise exception 'evidence not full %',r;end if;
 if e::text like '%Other cycle%' or e::text like '%Old demo%' or e::text like '%Secret prospect%' then raise exception 'leak %',e;end if;
 if e->'projects'->0->>'title'<>'Acme pricing' or e->'projectMembers'->0->>'name'<>'Member' or e->'projectMembers'->0->>'roleLabel'<>'Analyst' then raise exception 'projects wrong %',e;end if;
 if jsonb_array_length(e->'reviewerGrants')<>2 then raise exception 'grants wrong %',e->'reviewerGrants';end if;
 reset role;
 select metadata into a from rush.audit_events where action='CYCLE_RECORDS_EXPORTED' and cycle_id='test' and actor_id='00000000-0000-4000-8000-000000000003';
 if a<>'{"memberToolRecords":2,"projects":1,"fullContentTools":["evidence"],"section":"all"}'::jsonb then raise exception 'audit wrong %',a;end if;
 set role authenticated;
end$$;

-- An export made before the cycle closed does not unlock archiving; one made after does.
reset role;
update rush.audit_events set created_at=now()-interval '2 days' where action='CYCLE_RECORDS_EXPORTED';
update rush.rush_cycles set status='CLOSED' where id='test';
insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata,created_at) values(null,'test','CYCLE_STATUS_CHANGED','RushCycle','test','{"from":"DECISION_LOCK","to":"CLOSED"}',now()-interval '1 day');
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
do $$begin if rush.cycle_records_overview('test')->'exportedSinceClose'<>'null'::jsonb then raise exception 'stale export counted';end if;end$$;
select pg_temp.expect_error($q$select rush.archive_cycle_records('test')$q$,'55000');
-- An unknown section is refused; a projects-only export does not unlock archiving.
select pg_temp.expect_error($q$select rush.export_cycle_records('test','secrets')$q$,'22023');
select rush.export_cycle_records('test','projects') is not null;
select pg_temp.expect_error($q$select rush.archive_cycle_records('test')$q$,'55000');
select rush.export_cycle_records('test','records') is not null;
do $$declare r jsonb := rush.archive_cycle_records('test'); begin
 if r<>'{"status":"ARCHIVED","changed":true}'::jsonb then raise exception 'archive wrong %',r;end if;
 if rush.archive_cycle_records('test')<>'{"status":"ARCHIVED","changed":false}'::jsonb then raise exception 'repeat archive not idempotent';end if;
 if rush.cycle_records_overview('test')->'cycle'->>'archivedAt' is null then raise exception 'archivedAt missing';end if;
end$$;
reset role;
do $$begin
 if (select status from rush.rush_cycles where id='test')<>'ARCHIVED' then raise exception 'not archived';end if;
 if (select count(*) from rush.audit_events where cycle_id='test' and action='CYCLE_STATUS_CHANGED' and metadata->>'to'='ARCHIVED' and metadata->>'via'='cycle_records')<>1 then raise exception 'archive audit wrong';end if;
 if (select count(*) from rush.member_tool_records)<>4 then raise exception 'records were removed';end if;
end$$;
set role authenticated;

-- Retention starts unset: no counts. Another cycle's Owner can configure it (organisation-wide).
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
do $$declare r jsonb := rush.retention_report(); begin
 if (select count(*) from jsonb_array_elements(r->'categories') c where c->'keepMonths'='null'::jsonb and c->'eligible'='null'::jsonb and (c->>'revision')::int=1)<>2 then raise exception 'not unset %',r;end if;
end$$;
select pg_temp.expect_error($q$select rush.save_retention_policy('applicants',12,1)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_retention_policy('audit_events',0,1)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_retention_policy('audit_events',241,1)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_retention_policy('audit_events',24,7)$q$,'40001');
do $$begin
 if rush.save_retention_policy('member_tool_records',24,1)<>'{"revision":2,"changed":true}'::jsonb then raise exception 'save failed';end if;
 if rush.save_retention_policy('member_tool_records',24,2)<>'{"revision":2,"changed":false}'::jsonb then raise exception 'no-op bumped revision';end if;
 if rush.save_retention_policy('audit_events',24,1)<>'{"revision":2,"changed":true}'::jsonb then raise exception 'save failed';end if;
end$$;
-- Dry run: 'old' (archived 36 months ago) is past 24 months; 'test' (archived now) is not. Audit: the 36- and 30-month-old events.
do $$declare r jsonb := rush.retention_report(); m jsonb; a jsonb; begin
 select c into m from jsonb_array_elements(r->'categories') c where c->>'category'='member_tool_records';
 select c into a from jsonb_array_elements(r->'categories') c where c->>'category'='audit_events';
 if (m->>'eligible')::int<>1 or jsonb_array_length(m->'byCycle')<>1 or m->'byCycle'->0->>'cycleId'<>'old' or (m->'byCycle'->0->>'records')::int<>1 then raise exception 'member tool dry run wrong %',m;end if;
 if r::text like '%Old demo%' then raise exception 'dry run leaked content';end if;
 if (a->>'eligible')::int<>2 or a->'byCycle'<>'null'::jsonb then raise exception 'audit dry run wrong %',a;end if;
end$$;
-- Clearing a period returns it to unset; the dry run deleted nothing.
select rush.save_retention_policy('audit_events',null,2) is not null;
reset role;
do $$begin
 if (select keep_months from rush.retention_policies where category='audit_events') is not null then raise exception 'not cleared';end if;
 if (select count(*) from rush.member_tool_records)<>4 or not exists(select 1 from rush.audit_events where action='SOMETHING_OLD') then raise exception 'dry run deleted data';end if;
 if (select count(*) from rush.audit_events where action='RETENTION_POLICY_CHANGED' and metadata ? 'keepMonths')<>3 then raise exception 'retention audit wrong';end if;
end$$;
select 'cycle records assertions passed' as result;
