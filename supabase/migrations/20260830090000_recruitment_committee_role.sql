-- Append-only authorization for the bounded recruitment committee role.
-- The enum value itself is added in 20260830080000_recruitment_committee_role_enum_value.sql
-- (must be a separate transaction from anything that uses the new value).

create or replace function rush.has_cycle_capability(target_cycle_id text, capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id join rush.rush_cycles c on c.id=m.cycle_id
    where m.user_id=auth.uid() and m.cycle_id=target_cycle_id and m.active and p.active
      and (m.role in ('BOARD','OWNER') or (m.role::text='RECRUITMENT_COMMITTEE' and c.status not in ('CLOSED','ARCHIVED') and capability in
        ('APPLICANT_OPERATIONS','SCREENING_ADMINISTRATION','EVENTS','CASE_GROUPS','CANDIDATE_ACCESS','AUDIT_READ'))));
$$;
revoke all on function rush.has_cycle_capability(text,text) from public, anon;
grant execute on function rush.has_cycle_capability(text,text) to authenticated, service_role;

create or replace function rush.set_application_status(target_application_id text, next_status rush.application_status)
returns void language plpgsql security definer set search_path = '' as $$
declare app_row rush.applications%rowtype;
begin
  select * into app_row from rush.applications where id=target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode='P0002'; end if;
  if not rush.has_cycle_capability(app_row.cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=app_row.id and declarer_id=auth.uid()) then raise exception 'conflict recusal' using errcode='42501'; end if;
  if next_status in ('OFFERED','WAITLISTED','REJECTED','WITHDRAWN') and rush.has_cycle_role(app_row.cycle_id,array['RECRUITMENT_COMMITTEE']::rush.member_role[]) and not rush.has_cycle_role(app_row.cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'committee cannot set outcome status' using errcode='55000'; end if;
  if next_status<>app_row.status and not ((app_row.status='DRAFT' and next_status='SUBMITTED') or (app_row.status='SUBMITTED' and next_status in ('NEEDS_INFO','ELIGIBLE')) or (app_row.status='NEEDS_INFO' and next_status in ('SUBMITTED','ELIGIBLE')) or (app_row.status='ELIGIBLE' and next_status='INVITED') or (app_row.status='INVITED' and next_status='IN_PROCESS') or (app_row.status='IN_PROCESS' and next_status='FINAL_REVIEW')) then raise exception 'invalid application transition' using errcode='55000'; end if;
  update rush.applications set status=next_status where id=target_application_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
end; $$;

create or replace function rush.create_event_slot(target_event_id text, slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer default 8)
returns text language plpgsql security definer set search_path = '' as $$
declare target_cycle text; result_id text;
begin
  select cycle_id into target_cycle from rush.events where id=target_event_id;
  if target_cycle is null or not rush.has_cycle_capability(target_cycle,'EVENTS') then raise exception 'forbidden' using errcode='42501'; end if;
  if slot_starts_at is null or slot_ends_at is null or slot_ends_at<=slot_starts_at or slot_capacity not between 1 and 80 then raise exception 'invalid event slot' using errcode='22023'; end if;
  if not exists(select 1 from rush.events where id=target_event_id and starts_at<=slot_starts_at and (ends_at is null or slot_ends_at<=ends_at)) then raise exception 'slot outside event bounds' using errcode='22023'; end if;
  insert into rush.event_slots(event_id,starts_at,ends_at,capacity) values(target_event_id,slot_starts_at,slot_ends_at,slot_capacity) returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle,'EVENT_SLOT_CREATED','EventSlot',result_id);
  return result_id;
end; $$;

create or replace function rush.rotate_event_token(target_event_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text:=gen_random_uuid()::text||gen_random_uuid()::text; target_cycle text;
begin
  select cycle_id into target_cycle from rush.events where id=target_event_id for update;
  if target_cycle is null or not rush.has_cycle_capability(target_cycle,'EVENTS') then raise exception 'forbidden' using errcode='42501'; end if;
  update rush.events set checkin_token_digest=encode(extensions.digest(raw_token,'sha256'),'hex') where id=target_event_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle,'CHECKIN_TOKEN_ROTATED','Event',target_event_id);
  return raw_token;
end; $$;

create or replace function rush.create_case_group(target_cycle_id text, group_name text, group_prompt text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare result_id text;
begin
  if not rush.has_cycle_capability(target_cycle_id,'CASE_GROUPS') then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.case_groups(cycle_id,name,prompt) values(target_cycle_id,trim(group_name),coalesce(group_prompt,'')) returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'CASE_GROUP_CREATED','CaseGroup',result_id);
  return result_id;
end; $$;

create or replace function rush.assign_case_group(target_group_id text, target_application_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cycle text;
begin
  select cycle_id into v_cycle from rush.case_groups where id=target_group_id;
  if v_cycle is null or not rush.has_cycle_capability(v_cycle,'CASE_GROUPS') then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=v_cycle) then raise exception 'application cycle mismatch' using errcode='22023'; end if;
  delete from rush.case_group_members where application_id=target_application_id and group_id in(select id from rush.case_groups where cycle_id=v_cycle);
  insert into rush.case_group_members(group_id,application_id) values(target_group_id,target_application_id);
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),v_cycle,'CASE_GROUP_ASSIGNED','CaseGroup',target_group_id,jsonb_build_object('applicationId',target_application_id));
end; $$;

-- Existing BOARD/PANEL/OWNER guards remain authoritative for denied operations.
create or replace function rush.is_active_screening_reviewer(target_cycle_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id=sr.batch_id where b.cycle_id=target_cycle_id and b.status='PUBLISHED' and sr.reviewer_id=auth.uid() and sr.active);
$$;

