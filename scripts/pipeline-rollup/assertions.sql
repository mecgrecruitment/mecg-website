\set ON_ERROR_STOP on
-- 1 board, 2 member A (pipeline owner), 3 owner, 4 board + pipeline reviewer, 5 board of other cycle only,
-- 6 member B (owner of records), 7 panel only, 8 inactive board profile, 9 revoked board membership
insert into rush.rush_cycles(id) values('fall'),('spring');
insert into rush.profiles(id,display_name,active) values
 ('00000000-0000-4000-8000-000000000001','Board',true),('00000000-0000-4000-8000-000000000002','Avery',true),
 ('00000000-0000-4000-8000-000000000003','Owner',true),('00000000-0000-4000-8000-000000000004','Reviewer',true),
 ('00000000-0000-4000-8000-000000000005','Spring board',true),('00000000-0000-4000-8000-000000000006','Blake',true),
 ('00000000-0000-4000-8000-000000000007','Panelist',true),('00000000-0000-4000-8000-000000000008','Gone',false),
 ('00000000-0000-4000-8000-000000000009','Revoked',true);
insert into rush.memberships(cycle_id,user_id,role,active) values
 ('fall','00000000-0000-4000-8000-000000000001','BOARD',true),('fall','00000000-0000-4000-8000-000000000002','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000003','OWNER',true),('fall','00000000-0000-4000-8000-000000000004','BOARD',true),
 ('spring','00000000-0000-4000-8000-000000000005','BOARD',true),('fall','00000000-0000-4000-8000-000000000006','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000007','PANEL',true),('fall','00000000-0000-4000-8000-000000000008','BOARD',true),
 ('fall','00000000-0000-4000-8000-000000000009','BOARD',false);
insert into rush.member_tool_reviewers values('fall','pipeline','00000000-0000-4000-8000-000000000004'),
 -- An evidence grant does not unlock pipeline titles.
 ('fall','evidence','00000000-0000-4000-8000-000000000001');
create function pg_temp.rec(id int, cycle text, kind text, owner int, content jsonb) returns void language sql as $$
 insert into rush.member_tool_records(id,cycle_id,kind,owner_id,content)
 values(('10000000-0000-4000-8000-'||lpad(id::text,12,'0'))::uuid,cycle,kind,('00000000-0000-4000-8000-'||lpad(owner::text,12,'0'))::uuid,content)$$;
-- Dates relative to Detroit today.
create function pg_temp.d(days int) returns text language sql as $$select to_char((now() at time zone 'America/Detroit')::date+days,'YYYY-MM-DD')$$;
select pg_temp.rec(1,'fall','pipeline',2,jsonb_build_object('title','SECRET Acme','track','Client','stage','Proposal','problem','SECRET problem','source','https://example.com/secret','nextAction','SECRET action','nextDate',pg_temp.d(-3)));
select pg_temp.rec(2,'fall','pipeline',2,jsonb_build_object('title','SECRET Beta','track','Client','stage','Proposal','problem','p','source','https://example.com','nextAction','a','nextDate',pg_temp.d(0)));
select pg_temp.rec(3,'fall','pipeline',6,jsonb_build_object('title','SECRET Gamma','track','Sponsor','stage','Research','problem','p','source','https://example.com','nextAction','a','nextDate',pg_temp.d(-1)));
select pg_temp.rec(4,'fall','pipeline',6,jsonb_build_object('title','SECRET Delta','track','Sponsor','stage','Closed','problem','p','source','https://example.com','nextAction','a','nextDate',pg_temp.d(-30)));
select pg_temp.rec(5,'fall','pipeline',6,jsonb_build_object('title','SECRET Eps','track','Client','stage','Dormant','problem','p','source','https://example.com','nextAction','a'));
select pg_temp.rec(6,'fall','pipeline',6,jsonb_build_object('title','SECRET Zeta','track','Sponsor','stage','Agreed','problem','p','source','https://example.com','nextAction','a','nextDate',pg_temp.d(5)));
-- Bad stored values must not break the rollup: unknown stage, invalid date.
select pg_temp.rec(7,'fall','pipeline',6,'{"title":"SECRET Odd","track":"Client","stage":"Won","nextDate":"2020-01-01"}');
select pg_temp.rec(8,'fall','pipeline',6,'{"title":"SECRET Bad date","track":"Client","stage":"Qualified","nextDate":"2026-02-30"}');
-- Other kinds and other cycles are not counted.
select pg_temp.rec(9,'fall','evidence',2,'{"title":"SECRET evidence","nextDate":"2020-01-01"}');
select pg_temp.rec(10,'spring','pipeline',5,jsonb_build_object('title','SECRET spring','track','Client','stage','Proposal','nextDate',pg_temp.d(-3)));
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.cell(r jsonb, s text, t text) returns jsonb language sql as $$
 select c from jsonb_array_elements(r->'cells') c where c->>'stage'=s and c->>'track'=t$$;
set role authenticated;

