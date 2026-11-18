\set ON_ERROR_STOP on
-- 1 member, 2 board, 3 owner in another cycle, 4 panel, 5 board with an inactive profile, 6 incoming member, 7 profile with no active membership
insert into rush.rush_cycles(id,name) values('test','Fall 2026'),('other','Winter 2027');
insert into rush.profiles(id,display_name,active) values('00000000-0000-4000-8000-000000000001','Member',true),('00000000-0000-4000-8000-000000000002','Board',true),
 ('00000000-0000-4000-8000-000000000003','Owner',true),('00000000-0000-4000-8000-000000000004','Panel',true),('00000000-0000-4000-8000-000000000005','Gone',false),
 ('00000000-0000-4000-8000-000000000006','Incoming',true),('00000000-0000-4000-8000-000000000007','Alumni',true);
insert into rush.memberships(cycle_id,user_id,role,active) values('test','00000000-0000-4000-8000-000000000001','MEMBER',true),('test','00000000-0000-4000-8000-000000000002','BOARD',true),
 ('test','00000000-0000-4000-8000-000000000002','MEMBER',true),('other','00000000-0000-4000-8000-000000000003','OWNER',true),('test','00000000-0000-4000-8000-000000000004','PANEL',true),
 ('test','00000000-0000-4000-8000-000000000005','BOARD',true),('test','00000000-0000-4000-8000-000000000006','MEMBER',true),('test','00000000-0000-4000-8000-000000000007','MEMBER',false);
-- The outgoing officer (board) is the evidence reviewer in the test cycle; a record they own must never appear.
insert into rush.member_tool_reviewers(cycle_id,kind,user_id) values('test','evidence','00000000-0000-4000-8000-000000000002');
insert into rush.member_tool_records(id,cycle_id,kind,owner_id,content) values('00000000-0000-4000-8000-0000000000aa','test','evidence','00000000-0000-4000-8000-000000000002','{"title":"Secret client win"}');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.form(extra jsonb default '{}') returns jsonb language sql as $$select '{"roleTitle":"Treasurer","outgoingId":"00000000-0000-4000-8000-000000000002","incomingId":"00000000-0000-4000-8000-000000000006","dueOn":"2026-12-15","status":"OPEN","notes":"Bank signatory change needs both officers at the branch.","items":[{"id":null,"kind":"ACCOUNT","label":"Club bank account signatory","detail":"Branch appointment","done":false},{"id":null,"kind":"ACCESS","label":"Evidence reviewer grant","detail":"","done":true},{"id":null,"kind":"OPEN_ITEM","label":"Pending reimbursements","detail":"Two receipts outstanding","done":false}]}'::jsonb || extra$$;
grant execute on function pg_temp.form(jsonb) to authenticated;
create temp table ids(name text, id uuid);
grant all on ids to authenticated;
set role authenticated;

-- Direct table access and helper functions are denied to every signed-in role.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select * from rush.officer_handoffs$q$,'42501');
select pg_temp.expect_error($q$select * from rush.officer_handoff_items$q$,'42501');
select pg_temp.expect_error($q$select rush.officer_handoff_is_board()$q$,'42501');
select pg_temp.expect_error($q$select rush.officer_handoff_access('00000000-0000-4000-8000-000000000002')$q$,'42501');

-- Members, panel-only members and inactive board profiles cannot read or write.
do $$declare who text; begin
 foreach who in array array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006'] loop
  perform set_config('test.actor',who,false);
  perform pg_temp.expect_error($q$select rush.officer_handoffs()$q$,'42501');
  perform pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form())$q$,'42501');
 end loop; end$$;

-- Board starts empty; the people list holds active profiles with an active membership only.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
do $$declare r jsonb := rush.officer_handoffs(); begin
 if r->'handoffs'<>'[]'::jsonb then raise exception 'not empty';end if;
 if (select array_agg(p->>'name' order by p->>'name') from jsonb_array_elements(r->'people') p)<>array['Board','Incoming','Member','Owner','Panel'] then raise exception 'people wrong: %',r->'people';end if;
end$$;