-- rush.applications, rush.pnms, rush.evaluation_assignments, rush.rounds, and rush.conflict_declarations
-- all carry FORCE ROW LEVEL SECURITY, and several of their policies queried each other with raw
-- subqueries instead of a security definer function. Under the `authenticated` role (no BYPASSRLS),
-- that reproduces "infinite recursion detected in policy for relation ..." for any query that chains
-- through more than one of them (confirmed against a real Postgres instance: a plain board-member
-- `select * from rush.applications` recurses through applications -> evaluation_assignments ->
-- rounds -> applications). `postgres` has BYPASSRLS (unlike `authenticated`), so a security definer
-- function owned by `postgres` genuinely bypasses RLS despite FORCE, matching the existing
-- rush.has_cycle_role/rush.has_cycle_capability pattern. These three close the remaining raw
-- cross-table references so nothing in this schema can re-enter that cycle.
create or replace function rush.actor_has_application_conflict(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.conflict_declarations c
    where c.application_id = target_application_id and c.declarer_id = auth.uid()
  );
$$;
revoke all on function rush.actor_has_application_conflict(text) from public,anon;
grant execute on function rush.actor_has_application_conflict(text) to authenticated;

create or replace function rush.actor_is_assigned_evaluator(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.evaluation_assignments ea
    where ea.application_id = target_application_id and ea.evaluator_id = auth.uid()
  );
$$;
revoke all on function rush.actor_is_assigned_evaluator(text) from public,anon;
grant execute on function rush.actor_is_assigned_evaluator(text) to authenticated;

