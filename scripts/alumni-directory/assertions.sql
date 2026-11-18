\set ON_ERROR_STOP on
-- 1 member, 2 board, 3 owner in another cycle, 4 panel only, 5 board with an inactive profile,
-- 6 recruitment committee, 7 alum whose membership ended, 8 another member, 9 signed in with no profile
insert into rush.profiles(id,display_name,active,grad_term,major) values
 ('00000000-0000-4000-8000-000000000001','Morgan Member',true,' Winter 2027 ','Industrial and Operations Engineering'),
 ('00000000-0000-4000-8000-000000000002','Bailey Board',true,null,null),
 ('00000000-0000-4000-8000-000000000003','Olivia Owner',true,null,null),('00000000-0000-4000-8000-000000000004','Pat Panel',true,null,null),
 ('00000000-0000-4000-8000-000000000005','Gone',false,null,null),('00000000-0000-4000-8000-000000000006','Casey Committee',true,null,null),
 ('00000000-0000-4000-8000-000000000007','alex Alum',true,'Winter 2025','Mechanical Engineering'),('00000000-0000-4000-8000-000000000008','Other Member',true,null,null);
insert into rush.memberships(cycle_id,user_id,role,active) values('test','00000000-0000-4000-8000-000000000001','MEMBER',true),('test','00000000-0000-4000-8000-000000000002','BOARD',true),
 ('other','00000000-0000-4000-8000-000000000003','OWNER',true),('test','00000000-0000-4000-8000-000000000004','PANEL',true),('test','00000000-0000-4000-8000-000000000005','BOARD',true),
 ('test','00000000-0000-4000-8000-000000000006','RECRUITMENT_COMMITTEE',true),('old','00000000-0000-4000-8000-000000000007','MEMBER',false),
 ('test','00000000-0000-4000-8000-000000000008','MEMBER',true);
-- The alum listed themselves while still a member.
insert into rush.alumni_listings(profile_id,grad_term,employer) values('00000000-0000-4000-8000-000000000007','Winter 2025','Deloitte');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error % from %',expected,command; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.form(extra jsonb default '{}') returns jsonb language sql as $$select '{"gradTerm":"Winter 2027","major":"Industrial and Operations Engineering","employer":"Ford","jobTitle":"Analyst","location":"Detroit, MI","linkedinUrl":"https://www.linkedin.com/in/morgan-example","contactEmail":"morgan@example.invalid","note":"Happy to talk about operations roles."}'::jsonb || extra$$;
create function pg_temp.as_actor(n int) returns void language sql as $$select set_config('test.actor',format('00000000-0000-4000-8000-%s',lpad(n::text,12,'0')),false)$$;
grant execute on function pg_temp.form(jsonb), pg_temp.as_actor(int) to authenticated;
create temp table ids(name text, id uuid);
grant all on ids to authenticated;
set role authenticated;

-- Direct table access and helper functions are denied to every signed-in role.
select pg_temp.as_actor(2);
select pg_temp.expect_error($q$select * from rush.alumni_listings$q$,'42501');
select pg_temp.expect_error($q$select rush.alumni_is_board()$q$,'42501');
select pg_temp.expect_error($q$select rush.alumni_is_member()$q$,'42501');
select pg_temp.expect_error($q$select rush.alumni_listing_json(null::rush.alumni_listings)$q$,'42501');

-- Panel-only members, inactive profiles and ended memberships cannot read or add listings.
do $$declare who int; begin
 foreach who in array array[4,5,7,9] loop
  perform pg_temp.as_actor(who);
  perform pg_temp.expect_error($q$select rush.alumni_directory()$q$,'42501');
  perform pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form())$q$,'42501');
 end loop; end$$;
-- Nobody is listed until they add themselves: a new member has no listing.
select pg_temp.as_actor(1);
do $$declare d jsonb := rush.alumni_directory(); begin
 if d->'mine'<>'null'::jsonb or jsonb_array_length(d->'entries')<>1 or (d->>'canRemoveOthers')::boolean
  or d->'defaults'<>'{"gradTerm":"Winter 2027","major":"Industrial and Operations Engineering"}'::jsonb then raise exception 'initial directory wrong: %',d;end if;end$$;