-- Board: counts only, no titles or other content anywhere in the payload.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
do $$declare r jsonb := rush.pipeline_rollup('fall'); begin
 if r::text ~ 'SECRET|example.com|10000000-' then raise exception 'board rollup leaked record content: %',r; end if;
 if (select array_agg(k order by k) from jsonb_object_keys(r) k)<>array['asOf','canReview','cells','cycleId','overdue','overdueRecords','total','unclassified'] then raise exception 'unexpected keys %',r; end if;
 if (r->>'total')::int<>8 then raise exception 'total %',r->>'total'; end if;
 if (r->>'unclassified')::int<>1 then raise exception 'unclassified %',r->>'unclassified'; end if;
 -- Overdue: 1 (past, Proposal) and 3 (past, Research). Not 2 (today), 4 (Closed), 5 (no date), 6 (future), 7 (unclassified), 8 (invalid date).
 if (r->>'overdue')::int<>2 then raise exception 'overdue %',r->>'overdue'; end if;
 if (r->>'canReview')::boolean or r->'overdueRecords'<>'null'::jsonb then raise exception 'board got reviewer detail'; end if;
 if jsonb_array_length(r->'cells')<>14 then raise exception 'grid size'; end if;
 if pg_temp.cell(r,'Proposal','Client')<>'{"stage":"Proposal","track":"Client","count":2,"overdue":1}'::jsonb then raise exception 'proposal cell %',pg_temp.cell(r,'Proposal','Client'); end if;
 if pg_temp.cell(r,'Research','Sponsor')->>'overdue'<>'1' or pg_temp.cell(r,'Closed','Sponsor')<>'{"stage":"Closed","track":"Sponsor","count":1,"overdue":0}'::jsonb then raise exception 'research/closed cells'; end if;
 if pg_temp.cell(r,'Qualified','Client')->>'count'<>'1' then raise exception 'invalid-date record not counted in its stage'; end if;
 if r->'cells'->0->>'stage'<>'Research' or r->'cells'->0->>'track'<>'Client' or r->'cells'->13->>'stage'<>'Closed' then raise exception 'grid order'; end if;
 if r->>'asOf'<>to_char((now() at time zone 'America/Detroit')::date,'YYYY-MM-DD') then raise exception 'asOf'; end if;
end$$;
-- The owner of the cycle sees counts only too (owner rank grants no reviewer access).
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
do $$begin if rush.pipeline_rollup('fall')::text ~ 'SECRET' or (rush.pipeline_rollup('fall')->>'canReview')::boolean then raise exception 'owner leaked'; end if; end$$;

-- A board member who is already a pipeline reviewer gets the overdue titles only.
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
do $$declare r jsonb := rush.pipeline_rollup('fall'); begin
 if not (r->>'canReview')::boolean or jsonb_array_length(r->'overdueRecords')<>2 then raise exception 'reviewer list %',r->'overdueRecords'; end if;
 if r->'overdueRecords'->0->>'title'<>'SECRET Acme' or r->'overdueRecords'->0->>'ownerName'<>'Avery' or r->'overdueRecords'->1->>'title'<>'SECRET Gamma' then raise exception 'reviewer order %',r->'overdueRecords'; end if;
 if (select array_agg(k order by k) from jsonb_object_keys(r->'overdueRecords'->0) k)<>array['id','nextDate','ownerName','stage','title','track'] then raise exception 'reviewer record keys'; end if;
 if r::text ~ 'SECRET problem|SECRET action|example.com|SECRET Beta|SECRET Zeta' then raise exception 'reviewer got more than overdue titles'; end if;
end$$;
-- Revoking the grant removes the titles on the next read.
reset role;
delete from rush.member_tool_reviewers where cycle_id='fall' and kind='pipeline' and user_id='00000000-0000-4000-8000-000000000004';
set role authenticated;
do $$begin if rush.pipeline_rollup('fall')::text ~ 'SECRET' then raise exception 'revoked reviewer kept titles'; end if; end$$;
-- A pipeline reviewer grant in another cycle does not unlock this cycle.
reset role;
insert into rush.member_tool_reviewers values('spring','pipeline','00000000-0000-4000-8000-000000000004');
insert into rush.memberships(cycle_id,user_id,role) values('spring','00000000-0000-4000-8000-000000000004','MEMBER');
set role authenticated;
do $$begin if rush.pipeline_rollup('fall')::text ~ 'SECRET' then raise exception 'cross-cycle grant leaked'; end if; end$$;

-- Cycle isolation: spring board sees only spring.
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
do $$begin if (rush.pipeline_rollup('spring')->>'total')::int<>1 or (rush.pipeline_rollup('spring')->>'overdue')::int<>1 then raise exception 'spring counts'; end if; end$$;
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');

-- Refused: members (even record owners), panel-only, inactive profile, revoked membership, no actor, null cycle.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000007',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000008',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000009',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
select set_config('test.actor','',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error($q$select rush.pipeline_rollup(null)$q$,'42501');
-- Direct table access stays denied.
select pg_temp.expect_error($q$select * from rush.member_tool_records$q$,'42501');
reset role;
set role anon;
select pg_temp.expect_error($q$select rush.pipeline_rollup('fall')$q$,'42501');
reset role;
-- Empty cycle: full zero grid.
insert into rush.rush_cycles(id) values('empty');
insert into rush.memberships(cycle_id,user_id,role) values('empty','00000000-0000-4000-8000-000000000001','BOARD');
set role authenticated;
do $$declare r jsonb := rush.pipeline_rollup('empty'); begin
 if (r->>'total')::int<>0 or jsonb_array_length(r->'cells')<>14 or exists(select 1 from jsonb_array_elements(r->'cells') c where (c->>'count')::int<>0) then raise exception 'empty grid %',r; end if;
end$$;
reset role;
select 'pipeline rollup assertions passed' as result;