create or replace function rush.round_cycle_id(target_round_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cycle_id from rush.rounds where id = target_round_id;
$$;
revoke all on function rush.round_cycle_id(text) from public,anon;
grant execute on function rush.round_cycle_id(text) to authenticated;

create or replace function rush.actor_has_application_in_cycle(target_cycle_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where a.cycle_id = target_cycle_id and p.auth_user_id = auth.uid()
  );
$$;
revoke all on function rush.actor_has_application_in_cycle(text) from public,anon;
grant execute on function rush.actor_has_application_in_cycle(text) to authenticated;

drop policy if exists applications_read_internal on rush.applications;
create policy applications_read_internal on rush.applications for select to authenticated using (rush.has_cycle_role(cycle_id,array['BOARD','PANEL','OWNER']::rush.member_role[]) or (rush.has_cycle_capability(cycle_id,'CANDIDATE_ACCESS') and not rush.is_active_screening_reviewer(cycle_id)) or (rush.actor_is_assigned_evaluator(applications.id) and not rush.is_active_screening_reviewer(cycle_id) and not exists(select 1 from rush.conflict_declarations c where c.application_id=applications.id and c.declarer_id=auth.uid())));
drop policy if exists pnms_read_internal on rush.pnms;
create policy pnms_read_internal on rush.pnms for select to authenticated using (exists(select 1 from rush.applications a where a.pnm_id=pnms.id and (rush.has_cycle_role(a.cycle_id,array['BOARD','PANEL','OWNER']::rush.member_role[]) or rush.has_cycle_capability(a.cycle_id,'CANDIDATE_ACCESS')) and not rush.is_active_screening_reviewer(a.cycle_id)));
drop policy if exists assignments_read_evaluator_or_manager on rush.evaluation_assignments;
create policy assignments_read_evaluator_or_manager on rush.evaluation_assignments for select to authenticated using (evaluator_id=auth.uid() or rush.has_cycle_role(rush.round_cycle_id(round_id),array['BOARD','PANEL','OWNER']::rush.member_role[]) or rush.has_cycle_capability(rush.round_cycle_id(round_id),'APPLICANT_OPERATIONS'));
drop policy if exists audit_events_read_internal on rush.audit_events;
create policy audit_events_read_internal on rush.audit_events for select to authenticated using (rush.has_cycle_role(cycle_id,array['BOARD','OWNER']::rush.member_role[]) or (rush.has_cycle_capability(cycle_id,'AUDIT_READ') and resource in ('Application','EvaluationAssignment','Event','EventSlot','Checkin','CaseGroup','ScreeningBatch','ScreeningPacket','ScreeningAssignment')));
drop policy if exists ratings_read_with_evaluation on rush.criterion_ratings;
create policy ratings_read_with_evaluation on rush.criterion_ratings for select to authenticated using (exists(select 1 from rush.evaluations e join rush.evaluation_assignments ea on ea.id=e.assignment_id join rush.rounds r on r.id=ea.round_id where e.id=criterion_ratings.evaluation_id and e.status='LOCKED' and not rush.actor_has_application_conflict(ea.application_id) and (ea.evaluator_id=auth.uid() or rush.has_cycle_role(r.cycle_id,array['PANEL','OWNER']::rush.member_role[]))));

grant execute on function rush.set_application_status(text,rush.application_status),rush.create_event_slot(text,timestamptz,timestamptz,integer),rush.rotate_event_token(text),rush.create_case_group(text,text,text),rush.assign_case_group(text,text) to authenticated,service_role;
grant select on rush.audit_events to authenticated;

create or replace function rush.screening_assignment_inputs(target_batch_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target_cycle text;
begin
  select cycle_id into target_cycle from rush.screening_batches where id=target_batch_id and status='DRAFT';
  if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object('packets',(select coalesce(jsonb_agg(jsonb_build_object('packetId',p.id,'eligibleReviewerIds',(select coalesce(jsonb_agg(sr.reviewer_id),'[]'::jsonb) from rush.screening_reviewers sr where sr.batch_id=target_batch_id and sr.active and not exists(select 1 from rush.conflict_declarations c where c.application_id=p.application_id and c.declarer_id=sr.reviewer_id)))),'[]'::jsonb) from rush.screening_packets p where p.batch_id=target_batch_id and p.redaction_status='APPROVED'),'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('reviewerId',reviewer_id,'capacity',capacity)),'[]'::jsonb) from rush.screening_reviewers where batch_id=target_batch_id and active));
end $$;

create or replace function rush.screening_admin_overview(target_cycle_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when not rush.has_cycle_capability(target_cycle_id,'SCREENING_ADMINISTRATION') then null else coalesce((select jsonb_build_object('batchId',b.id,'status',b.status,'reviewsPerApplication',b.reviews_per_application,'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('id',sr.reviewer_id,'name',p.display_name,'capacity',sr.capacity) order by p.display_name),'[]'::jsonb) from rush.screening_reviewers sr join rush.profiles p on p.id=sr.reviewer_id where sr.batch_id=b.id and sr.active),'packets',(select coalesce(jsonb_agg((jsonb_build_object('id',sp.id,'code',sp.candidate_code,'status',sp.redaction_status,'applicantName',pn.name,'content',sp.content) - case when b.status='FROZEN' and not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then array['applicantName','content'] else array[]::text[] end) order by sp.candidate_code),'[]'::jsonb) from rush.screening_packets sp join rush.applications a on a.id=sp.application_id join rush.pnms pn on pn.id=a.pnm_id where sp.batch_id=b.id),'assigned',(select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id=sa.packet_id where sp.batch_id=b.id and sa.status<>'RECUSED'),'submitted',(select count(*) from rush.screening_assignments sa join rush.screening_packets sp on sp.id=sa.packet_id where sp.batch_id=b.id and sa.status in ('SUBMITTED','LOCKED')),'results',case when b.status='FROZEN' then (select coalesce(jsonb_agg((jsonb_build_object('code',sp.candidate_code,'recommendation',sr.recommendation,'score',sr.score,'applicantName',pn.name,'evidence',sr.evidence) - case when rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then array[]::text[] else array['applicantName','evidence'] end) order by sp.candidate_code,sr.submitted_at),'[]'::jsonb) from rush.screening_reviews sr join rush.screening_assignments sa on sa.id=sr.assignment_id join rush.screening_packets sp on sp.id=sa.packet_id join rush.applications a on a.id=sp.application_id join rush.pnms pn on pn.id=a.pnm_id where sp.batch_id=b.id) else '[]'::jsonb end) from rush.screening_batches b where b.cycle_id=target_cycle_id),'null'::jsonb) end;
$$;

drop policy if exists cycles_read_participant on rush.rush_cycles;
create policy cycles_read_participant on rush.rush_cycles for select to authenticated using (rush.has_cycle_capability(id,'CANDIDATE_ACCESS') or rush.actor_has_application_in_cycle(id));
drop policy if exists rounds_read_cycle_participant on rush.rounds;
create policy rounds_read_cycle_participant on rush.rounds for select to authenticated using (rush.has_cycle_capability(cycle_id,'CANDIDATE_ACCESS') or rush.actor_has_application_in_cycle(cycle_id));
drop policy if exists rubrics_read_cycle_participant on rush.rubrics;
create policy rubrics_read_cycle_participant on rush.rubrics for select to authenticated using (exists(select 1 from rush.rounds r where r.id=rubrics.round_id and (rush.has_cycle_capability(r.cycle_id,'CANDIDATE_ACCESS') or rush.actor_has_application_in_cycle(r.cycle_id))));
drop policy if exists rubric_criteria_read_cycle_participant on rush.rubric_criteria;
create policy rubric_criteria_read_cycle_participant on rush.rubric_criteria for select to authenticated using (exists(select 1 from rush.rubrics ru join rush.rounds r on r.id=ru.round_id where ru.id=rubric_criteria.rubric_id and (rush.has_cycle_capability(r.cycle_id,'CANDIDATE_ACCESS') or rush.actor_has_application_in_cycle(r.cycle_id))));
drop policy if exists events_read_participant on rush.events;
create policy events_read_participant on rush.events for select to authenticated using (rush.has_cycle_capability(cycle_id,'EVENTS') or rush.actor_has_application_in_cycle(cycle_id));
drop policy if exists memberships_read_own_or_manager on rush.memberships;
create policy memberships_read_own_or_manager on rush.memberships for select to authenticated using (user_id=auth.uid() or rush.has_cycle_role(cycle_id,array['BOARD','OWNER']::rush.member_role[]) or rush.has_cycle_capability(cycle_id,'APPLICANT_OPERATIONS'));

create or replace function rush.add_applicant(target_cycle_id text, applicant_name text, applicant_contact text) returns text language plpgsql security definer set search_path='' as $$ declare normalized text:=lower(trim(applicant_contact)); person_id text; application_id text; begin if not rush.has_cycle_capability(target_cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status in ('DRAFT','OPEN','IN_PROCESS')) then raise exception 'cycle closed' using errcode='55000'; end if; if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then raise exception 'invalid applicant' using errcode='22023'; end if; select id into person_id from rush.pnms where normalized_contact=normalized; if person_id is null then insert into rush.pnms(name,contact,normalized_contact) values(trim(applicant_name),trim(applicant_contact),normalized) returning id into person_id; else update rush.pnms set name=trim(applicant_name) where id=person_id; end if; insert into rush.applications(pnm_id,cycle_id,status,submitted_at) values(person_id,target_cycle_id,'IN_PROCESS',now()) on conflict(pnm_id,cycle_id) do update set updated_at=rush.applications.updated_at returning id into application_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'APPLICATION_ADDED','Application',application_id); return application_id; end $$;

create or replace function rush.assign_evaluator(target_cycle_id text,target_round_id text,target_application_id text,target_evaluator_id uuid) returns text language plpgsql security definer set search_path='' as $$ declare result_id text; existing_status rush.assignment_status; begin if not rush.has_cycle_capability(target_cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status='IN_PROCESS') then raise exception 'cycle not in process' using errcode='55000'; end if; if not exists(select 1 from rush.rounds where id=target_round_id and cycle_id=target_cycle_id and status in ('DRAFT','PUBLISHED')) then raise exception 'round unavailable' using errcode='55000'; end if; if not exists(select 1 from rush.applications where id=target_application_id and cycle_id=target_cycle_id) then raise exception 'application missing' using errcode='P0002'; end if; if not exists(select 1 from rush.memberships where user_id=target_evaluator_id and cycle_id=target_cycle_id and active) then raise exception 'evaluator inactive' using errcode='42501'; end if; if exists(select 1 from rush.conflict_declarations where application_id=target_application_id and declarer_id=target_evaluator_id) then raise exception 'evaluator conflict' using errcode='42501'; end if; select status into existing_status from rush.evaluation_assignments where round_id=target_round_id and application_id=target_application_id and evaluator_id=target_evaluator_id for update; if existing_status is not null and existing_status<>'ASSIGNED' then raise exception 'assignment locked' using errcode='55000'; end if; insert into rush.evaluation_assignments(round_id,application_id,evaluator_id) values(target_round_id,target_application_id,target_evaluator_id) on conflict(round_id,application_id,evaluator_id) do update set updated_at=now() returning id into result_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVALUATOR_ASSIGNED','EvaluationAssignment',result_id); return result_id; end $$;

create or replace function rush.create_event(target_cycle_id text,event_name text,event_starts_at timestamptz,opens_at timestamptz,closes_at timestamptz,event_kind text default 'GENERAL',event_location text default null,event_visibility text default 'INTERNAL',event_ends_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$ declare raw_token text:=gen_random_uuid()::text||gen_random_uuid()::text; event_id text; begin if not rush.has_cycle_capability(target_cycle_id,'EVENTS') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status not in ('CLOSED','ARCHIVED')) then raise exception 'cycle closed' using errcode='55000'; end if; if char_length(trim(event_name)) not between 1 and 160 or closes_at<=opens_at then raise exception 'invalid event' using errcode='22023'; end if; if event_visibility not in ('PUBLIC','INVITE','INTERNAL') then raise exception 'invalid visibility' using errcode='22023'; end if; insert into rush.events(cycle_id,name,kind,status,starts_at,ends_at,location,visibility,checkin_opens_at,checkin_closes_at,checkin_token_digest) values(target_cycle_id,trim(event_name),coalesce(nullif(trim(event_kind),''),'GENERAL'),'PUBLISHED',event_starts_at,event_ends_at,nullif(trim(event_location),''),event_visibility,opens_at,closes_at,encode(extensions.digest(raw_token,'sha256'),'hex')) returning id into event_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVENT_CREATED','Event',event_id); return jsonb_build_object('id',event_id,'checkinToken',raw_token); end $$;

create or replace function rush.create_screening_batch(target_cycle_id text, reviewer_ids uuid[]) returns text language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); v_round_id text; v_rubric_id text; v_batch_id text; reviewer uuid; begin if actor is null or not rush.has_cycle_capability(target_cycle_id,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status in ('OPEN','IN_PROCESS')) then raise exception 'cycle unavailable' using errcode='55000'; end if; if coalesce(array_length(reviewer_ids,1),0)<3 then raise exception 'at least three reviewers are required' using errcode='22023'; end if; insert into rush.rounds(cycle_id,kind,name,status,weight) values(target_cycle_id,'APPLICATION_SCREEN','Blind application screening','PUBLISHED',0) on conflict(cycle_id,kind) do update set name=excluded.name returning id into v_round_id; select id into v_rubric_id from rush.rubrics where round_id=v_round_id order by version desc limit 1; if v_rubric_id is null then insert into rush.rubrics(round_id,version) values(v_round_id,1) returning id into v_rubric_id; insert into rush.rubric_criteria(rubric_id,key,name,description,weight,required,position) values (v_rubric_id,'motivation','MECG motivation','Explains why MECG specifically and connects that interest to concrete work.',20,true,0),(v_rubric_id,'problem_structuring','Problem structuring','Separates a messy problem into workable parts and states relevant constraints.',25,true,1),(v_rubric_id,'ownership','Evidence and ownership','Describes personal actions and the resulting change without relying on prestige signals.',20,true,2),(v_rubric_id,'reflection','Reflection and judgment','Acknowledges uncertainty, tradeoffs, mistakes, or lessons.',20,true,3),(v_rubric_id,'communication','Clear communication','Communicates directly and understandably without rewarding ornamental writing.',15,true,4); end if; insert into rush.screening_batches(cycle_id,rubric_id,created_by) values(target_cycle_id,v_rubric_id,actor) returning id into v_batch_id; foreach reviewer in array reviewer_ids loop if not exists(select 1 from rush.memberships m where m.user_id=reviewer and m.cycle_id=target_cycle_id and m.role='MEMBER' and m.active) or exists(select 1 from rush.memberships m where m.user_id=reviewer and m.cycle_id=target_cycle_id and m.role in ('BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE') and m.active) then raise exception 'reviewers must be non-privileged active members' using errcode='42501'; end if; insert into rush.screening_reviewers(batch_id,reviewer_id) values(v_batch_id,reviewer); end loop; insert into rush.screening_packets(batch_id,application_id,candidate_code,content,content_hash) select v_batch_id,a.id,'Applicant '||upper(substr(encode(extensions.digest(a.id||v_batch_id,'sha256'),'hex'),1,6)),jsonb_build_object('responses',coalesce((select jsonb_agg(jsonb_build_object('question',r.question_text,'answer',r.response_text) order by r.created_at) from rush.application_responses r where r.application_id=a.id),'[]'::jsonb)),encode(extensions.digest(coalesce((select string_agg(r.question_text||E'\n'||r.response_text,E'\n' order by r.created_at) from rush.application_responses r where r.application_id=a.id),''),'sha256'),'hex') from rush.applications a where a.cycle_id=target_cycle_id and a.status not in ('DRAFT','WITHDRAWN'); if not found then raise exception 'no submitted applications are available' using errcode='55000'; end if; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle_id,'SCREENING_BATCH_CREATED','ScreeningBatch',v_batch_id); return v_batch_id; end $$;

create or replace function rush.approve_screening_packet(target_packet_id text, approved boolean) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); target_cycle text; begin select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT'; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; update rush.screening_packets set redaction_status=case when approved then 'APPROVED' else 'REJECTED' end,approved_by=actor,approved_at=now() where id=target_packet_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,case when approved then 'SCREENING_PACKET_APPROVED' else 'SCREENING_PACKET_REJECTED' end,'ScreeningPacket',target_packet_id); end $$;

create or replace function rush.update_screening_packet_content(target_packet_id text, revised_content jsonb) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); target_cycle text; begin select b.cycle_id into target_cycle from rush.screening_packets p join rush.screening_batches b on b.id=p.batch_id where p.id=target_packet_id and b.status='DRAFT'; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if jsonb_typeof(revised_content)<>'object' or jsonb_typeof(revised_content->'responses')<>'array' or octet_length(revised_content::text)>50000 then raise exception 'invalid packet content' using errcode='22023'; end if; if exists(select 1 from jsonb_array_elements(revised_content->'responses') x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'question')<>'string' or jsonb_typeof(x->'answer')<>'string' or char_length(trim(x->>'question'))=0 or char_length(trim(x->>'answer'))=0 or char_length(x->>'question')>2000 or char_length(x->>'answer')>8000) then raise exception 'invalid response content' using errcode='22023'; end if; update rush.screening_packets set content=revised_content,content_hash=encode(extensions.digest(revised_content::text,'sha256'),'hex'),redaction_status='PENDING',approved_by=null,approved_at=null where id=target_packet_id; insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_PACKET_REDACTED','ScreeningPacket',target_packet_id); end $$;
create or replace function rush.commit_screening_assignments(target_batch_id text, proposal jsonb, commitment text, summary jsonb) returns integer language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); target_cycle text; required_count integer; inserted_count integer; begin select cycle_id,reviews_per_application into target_cycle,required_count from rush.screening_batches where id=target_batch_id and status='DRAFT' for update; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if jsonb_typeof(proposal)<>'array' or char_length(commitment)<>64 then raise exception 'invalid proposal' using errcode='22023'; end if; if exists(select 1 from jsonb_array_elements(proposal) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'packetId')<>'string' or jsonb_typeof(x->'reviewerId')<>'string' or (x->>'packetId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' or (x->>'reviewerId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') then raise exception 'invalid assignment identifiers' using errcode='22023'; end if; if exists(select 1 from jsonb_array_elements(proposal) x group by x->>'packetId',x->>'reviewerId' having count(*)>1) then raise exception 'duplicate assignment proposal' using errcode='22023'; end if; if exists(select 1 from rush.screening_packets where batch_id=target_batch_id and redaction_status<>'APPROVED') then raise exception 'every packet requires approval' using errcode='55000'; end if; if exists(select 1 from jsonb_array_elements(proposal) x where not exists(select 1 from rush.screening_packets p where p.id=x->>'packetId' and p.batch_id=target_batch_id and p.redaction_status='APPROVED') or not exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and r.reviewer_id=(x->>'reviewerId')::uuid and r.active) or exists(select 1 from rush.screening_packets p join rush.conflict_declarations c on c.application_id=p.application_id where p.id=x->>'packetId' and c.declarer_id=(x->>'reviewerId')::uuid)) then raise exception 'proposal contains an ineligible assignment' using errcode='42501'; end if; if exists(select 1 from rush.screening_packets p where p.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'packetId'=p.id)<>required_count) then raise exception 'every packet needs distinct reviewers' using errcode='22023'; end if; if exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'reviewerId'=r.reviewer_id::text)>r.capacity) then raise exception 'reviewer capacity exceeded' using errcode='22023'; end if; insert into rush.screening_assignments(packet_id,reviewer_id) select x->>'packetId',(x->>'reviewerId')::uuid from jsonb_array_elements(proposal) x; get diagnostics inserted_count=row_count; update rush.screening_batches set status='PUBLISHED',seed_commitment=commitment,published_at=now() where id=target_batch_id; update rush.rounds set status='ACTIVE' where id=(select r.round_id from rush.rubrics r join rush.screening_batches b on b.rubric_id=r.id where b.id=target_batch_id); update rush.rubrics set frozen_at=now() where id=(select rubric_id from rush.screening_batches where id=target_batch_id); insert into rush.screening_distribution_runs(batch_id,seed_commitment,assignment_count,summary,created_by) values(target_batch_id,commitment,inserted_count,summary,actor); insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_DISTRIBUTED','ScreeningBatch',target_batch_id,jsonb_build_object('assignments',inserted_count)); return inserted_count; end $$;
create or replace function rush.freeze_screening_batch(target_batch_id text) returns void language plpgsql security definer set search_path='' as $$ declare actor uuid:=auth.uid(); target_cycle text; required_count integer; begin select cycle_id,reviews_per_application into target_cycle,required_count from rush.screening_batches where id=target_batch_id and status='PUBLISHED' for update; if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if; if exists(select 1 from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id where p.batch_id=target_batch_id and a.status not in ('SUBMITTED','RECUSED')) or exists(select 1 from rush.screening_packets p where p.batch_id=target_batch_id and (select count(*) from rush.screening_assignments a where a.packet_id=p.id and a.status='SUBMITTED')<>required_count) then raise exception 'three submitted reviews are required for every packet' using errcode='55000'; end if; update rush.screening_assignments set status='LOCKED',updated_at=now() where packet_id in(select id from rush.screening_packets where batch_id=target_batch_id) and status='SUBMITTED'; update rush.screening_batches set status='FROZEN',frozen_at=now() where id=target_batch_id; update rush.rounds set status='FROZEN' where id=(select r.round_id from rush.rubrics r join rush.screening_batches b on b.rubric_id=r.id where b.id=target_batch_id); insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_FROZEN','ScreeningBatch',target_batch_id); end $$;
revoke all on function rush.create_screening_batch(text,uuid[]),rush.screening_admin_overview(text),rush.approve_screening_packet(text,boolean),rush.update_screening_packet_content(text,jsonb),rush.screening_assignment_inputs(text),rush.commit_screening_assignments(text,jsonb,text,jsonb),rush.freeze_screening_batch(text) from public,anon;
grant execute on function rush.create_screening_batch(text,uuid[]),rush.screening_admin_overview(text),rush.approve_screening_packet(text,boolean),rush.update_screening_packet_content(text,jsonb),rush.screening_assignment_inputs(text),rush.commit_screening_assignments(text,jsonb,text,jsonb),rush.freeze_screening_batch(text) to authenticated,service_role;