-- Create: items keep their order, a ticked item records who and when, access lists roles and grants but no records.
insert into ids select 'treasurer',(rush.save_officer_handoff(null,0,pg_temp.form())->>'id')::uuid;
do $$declare h jsonb := rush.officer_handoffs()->'handoffs'->0; begin
 if h->>'roleTitle'<>'Treasurer' or (h->>'revision')::int<>1 or h->>'status'<>'OPEN' or h->>'outgoingName'<>'Board' or h->>'incomingName'<>'Incoming'
  or h->>'dueOn'<>'2026-12-15' or h->'completedAt'<>'null'::jsonb or h->>'createdByName'<>'Board' then raise exception 'handoff wrong: %',h;end if;
 if (select array_agg(i->>'label' order by o) from jsonb_array_elements(h->'items') with ordinality t(i,o))<>array['Club bank account signatory','Evidence reviewer grant','Pending reimbursements']
  or (h->'items'->1->>'done')::boolean is not true or h->'items'->1->>'doneByName'<>'Board' or h->'items'->1->'doneAt'='null'::jsonb
  or (h->'items'->0->>'done')::boolean or h->'items'->0->'doneAt'<>'null'::jsonb then raise exception 'items wrong: %',h->'items';end if;
 if h->'access'->'outgoing'->'roles'<>'[{"role":"BOARD","cycleId":"test","cycleName":"Fall 2026"}]'::jsonb
  or h->'access'->'outgoing'->'reviewerGrants'<>'[{"tool":"evidence","cycleId":"test","cycleName":"Fall 2026"}]'::jsonb
  or h->'access'->'incoming'<>'{"roles":[],"reviewerGrants":[]}'::jsonb then raise exception 'access wrong: %',h->'access';end if;
 if h::text ~* 'secret client win' then raise exception 'member-tool record leaked';end if;
end$$;

-- A handoff with no incoming officer yet and no date sorts after one with a due date.
insert into ids select 'president',(rush.save_officer_handoff(null,0,pg_temp.form('{"roleTitle":"President","incomingId":null,"dueOn":null,"notes":"","items":[]}'))->>'id')::uuid;
do $$declare l jsonb := rush.officer_handoffs()->'handoffs'; begin
 if l->0->>'roleTitle'<>'Treasurer' or l->1->>'roleTitle'<>'President' or l->1->'access'->'incoming'<>'null'::jsonb then raise exception 'order wrong: %',l;end if;end$$;

