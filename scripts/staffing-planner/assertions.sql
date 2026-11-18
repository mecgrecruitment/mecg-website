\set ON_ERROR_STOP on
-- 1 board, 2 member, 3 member (no submission), 4 panel only, 5 owner of another cycle, 6 inactive profile, 7 revoked membership
insert into rush.rush_cycles values('fall'),('spring');
insert into rush.profiles(id,display_name,active) values
 ('00000000-0000-4000-8000-000000000001','Board',true),('00000000-0000-4000-8000-000000000002','Avery',true),
 ('00000000-0000-4000-8000-000000000003','Blake',true),('00000000-0000-4000-8000-000000000004','Panelist',true),
 ('00000000-0000-4000-8000-000000000005','Other owner',true),('00000000-0000-4000-8000-000000000006','Gone',false),
 ('00000000-0000-4000-8000-000000000007','Revoked',true);
insert into rush.memberships(cycle_id,user_id,role,active) values
 ('fall','00000000-0000-4000-8000-000000000001','BOARD',true),
 ('fall','00000000-0000-4000-8000-000000000002','MEMBER',true),('fall','00000000-0000-4000-8000-000000000002','PANEL',true),
 ('fall','00000000-0000-4000-8000-000000000003','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000004','PANEL',true),('spring','00000000-0000-4000-8000-000000000005','OWNER',true),
 ('spring','00000000-0000-4000-8000-000000000002','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000006','MEMBER',true),('fall','00000000-0000-4000-8000-000000000007','MEMBER',false);
insert into rush.projects(id,title,sort_order) values('p1','Pricing study',1),('p2','Market entry',2),('p3','Ops review',3),('p4','Supply chain',4);
insert into rush.project_members values('p1','00000000-0000-4000-8000-000000000002'),('p2','00000000-0000-4000-8000-000000000002'),('p1','00000000-0000-4000-8000-000000000003');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.member(cycle text, uid text) returns jsonb language sql as $$
 select m from jsonb_array_elements(rush.staffing_plan(cycle)->'members') m where m->>'userId'=uid$$;
set role authenticated;

-- Direct table access and internal helpers are denied.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select * from rush.staffing_availability$q$,'42501');
select pg_temp.expect_error($q$insert into rush.staffing_availability(cycle_id,user_id,weekly_hours) values('fall','00000000-0000-4000-8000-000000000002',5)$q$,'42501');
select pg_temp.expect_error($q$select rush.staffing_is_member('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.staffing_availability_json('fall','00000000-0000-4000-8000-000000000003')$q$,'42501');

-- A member starts with nothing submitted.
do $$declare r jsonb := rush.my_staffing_availability('fall'); begin
 if r<>'{"cycleId":"fall","submitted":false,"weeklyHours":null,"skills":[],"preferredProjectIds":[],"notes":"","revision":0,"updatedAt":null}'::jsonb then raise exception 'empty availability wrong: %', r; end if;
end$$;

-- Validation.
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,41,'[]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,-1,'[]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,null,'[]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',-1,5,'[]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'["a","b","c","d","e","f","g","h","i","j","k","l","m"]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'["   "]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[3]','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,$j$["$q$||repeat('x',41)||$q$"]$j$,'[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'{}','[]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','["p1","p2","p3","p4"]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','["p1","p1"]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','["missing"]','')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','[]','$q$||repeat('x',501)||$q$')$q$,'22023');

-- First save; skills are trimmed and de-duplicated case-insensitively, first spelling and order kept.
do $$declare r jsonb := rush.save_my_staffing_availability('fall',0,8,'[" Excel ","Modeling","excel","SQL"]','["p3","p1"]','  Free after 4pm  '); begin
 if r->>'submitted'<>'true' or (r->>'weeklyHours')::int<>8 or r->'skills'<>'["Excel","Modeling","SQL"]'::jsonb
  or r->'preferredProjectIds'<>'["p3","p1"]'::jsonb or r->>'notes'<>'Free after 4pm' or (r->>'revision')::int<>1 then raise exception 'first save wrong: %', r; end if;
end$$;
-- A second first-save (another tab) is stale; so is a wrong revision.
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,4,'[]','[]','')$q$,'55000');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',2,4,'[]','[]','')$q$,'55000');
do $$declare r jsonb := rush.save_my_staffing_availability('fall',1,10,'["SQL"]','[]',''); begin
 if (r->>'revision')::int<>2 or (r->>'weeklyHours')::int<>10 or r->'preferredProjectIds'<>'[]'::jsonb then raise exception 'update wrong: %', r; end if;