-- Reviewer access is contingent on the reviewer's current, non-privileged cycle role.
create or replace function rush.is_eligible_screening_reviewer(target_cycle_id text, target_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select target_user_id is not null
    and exists(select 1 from rush.profiles p where p.id=target_user_id and p.active)
    and exists(select 1 from rush.memberships m where m.user_id=target_user_id and m.cycle_id=target_cycle_id and m.role='MEMBER' and m.active)
    and not exists(select 1 from rush.memberships m where m.user_id=target_user_id and m.cycle_id=target_cycle_id and m.role in ('BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE') and m.active);
$$;
revoke all on function rush.is_eligible_screening_reviewer(text,uuid) from public,anon,authenticated;
grant execute on function rush.is_eligible_screening_reviewer(text,uuid) to service_role;

create or replace function rush.is_active_screening_reviewer(target_cycle_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select rush.is_eligible_screening_reviewer(target_cycle_id,auth.uid()) and exists(
    select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id=sr.batch_id
    where b.cycle_id=target_cycle_id and b.status='PUBLISHED' and sr.reviewer_id=auth.uid() and sr.active
  );
$$;

create or replace function rush.my_screening_queue(target_cycle_id text)
returns table(assignment_id text,candidate_code text,assignment_status text) language sql stable security definer set search_path='' as $$
  select a.id,p.candidate_code,a.status from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  join rush.screening_reviewers sr on sr.batch_id=b.id and sr.reviewer_id=a.reviewer_id and sr.active
  where b.cycle_id=target_cycle_id and b.status='PUBLISHED' and a.reviewer_id=auth.uid()
    and rush.is_eligible_screening_reviewer(b.cycle_id,auth.uid())
  order by p.candidate_code;
$$;

create or replace function rush.screening_assignment_detail(target_assignment_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  select jsonb_build_object('assignmentId',a.id,'candidateCode',p.candidate_code,'status',a.status,'content',p.content,'criteria',(
    select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'weight',c.weight,'required',c.required) order by c.position) from rush.rubric_criteria c where c.rubric_id=b.rubric_id
  )) into result from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  join rush.screening_reviewers sr on sr.batch_id=b.id and sr.reviewer_id=a.reviewer_id and sr.active
  where a.id=target_assignment_id and a.reviewer_id=auth.uid() and b.status='PUBLISHED' and a.status='ASSIGNED'
    and rush.is_eligible_screening_reviewer(b.cycle_id,auth.uid());
  if result is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function rush.submit_screening_review(target_assignment_id text, ratings jsonb, review_evidence text, review_recommendation text)
returns numeric language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v_rubric_id text; v_review_id text; expected integer; weighted numeric; target_cycle text;
begin
  select b.rubric_id,b.cycle_id into v_rubric_id,target_cycle from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  join rush.screening_reviewers sr on sr.batch_id=b.id and sr.reviewer_id=a.reviewer_id and sr.active
  where a.id=target_assignment_id and a.reviewer_id=actor and a.status='ASSIGNED' and b.status='PUBLISHED'
    and rush.is_eligible_screening_reviewer(b.cycle_id,actor) for update of a;
  if v_rubric_id is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  if review_recommendation not in ('ADVANCE','HOLD','DECLINE') or char_length(trim(review_evidence)) not between 20 and 6000 or jsonb_typeof(ratings)<>'array' then raise exception 'invalid review' using errcode='22023'; end if;
  select count(*) into expected from rush.rubric_criteria where rubric_id=v_rubric_id;
  if (select count(*) from jsonb_array_elements(ratings))<>expected or (select count(distinct x->>'criterionId') from jsonb_array_elements(ratings)x)<>expected
    or exists(select 1 from jsonb_array_elements(ratings)x where (x->>'score')!~'^[1-5]$' or not exists(select 1 from rush.rubric_criteria c where c.id=x->>'criterionId' and c.rubric_id=v_rubric_id))
  then raise exception 'every criterion needs one score' using errcode='22023'; end if;
  select 100*sum(c.weight*(((x->>'score')::numeric-1)/4))/sum(c.weight) into weighted from jsonb_array_elements(ratings)x join rush.rubric_criteria c on c.id=x->>'criterionId';
  insert into rush.screening_reviews(assignment_id,reviewer_id,recommendation,evidence,score) values(target_assignment_id,actor,review_recommendation,trim(review_evidence),weighted) returning id into v_review_id;
  insert into rush.screening_ratings(review_id,criterion_id,score,note) select v_review_id,x->>'criterionId',(x->>'score')::integer,left(nullif(trim(x->>'note'),''),2000) from jsonb_array_elements(ratings)x;
  update rush.screening_assignments set status='SUBMITTED',updated_at=now() where id=target_assignment_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(actor,target_cycle,'SCREENING_REVIEW_SUBMITTED','ScreeningReview',v_review_id);
  return weighted;
end $$;

create or replace function rush.recuse_screening_assignment(target_assignment_id text, recusal_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); packet text; application text; batch text; target_cycle text; replacement uuid;
begin
  if char_length(trim(recusal_reason)) not between 5 and 1000 then raise exception 'reason required' using errcode='22023'; end if;
  select a.packet_id,p.application_id,p.batch_id,b.cycle_id into packet,application,batch,target_cycle from rush.screening_assignments a join rush.screening_packets p on p.id=a.packet_id join rush.screening_batches b on b.id=p.batch_id
  join rush.screening_reviewers sr on sr.batch_id=b.id and sr.reviewer_id=a.reviewer_id and sr.active
  where a.id=target_assignment_id and a.reviewer_id=actor and a.status='ASSIGNED' and b.status='PUBLISHED'
    and rush.is_eligible_screening_reviewer(b.cycle_id,actor) for update of a;
  if packet is null then raise exception 'assignment not found' using errcode='P0002'; end if;
  insert into rush.conflict_declarations(application_id,declarer_id,reason) values(application,actor,trim(recusal_reason)) on conflict(application_id,declarer_id) do update set reason=excluded.reason;
  update rush.screening_assignments set status='RECUSED',updated_at=now() where id=target_assignment_id;
  select sr.reviewer_id into replacement from rush.screening_reviewers sr where sr.batch_id=batch and sr.active
    and rush.is_eligible_screening_reviewer(target_cycle,sr.reviewer_id)
    and not exists(select 1 from rush.screening_assignments x where x.packet_id=packet and x.reviewer_id=sr.reviewer_id)
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=application and c.declarer_id=sr.reviewer_id)
    and (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED')<sr.capacity
  order by (select count(*) from rush.screening_assignments x join rush.screening_packets p2 on p2.id=x.packet_id where p2.batch_id=batch and x.reviewer_id=sr.reviewer_id and x.status<>'RECUSED'),random() limit 1;
  if replacement is not null then insert into rush.screening_assignments(packet_id,reviewer_id) values(packet,replacement); end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_RECUSED','ScreeningAssignment',target_assignment_id,jsonb_build_object('replacementCreated',replacement is not null));
end $$;

create or replace function rush.screening_assignment_inputs(target_batch_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target_cycle text;
begin
  select cycle_id into target_cycle from rush.screening_batches where id=target_batch_id and status='DRAFT';
  if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object('packets',(select coalesce(jsonb_agg(jsonb_build_object('packetId',p.id,'eligibleReviewerIds',(select coalesce(jsonb_agg(sr.reviewer_id),'[]'::jsonb) from rush.screening_reviewers sr where sr.batch_id=target_batch_id and sr.active and rush.is_eligible_screening_reviewer(target_cycle,sr.reviewer_id) and not exists(select 1 from rush.conflict_declarations c where c.application_id=p.application_id and c.declarer_id=sr.reviewer_id)))),'[]'::jsonb) from rush.screening_packets p where p.batch_id=target_batch_id and p.redaction_status='APPROVED'),'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('reviewerId',reviewer_id,'capacity',capacity)),'[]'::jsonb) from rush.screening_reviewers where batch_id=target_batch_id and active and rush.is_eligible_screening_reviewer(target_cycle,reviewer_id)));
end $$;

create or replace function rush.commit_screening_assignments(target_batch_id text, proposal jsonb, commitment text, summary jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_cycle text; required_count integer; inserted_count integer;
begin
  select cycle_id,reviews_per_application into target_cycle,required_count from rush.screening_batches where id=target_batch_id and status='DRAFT' for update;
  if target_cycle is null or not rush.has_cycle_capability(target_cycle,'SCREENING_ADMINISTRATION') then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(proposal)<>'array' or char_length(commitment)<>64 then raise exception 'invalid proposal' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(proposal) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'packetId')<>'string' or jsonb_typeof(x->'reviewerId')<>'string' or (x->>'packetId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' or (x->>'reviewerId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') then raise exception 'invalid assignment identifiers' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(proposal) x group by x->>'packetId',x->>'reviewerId' having count(*)>1) then raise exception 'duplicate assignment proposal' using errcode='22023'; end if;
  if exists(select 1 from rush.screening_packets where batch_id=target_batch_id and redaction_status<>'APPROVED') then raise exception 'every packet requires approval' using errcode='55000'; end if;
  if exists(select 1 from jsonb_array_elements(proposal) x where not exists(select 1 from rush.screening_packets p where p.id=x->>'packetId' and p.batch_id=target_batch_id and p.redaction_status='APPROVED') or not exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and r.reviewer_id=(x->>'reviewerId')::uuid and r.active) or not rush.is_eligible_screening_reviewer(target_cycle,(x->>'reviewerId')::uuid) or exists(select 1 from rush.screening_packets p join rush.conflict_declarations c on c.application_id=p.application_id where p.id=x->>'packetId' and c.declarer_id=(x->>'reviewerId')::uuid)) then raise exception 'proposal contains an ineligible assignment' using errcode='42501'; end if;
  if exists(select 1 from rush.screening_packets p where p.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'packetId'=p.id)<>required_count) then raise exception 'every packet needs distinct reviewers' using errcode='22023'; end if;
  if exists(select 1 from rush.screening_reviewers r where r.batch_id=target_batch_id and (select count(*) from jsonb_array_elements(proposal) x where x->>'reviewerId'=r.reviewer_id::text)>r.capacity) then raise exception 'reviewer capacity exceeded' using errcode='22023'; end if;
  insert into rush.screening_assignments(packet_id,reviewer_id) select x->>'packetId',(x->>'reviewerId')::uuid from jsonb_array_elements(proposal) x;
  get diagnostics inserted_count=row_count;
  update rush.screening_batches set status='PUBLISHED',seed_commitment=commitment,published_at=now() where id=target_batch_id;
  update rush.rounds set status='ACTIVE' where id=(select r.round_id from rush.rubrics r join rush.screening_batches b on b.rubric_id=r.id where b.id=target_batch_id);
  update rush.rubrics set frozen_at=now() where id=(select rubric_id from rush.screening_batches where id=target_batch_id);
  insert into rush.screening_distribution_runs(batch_id,seed_commitment,assignment_count,summary,created_by) values(target_batch_id,commitment,inserted_count,summary,actor);
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,target_cycle,'SCREENING_DISTRIBUTED','ScreeningBatch',target_batch_id,jsonb_build_object('assignments',inserted_count));
  return inserted_count;