-- Validation.
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,1,pg_temp.form())$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"secret":"x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form()-'notes')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"roleTitle":""}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"roleTitle":" Treasurer "}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"status":"DONE"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"dueOn":"2026-02-30"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"dueOn":"12/15/2026"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"outgoingId":"not-a-uuid"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"incomingId":"00000000-0000-4000-8000-000000000002"}'))$q$,'22023');
-- Inactive profile, a profile with no active membership, and an unknown id cannot be named.
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"incomingId":"00000000-0000-4000-8000-000000000005"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"incomingId":"00000000-0000-4000-8000-000000000007"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"outgoingId":"00000000-0000-4000-8000-0000000000ff"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"items":[{"id":null,"kind":"BANK","label":"x","detail":"","done":false}]}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"items":[{"id":null,"kind":"ACCOUNT","label":"","detail":"","done":false}]}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"items":[{"id":null,"kind":"ACCOUNT","label":"x","detail":"","done":"yes"}]}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"items":[{"id":null,"kind":"ACCOUNT","label":"x","detail":""}]}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form(jsonb_build_object('items',(select jsonb_agg('{"id":null,"kind":"ACCOUNT","label":"x","detail":"","done":false}'::jsonb) from generate_series(1,41)))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form(jsonb_build_object('notes',repeat('x',2001))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"items":[{"id":"00000000-0000-4000-8000-0000000000ab","kind":"ACCOUNT","label":"x","detail":"","done":false}]}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,'[]'::jsonb)$q$,'22023');
-- Complete needs the incoming officer and every item ticked.
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,pg_temp.form('{"status":"COMPLETE"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_officer_handoff((select id from ids where name='president'),1,pg_temp.form('{"roleTitle":"President","incomingId":null,"dueOn":null,"notes":"","items":[],"status":"COMPLETE"}'))$q$,'22023');

-- Edit as an owner from another cycle: reorder, edit, tick, remove and add items in one save.
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
create temp table item_ids as select (i->>'id')::uuid id, i->>'label' label, i->>'doneAt' done_at from jsonb_array_elements((select h from jsonb_array_elements(rush.officer_handoffs()->'handoffs') h where h->>'roleTitle'='Treasurer')->'items') i;
grant all on item_ids to authenticated;
do $$declare r jsonb; begin
 r := rush.save_officer_handoff((select id from ids where name='treasurer'),1,pg_temp.form(jsonb_build_object('items',jsonb_build_array(
  jsonb_build_object('id',(select id from item_ids where label='Evidence reviewer grant'),'kind','ACCESS','label','Evidence reviewer grant','detail','','done',true),
  jsonb_build_object('id',(select id from item_ids where label='Club bank account signatory'),'kind','ACCOUNT','label','Club bank account signatory','detail','Done at the branch','done',true),
  jsonb_build_object('id',null,'kind','ACCOUNT','label','Shared drive owner','detail','','done',false)))));
 if (r->>'revision')::int<>2 or r->>'updatedByName'<>'Owner' or jsonb_array_length(r->'items')<>3 then raise exception 'edit wrong: %',r;end if;
 if r->'items'->0->>'label'<>'Evidence reviewer grant' or r->'items'->0->>'doneByName'<>'Board' or r->'items'->0->>'doneAt'<>(select done_at from item_ids where label='Evidence reviewer grant')
  or r->'items'->1->>'doneByName'<>'Owner' or r->'items'->1->>'detail'<>'Done at the branch' or (r->'items'->2->>'done')::boolean then raise exception 'item tracking wrong: %',r->'items';end if;
 if exists(select 1 from jsonb_array_elements(r->'items') i where i->>'label'='Pending reimbursements') then raise exception 'removed item kept';end if;
end$$;
-- Stale revision, an item id from another handoff (or removed), and an unknown handoff.
select pg_temp.expect_error($q$select rush.save_officer_handoff((select id from ids where name='treasurer'),1,pg_temp.form())$q$,'55000');
select pg_temp.expect_error($q$select rush.save_officer_handoff((select id from ids where name='treasurer'),2,pg_temp.form(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',(select id from item_ids where label='Pending reimbursements'),'kind','OPEN_ITEM','label','x','detail','','done',false)))))$q$,'55000');
select pg_temp.expect_error($q$select rush.save_officer_handoff('00000000-0000-4000-8000-0000000000ff',1,pg_temp.form())$q$,'P0002');
select pg_temp.expect_error($q$select rush.save_officer_handoff((select id from ids where name='treasurer'),0,pg_temp.form())$q$,'22023');

-- The same item id twice, in different letter case, is refused.
select pg_temp.expect_error(format('select rush.save_officer_handoff(%L,2,%L)',(select id from ids where name='treasurer'),pg_temp.form(jsonb_build_object('items',jsonb_build_array(
 jsonb_build_object('id',(select id from item_ids where label='Evidence reviewer grant')::text,'kind','ACCESS','label','a','detail','','done',true),
 jsonb_build_object('id',upper((select id from item_ids where label='Evidence reviewer grant')::text),'kind','ACCESS','label','b','detail','','done',true))))),'22023');
-- Saving the same form again is not a new revision.
create temp table current_form as select jsonb_build_object('roleTitle',h->'roleTitle','outgoingId',h->'outgoingId','incomingId',h->'incomingId','dueOn',h->'dueOn','status',h->'status','notes',h->'notes',
 'items',(select jsonb_agg(jsonb_build_object('id',i->'id','kind',i->'kind','label',i->'label','detail',i->'detail','done',i->'done') order by o) from jsonb_array_elements(h->'items') with ordinality t(i,o))) f
 from jsonb_array_elements(rush.officer_handoffs()->'handoffs') h where h->>'roleTitle'='Treasurer';
grant all on current_form to authenticated;
do $$begin if (rush.save_officer_handoff((select id from ids where name='treasurer'),2,(select f from current_form))->>'revision')::int<>2 then raise exception 'no-op bumped revision';end if;end$$;
do $$declare f jsonb := (select f from current_form); begin
 f := jsonb_set(f,'{items}',(select jsonb_agg(jsonb_set(i,'{id}',to_jsonb(upper(i->>'id'))) order by o) from jsonb_array_elements(f->'items') with ordinality t(i,o)));
 if (rush.save_officer_handoff((select id from ids where name='treasurer'),2,f)->>'revision')::int<>2 then raise exception 'upper-case ids bumped revision';end if;end$$;

-- Unticking clears who and when; ticking everything allows Complete, which sets completedAt and moves it after open ones.
do $$declare f jsonb := (select f from current_form); r jsonb; begin
 r := rush.save_officer_handoff((select id from ids where name='treasurer'),2,jsonb_set(f,'{items,0,done}','false'));
 if (r->'items'->0->>'done')::boolean or r->'items'->0->'doneByName'<>'null'::jsonb then raise exception 'untick wrong: %',r->'items'->0;end if;
 f := jsonb_set(jsonb_set(jsonb_set(f,'{items,0,done}','true'),'{items,2,done}','true'),'{status}','"COMPLETE"');
 r := rush.save_officer_handoff((select id from ids where name='treasurer'),3,f);
 if r->>'status'<>'COMPLETE' or r->'completedAt'='null'::jsonb or (r->>'revision')::int<>4 then raise exception 'complete wrong: %',r;end if;
 if rush.officer_handoffs()->'handoffs'->0->>'roleTitle'<>'President' then raise exception 'complete should sort after open';end if;
end$$;
-- A complete handoff cannot be made incomplete while staying Complete; reopening clears completedAt.
do $$declare f jsonb := jsonb_set((select f from current_form),'{status}','"COMPLETE"'); begin
 f := jsonb_set(jsonb_set(f,'{items,0,done}','true'),'{items,2,done}','false');
 perform pg_temp.expect_error(format('select rush.save_officer_handoff(%L,4,%L)',(select id from ids where name='treasurer'),f),'22023');
 if (rush.save_officer_handoff((select id from ids where name='treasurer'),4,jsonb_set(f,'{status}','"OPEN"'))->'completedAt')<>'null'::jsonb then raise exception 'reopen kept completedAt';end if;
end$$;

-- An officer who has since left can stay on an existing handoff, but cannot be newly named.
reset role;
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000006';
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
do $$declare f jsonb := jsonb_set((select f from current_form),'{notes}','"Incoming officer left; keeping the record."'); begin
 if (rush.save_officer_handoff((select id from ids where name='treasurer'),5,f)->>'revision')::int<>6 then raise exception 'kept officer save failed';end if;
 perform pg_temp.expect_error(format('select rush.save_officer_handoff(%L,1,%L)',(select id from ids where name='president'),
  pg_temp.form('{"roleTitle":"President","incomingId":"00000000-0000-4000-8000-000000000006","dueOn":null,"notes":"","items":[]}')),'22023');
end$$;

-- Audit metadata records structure, never the role title, notes, item labels or details.
reset role;
do $$begin
 if (select count(*) from rush.audit_events where resource='OfficerHandoff')<>7 then raise exception 'audit count wrong: %',(select count(*) from rush.audit_events where resource='OfficerHandoff');end if;
 if (select metadata->'changed' from rush.audit_events where action='OFFICER_HANDOFF_UPDATED' and (metadata->>'revision')::int=2)<>'["items"]'::jsonb then raise exception 'changed fields wrong';end if;
 if (select metadata->'changed' from rush.audit_events where action='OFFICER_HANDOFF_UPDATED' and (metadata->>'revision')::int=4)<>'["status", "items"]'::jsonb then raise exception 'complete changed fields wrong';end if;
 if exists(select 1 from rush.audit_events where resource='OfficerHandoff' and metadata::text ~* '(treasurer|president|bank|signatory|reimburse|drive|branch|receipt|evidence reviewer|left)') then raise exception 'audit leaked content';end if;
end$$;

-- Deactivated board loses access; anonymous callers cannot execute anything.
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select rush.officer_handoffs()$q$,'42501');
reset role;
set role anon;
select pg_temp.expect_error($q$select rush.officer_handoffs()$q$,'42501');
select pg_temp.expect_error($q$select rush.save_officer_handoff(null,0,'{}'::jsonb)$q$,'42501');
reset role;
select 'officer handoff assertions passed' as result;