end$$;
-- The same member's spring availability is separate.
do $$declare r jsonb := rush.my_staffing_availability('spring'); begin
 if (r->>'submitted')::boolean then raise exception 'spring leaked fall: %', r; end if; end$$;
do $$begin perform rush.save_my_staffing_availability('spring',0,3,'[]','[]',''); end$$;
-- A member cannot read the board view.
select pg_temp.expect_error($q$select rush.staffing_plan('fall')$q$,'42501');

-- Panel-only, revoked, inactive and anonymous callers have no availability of their own.
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
select pg_temp.expect_error($q$select rush.my_staffing_availability('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','[]','')$q$,'42501');
select pg_temp.expect_error($q$select rush.staffing_plan('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000007',false);
select pg_temp.expect_error($q$select rush.my_staffing_availability('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000006',false);
select pg_temp.expect_error($q$select rush.save_my_staffing_availability('fall',0,5,'[]','[]','')$q$,'42501');
select set_config('test.actor','',false);
select pg_temp.expect_error($q$select rush.my_staffing_availability('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.staffing_plan('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.staffing_plan(null)$q$,'42501');

-- Another cycle's owner cannot read fall, but reads spring.
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
select pg_temp.expect_error($q$select rush.staffing_plan('fall')$q$,'42501');
do $$declare r jsonb := rush.staffing_plan('spring'); begin
 if (select array_agg(m->>'name' order by m->>'name') from jsonb_array_elements(r->'members') m)<>array['Avery','Other owner'] then raise exception 'spring member set wrong: %', r; end if;
 if (pg_temp.member('spring','00000000-0000-4000-8000-000000000002')->>'weeklyHours')::int<>3 then raise exception 'spring hours wrong'; end if;
end$$;

-- The board of the cycle sees every member, submitted or not, and their load.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
do $$declare r jsonb := rush.staffing_plan('fall'); a jsonb := pg_temp.member('fall','00000000-0000-4000-8000-000000000002');
 b jsonb := pg_temp.member('fall','00000000-0000-4000-8000-000000000003'); begin
 if (select array_agg(m->>'name' order by m->>'name') from jsonb_array_elements(r->'members') m)<>array['Avery','Blake','Board'] then raise exception 'member set wrong: %', r->'members'; end if;
 if r->'projects'<>'[{"id":"p1","title":"Pricing study","semester":"","staffCount":2},{"id":"p2","title":"Market entry","semester":"","staffCount":1},{"id":"p3","title":"Ops review","semester":"","staffCount":0},{"id":"p4","title":"Supply chain","semester":"","staffCount":0}]'::jsonb then raise exception 'projects wrong: %', r->'projects'; end if;
 if a->'roles'<>'["MEMBER","PANEL"]'::jsonb or (a->>'weeklyHours')::int<>10 or a->'skills'<>'["SQL"]'::jsonb or a->'staffedProjectIds'<>'["p1","p2"]'::jsonb or (a->>'revision')::int<>2 then raise exception 'Avery wrong: %', a; end if;
 if (b->>'submitted')::boolean or b->'weeklyHours'<>'null'::jsonb or b->'staffedProjectIds'<>'["p1"]'::jsonb then raise exception 'Blake wrong: %', b; end if;
 if exists(select 1 from jsonb_object_keys(a) k where k not in ('userId','name','roles','staffedProjectIds','submitted','weeklyHours','skills','preferredProjectIds','notes','revision','updatedAt')) then raise exception 'extra keys: %', a; end if;
end$$;
-- The board can save its own availability but there is no RPC to write a member's.
do $$begin perform rush.save_my_staffing_availability('fall',0,2,'[]','[]',''); end$$;
reset role;
do $$begin
 if (select count(*) from rush.audit_events where action='STAFFING_AVAILABILITY_SAVED')<>4 then raise exception 'audit count wrong'; end if;
 -- Audit metadata carries the revision only, never skills or notes.
 if exists(select 1 from rush.audit_events where metadata::text ~* 'excel|sql|4pm' or exists(select 1 from jsonb_object_keys(metadata) k where k<>'revision')) then raise exception 'audit copied content'; end if;
 if (select resource_id from rush.audit_events where cycle_id='fall' order by (metadata->>'revision')::int desc limit 1)<>'00000000-0000-4000-8000-000000000002' then raise exception 'audit resource wrong'; end if;
end$$;
-- Deleting a project leaves stored preferences pointing nowhere; the board view tolerates that.
delete from rush.projects where id='p3';
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
set role authenticated;
do $$begin if jsonb_array_length(rush.staffing_plan('fall')->'projects')<>3 then raise exception 'deleted project still listed'; end if; end$$;
reset role;
select 'staffing planner assertions passed' as result;