end $$;

-- A screening reviewer can never gain identity-revealing privileges in the same cycle.
create or replace function rush.grant_membership(target_user_id uuid, target_cycle_id text, target_role rush.member_role)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if auth.uid()=target_user_id then raise exception 'self grant forbidden' using errcode='42501'; end if;
  if not rush.has_cycle_role(target_cycle_id,array['OWNER']::rush.member_role[]) then raise exception 'owner required' using errcode='42501'; end if;
  if not exists(select 1 from rush.profiles where id=target_user_id and active) then raise exception 'user missing' using errcode='P0002'; end if;
  if target_role in ('RECRUITMENT_COMMITTEE','BOARD','PANEL','OWNER') and exists(
    select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id=sr.batch_id
    where sr.reviewer_id=target_user_id and b.cycle_id=target_cycle_id
  ) then raise exception 'screening reviewer cannot receive a privileged role in the same cycle' using errcode='42501'; end if;
  insert into rush.memberships(user_id,cycle_id,role,active,revoked_at) values(target_user_id,target_cycle_id,target_role,true,null)
  on conflict(user_id,cycle_id,role) do update set active=true,revoked_at=null returning id into result_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
  values(auth.uid(),target_cycle_id,'MEMBERSHIP_GRANTED','Profile',target_user_id::text,jsonb_build_object('role',target_role));
  return result_id;