-- Validation.
select pg_temp.expect_error($q$select rush.save_alumni_listing(-1,pg_temp.form())$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(null,pg_temp.form())$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,'[]')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"phone":"555"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form()-'note')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"employer":null}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"employer":7}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"employer":" Ford"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form(jsonb_build_object('note',E'Hi\t')))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form(jsonb_build_object('gradTerm',repeat('x',41))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form(jsonb_build_object('note',repeat('x',501))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"linkedinUrl":"http://www.linkedin.com/in/x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"linkedinUrl":"https://evil.example/linkedin.com/in/x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"linkedinUrl":"https://linkedin.com.evil.example/in/x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"linkedinUrl":"javascript:alert(1)"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"not an email"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"a@b"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"a@b.co?bcc=x@evil.test"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"a@b.co,x@evil.test"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"a%40b@c.co"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form('{"contactEmail":"a@b.co/x"}'))$q$,'22023');
-- Nothing was written by the refused saves.
do $$begin if rush.alumni_directory()->'mine'<>'null'::jsonb then raise exception 'refused save wrote a row';end if;end$$;

-- The member adds a listing; a stale "new" save after that is refused.
insert into ids select 'morgan',(rush.save_alumni_listing(0,pg_temp.form())->>'id')::uuid;
select pg_temp.expect_error($q$select rush.save_alumni_listing(0,pg_temp.form())$q$,'55000');
do $$declare m jsonb := rush.alumni_directory()->'mine'; begin
 if m->>'name'<>'Morgan Member' or m->>'employer'<>'Ford' or m->>'linkedinUrl'<>'https://www.linkedin.com/in/morgan-example'
  or (m->>'isMine')::boolean is not true or (m->>'revision')::int<>1 then raise exception 'own listing wrong: %',m;end if;end$$;

-- Sharing fewer details: empty means not shared. LinkedIn without www and a mixed-case host are accepted.
select rush.save_alumni_listing(1,pg_temp.form('{"employer":"","jobTitle":"","contactEmail":"","linkedinUrl":"https://LinkedIn.com/in/morgan-example"}'));
-- An unchanged save is not a new revision and adds no audit row.
select rush.save_alumni_listing(2,pg_temp.form('{"employer":"","jobTitle":"","contactEmail":"","linkedinUrl":"https://LinkedIn.com/in/morgan-example"}'));
select pg_temp.expect_error($q$select rush.save_alumni_listing(1,pg_temp.form())$q$,'55000');
select pg_temp.expect_error($q$select rush.save_alumni_listing(3,pg_temp.form())$q$,'55000');

-- Other members and the board read the directory, in name order, with only what was shared.
do $$declare who int; d jsonb; e jsonb; begin
 foreach who in array array[8,2,3,6] loop
  perform pg_temp.as_actor(who);
  d := rush.alumni_directory();
  if jsonb_array_length(d->'entries')<>2 or d->'entries'->0->>'name'<>'alex Alum' or d->'entries'->1->>'name'<>'Morgan Member' or d->'mine'<>'null'::jsonb then
   raise exception 'directory for % wrong: %',who,d;end if;
  e := d->'entries'->1;
  if e->>'employer'<>'' or e->>'contactEmail'<>'' or e->>'jobTitle'<>'' or e->>'location'<>'Detroit, MI' or (e->>'isMine')::boolean or (e->>'revision')::int<>2 then
   raise exception 'entry for % wrong: %',who,e;end if;
  if (d->>'canRemoveOthers')::boolean <> (who in (2,3)) then raise exception 'canRemoveOthers wrong for %',who;end if;
 end loop; end$$;
-- The alum's listing shows their current profile name, which a profile change updates.
reset role;
update rush.profiles set display_name='Alex Alum' where id='00000000-0000-4000-8000-000000000007';
set role authenticated;
select pg_temp.as_actor(8);
do $$begin if rush.alumni_directory()->'entries'->0->>'name'<>'Alex Alum' then raise exception 'name not live';end if;end$$;

-- Nobody edits or removes someone else's listing unless they are board.
select pg_temp.as_actor(8);
select pg_temp.expect_error($q$select rush.remove_alumni_listing((select id from ids where name='morgan'))$q$,'P0002');
select pg_temp.as_actor(6);
select pg_temp.expect_error($q$select rush.remove_alumni_listing((select id from ids where name='morgan'))$q$,'P0002');
select pg_temp.as_actor(4);
select pg_temp.expect_error($q$select rush.remove_alumni_listing((select id from ids where name='morgan'))$q$,'P0002');
select pg_temp.as_actor(5);
select pg_temp.expect_error($q$select rush.remove_alumni_listing((select id from ids where name='morgan'))$q$,'P0002');
-- No profile at all: refused outright.
select pg_temp.as_actor(9);
select pg_temp.expect_error($q$select rush.remove_alumni_listing(null)$q$,'42501');
-- A save as another member writes that member's own listing, never Morgan's.
select pg_temp.as_actor(8);
insert into ids select 'other',(rush.save_alumni_listing(0,pg_temp.form('{"employer":"GM","contactEmail":"","note":""}'))->>'id')::uuid;
do $$begin if (select id from ids where name='other')=(select id from ids where name='morgan') then raise exception 'overwrote';end if;end$$;
-- Removing with nothing listed is not an error: it reports false.
select pg_temp.as_actor(6);
do $$begin if rush.remove_alumni_listing(null) then raise exception 'removed something for a non-listed member';end if;end$$;

-- The alum whose membership ended can still opt out of their own listing.
select pg_temp.as_actor(7);
do $$begin if not rush.remove_alumni_listing(null) then raise exception 'alum could not opt out';end if;end$$;
do $$begin if rush.remove_alumni_listing(null) then raise exception 'second opt-out removed something';end if;end$$;
-- A member opts out of their own listing by id too.
select pg_temp.as_actor(8);
do $$begin if not rush.remove_alumni_listing((select id from ids where name='other')) then raise exception 'own removal by id failed';end if;end$$;
-- A board member (owner from another cycle) removes Morgan's listing on request.
select pg_temp.as_actor(3);
do $$begin if not rush.remove_alumni_listing((select id from ids where name='morgan')) then raise exception 'board removal failed';end if;end$$;
select pg_temp.expect_error($q$select rush.remove_alumni_listing((select id from ids where name='morgan'))$q$,'P0002');
do $$begin if jsonb_array_length(rush.alumni_directory()->'entries')<>0 then raise exception 'directory not empty';end if;end$$;
-- A save that was opened before the removal does not silently re-list Morgan.
select pg_temp.as_actor(1);
select pg_temp.expect_error($q$select rush.save_alumni_listing(2,pg_temp.form())$q$,'55000');
do $$begin if rush.alumni_directory()->'mine'<>'null'::jsonb then raise exception 'stale save re-listed';end if;end$$;

reset role;
-- The rows are gone, not hidden.
do $$begin if exists(select 1 from rush.alumni_listings) then raise exception 'removed rows remain';end if;end$$;
-- Audit: one row per real change, and no shared value in the metadata.
do $$declare a text; begin
 select string_agg(action,',' order by action) into a from rush.audit_events;
 if a<>'ALUMNI_LISTING_ADDED,ALUMNI_LISTING_ADDED,ALUMNI_LISTING_REMOVED,ALUMNI_LISTING_REMOVED,ALUMNI_LISTING_REMOVED,ALUMNI_LISTING_UPDATED' then raise exception 'audit actions wrong: %',a;end if;
 -- Only these keys ever appear, so no listing value can ride along under another name.
 if exists(select 1 from rush.audit_events a, jsonb_object_keys(a.metadata) k where k not in ('shared','changed','revision','byOwner')) then raise exception 'unexpected audit metadata key';end if;
 if exists(select 1 from rush.audit_events where metadata::text ~* 'ford|detroit|linkedin\.com|example\.invalid|operations roles|winter|deloitte|GM"') then raise exception 'audit metadata leaked content';end if;
 if not exists(select 1 from rush.audit_events where action='ALUMNI_LISTING_UPDATED' and metadata->'changed'='["employer","jobTitle","linkedinUrl","contactEmail"]'::jsonb
  and metadata->'shared'='["gradTerm","major","location","linkedinUrl","note"]'::jsonb) then raise exception 'update audit wrong';end if;
 if not exists(select 1 from rush.audit_events where action='ALUMNI_LISTING_REMOVED' and actor_id='00000000-0000-4000-8000-000000000003' and (metadata->>'byOwner')::boolean is false) then raise exception 'board removal audit wrong';end if;
 if not exists(select 1 from rush.audit_events where action='ALUMNI_LISTING_REMOVED' and actor_id='00000000-0000-4000-8000-000000000007' and (metadata->>'byOwner')::boolean) then raise exception 'alum opt-out audit wrong';end if;
end$$;
-- Table checks hold for direct writes too.
select pg_temp.expect_error($q$insert into rush.alumni_listings(profile_id,note) values('00000000-0000-4000-8000-000000000001',' padded')$q$,'23514');
select pg_temp.expect_error($q$insert into rush.alumni_listings(profile_id,linkedin_url) values('00000000-0000-4000-8000-000000000001','https://example.com/x')$q$,'23514');
select pg_temp.expect_error($q$insert into rush.alumni_listings(profile_id,contact_email) values('00000000-0000-4000-8000-000000000001','a@b.co&subject=x')$q$,'23514');
-- Deleting a profile removes its listing.
insert into rush.alumni_listings(profile_id) values('00000000-0000-4000-8000-000000000008');
delete from rush.profiles where id='00000000-0000-4000-8000-000000000008';
do $$begin if exists(select 1 from rush.alumni_listings) then raise exception 'cascade failed';end if;end$$;
select 'alumni directory assertions passed' as result;