end $$;
revoke all on function rush.grant_membership(uuid,text,rush.member_role) from public,anon;
grant execute on function rush.grant_membership(uuid,text,rush.member_role) to authenticated,service_role;

-- Locking a decision must not expose its outcome through the application status.
create or replace function rush.approve_decision(target_decision_id text)
returns table(locked boolean, approvals bigint) language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  if d.status not in ('PENDING','APPROVED') then raise exception 'decision closed' using errcode='55000'; end if;
  if not exists(select 1 from rush.rush_cycles where id=d.cycle_id and status='DECISION_LOCK') then raise exception 'cycle closed' using errcode='55000'; end if;
  insert into rush.decision_approvals(decision_id,approver_id) values(d.id,auth.uid()) on conflict do nothing;
  select count(*) into approvals from rush.decision_approvals da join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  locked:=approvals>=2;
  update rush.decisions set status=case when locked then 'LOCKED'::rush.decision_status else 'APPROVED'::rush.decision_status end,locked_at=case when locked then now() else null end where id=d.id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(auth.uid(),d.cycle_id,case when locked then 'DECISION_LOCKED' else 'DECISION_APPROVED' end,'Decision',d.id,jsonb_build_object('validApprovals',approvals));
  return next;
end $$;

create or replace function rush.release_decision(target_decision_id text)
returns void language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype; valid_approvals bigint;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  select count(*) into valid_approvals from rush.decision_approvals da join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  if d.status<>'LOCKED' or valid_approvals<2 then raise exception 'decision not locked' using errcode='55000'; end if;
  perform 1 from rush.applications where id=d.application_id for update;
  update rush.applications set status=case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status when 'WAITLIST' then 'WAITLISTED'::rush.application_status when 'REJECT' then 'REJECTED'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end where id=d.application_id;
  update rush.decisions set status='RELEASED',released_at=now() where id=d.id and status='LOCKED';
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),d.cycle_id,'DECISION_RELEASED','Decision',d.id);
end $$;

-- Committee colleague visibility follows the same active-cycle capability boundary.
drop policy if exists profiles_read_cycle_colleagues on rush.profiles;
create policy profiles_read_cycle_colleagues on rush.profiles for select to authenticated using (exists(
  select 1 from rush.memberships mine join rush.memberships theirs on theirs.cycle_id=mine.cycle_id
  where mine.user_id=auth.uid() and mine.active and theirs.user_id=profiles.id and theirs.active
    and (mine.role in ('BOARD','OWNER') or (mine.role in ('MEMBER','PANEL')
      and not exists(select 1 from rush.memberships committee join rush.rush_cycles c on c.id=committee.cycle_id where committee.user_id=mine.user_id and committee.cycle_id=mine.cycle_id and committee.role='RECRUITMENT_COMMITTEE' and committee.active and c.status in ('CLOSED','ARCHIVED')))
      or (mine.role='RECRUITMENT_COMMITTEE' and rush.has_cycle_capability(mine.cycle_id,'CANDIDATE_ACCESS')))
));

create or replace function rush.export_attendance(target_cycle_id text)
returns table(applicant_code text,name text,status rush.application_status,events_attended bigint)
language plpgsql security definer set search_path='' as $$
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'ATTENDANCE_EXPORTED','RushCycle',target_cycle_id);
  return query select a.id,p.name,a.status,count(c.id) from rush.applications a join rush.pnms p on p.id=a.pnm_id
    left join rush.events e on e.cycle_id=target_cycle_id
    left join rush.checkins c on c.pnm_id=p.id and c.event_id=e.id
    where a.cycle_id=target_cycle_id group by a.id,p.name,a.status order by p.name;
end $$;

revoke all on function rush.my_screening_queue(text),rush.screening_assignment_detail(text),rush.submit_screening_review(text,jsonb,text,text),rush.recuse_screening_assignment(text,text),rush.approve_decision(text),rush.release_decision(text),rush.export_attendance(text) from public,anon;
grant execute on function rush.my_screening_queue(text),rush.screening_assignment_detail(text),rush.submit_screening_review(text,jsonb,text,text),rush.recuse_screening_assignment(text,text),rush.approve_decision(text),rush.release_decision(text),rush.export_attendance(text) to authenticated,service_role;
