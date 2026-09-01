-- Forward-only release repairs for event bounds and the transactional workflow
-- verifier. The verifier temporarily archives any live cycle inside its own
-- doomed transaction, so the production one-active-cycle invariant remains in
-- force and real state is restored when the sentinel exception rolls back.

create or replace function rush.update_event(
  target_event_id text,
  event_name text,
  event_kind text,
  event_location text,
  event_visibility text,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_row rush.events%rowtype;
begin
  select * into current_row from rush.events where id = target_event_id for update;
  if current_row.id is null then raise exception 'event missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_capability(current_row.cycle_id, 'EVENTS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if current_row.status in ('CLOSED', 'CANCELLED') then raise exception 'event locked' using errcode = '55000'; end if;
  if current_row.status = 'PUBLISHED' and event_starts_at is distinct from current_row.starts_at and event_starts_at < now()
  then raise exception 'published event cannot move into the past' using errcode = '22023'; end if;
  if char_length(trim(event_name)) not between 1 and 160
    or char_length(trim(event_kind)) not between 1 and 80
    or event_visibility not in ('PUBLIC', 'INVITE', 'INTERNAL')
    or (nullif(trim(event_location), '') is not null and char_length(trim(event_location)) > 200)
    or event_ends_at <= event_starts_at or closes_at <= opens_at
  then raise exception 'invalid event' using errcode = '22023'; end if;

  perform id from rush.event_slots where event_id = target_event_id order by id for update;
  if exists(select 1 from rush.event_slots where event_id = target_event_id
    and (starts_at < event_starts_at or ends_at > event_ends_at))
  then raise exception 'existing slot outside event bounds' using errcode = '22023'; end if;

  update rush.events set
    name = trim(event_name), kind = trim(event_kind), location = nullif(trim(event_location), ''),
    visibility = event_visibility, starts_at = event_starts_at, ends_at = event_ends_at,
    checkin_opens_at = opens_at, checkin_closes_at = closes_at, updated_at = now()
  where id = target_event_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), current_row.cycle_id, 'EVENT_UPDATED', 'Event', target_event_id,
    jsonb_build_object('before', jsonb_build_object('name', current_row.name, 'kind', current_row.kind,
      'location', current_row.location, 'visibility', current_row.visibility, 'startsAt', current_row.starts_at,
      'endsAt', current_row.ends_at, 'checkinOpensAt', current_row.checkin_opens_at, 'checkinClosesAt', current_row.checkin_closes_at)));
end $$;

create or replace function rush.create_event_slot(
  target_event_id text,
  slot_starts_at timestamptz,
  slot_ends_at timestamptz,
  slot_capacity integer default 8
)
returns text language plpgsql security definer set search_path = '' as $$
declare event_row rush.events%rowtype; result_id text;
begin
  select * into event_row from rush.events where id = target_event_id for share;
  if event_row.id is null or not rush.has_cycle_capability(event_row.cycle_id, 'EVENTS')
  then raise exception 'forbidden' using errcode = '42501'; end if;
  if slot_starts_at is null or slot_ends_at is null or slot_ends_at <= slot_starts_at or slot_capacity not between 1 and 80
  then raise exception 'invalid event slot' using errcode = '22023'; end if;
  if event_row.starts_at > slot_starts_at or event_row.ends_at is null or slot_ends_at > event_row.ends_at
  then raise exception 'slot outside event bounds' using errcode = '22023'; end if;
  insert into rush.event_slots(event_id, starts_at, ends_at, capacity)
  values(target_event_id, slot_starts_at, slot_ends_at, slot_capacity) returning id into result_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id)
  values(auth.uid(), event_row.cycle_id, 'EVENT_SLOT_CREATED', 'EventSlot', result_id);
  return result_id;
end $$;

create or replace function rush.verify_full_workflow(owner_id uuid, panel_id uuid, applicant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_cycle_id text; round_id text; rubric_id text; criterion_id text; application_id text;
  owner_assignment text; panel_assignment text; decision_id text; event_result jsonb; token text;
  ratings jsonb; approval_result record; already_checked boolean; applicant_view record;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if not exists(select 1 from rush.profiles where id=owner_id) or not exists(select 1 from rush.profiles where id=panel_id) or not exists(select 1 from rush.profiles where id=applicant_id) then raise exception 'test profiles missing'; end if;

  perform id from rush.rush_cycles where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK') order by id for update;
  update rush.rush_cycles set status='ARCHIVED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
  insert into rush.rush_cycles(name,status) values('SELF TEST '||gen_random_uuid(),'OPEN') returning id into v_cycle_id;
  insert into rush.memberships(user_id,cycle_id,role) values(owner_id,v_cycle_id,'OWNER'),(panel_id,v_cycle_id,'PANEL');
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  application_id := rush.submit_application_self_test('Workflow Applicant'::text,('workflow-'||applicant_id||'@example.invalid')::text);
  update rush.rush_cycles set status='IN_PROCESS' where id=v_cycle_id;
  insert into rush.rounds(cycle_id,kind,name,status,weight) values(v_cycle_id,'SELF_TEST','Self Test','PUBLISHED',100) returning id into round_id;
  insert into rush.rubrics(round_id,version,minimum_observed_criteria) values(round_id,1,1) returning id into rubric_id;
  insert into rush.rubric_criteria(rubric_id,key,name,description,weight,required,position) values(rubric_id,'criterion','Criterion','Test criterion',100,true,0) returning id into criterion_id;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  owner_assignment := rush.assign_evaluator(v_cycle_id,round_id,application_id,owner_id);
  panel_assignment := rush.assign_evaluator(v_cycle_id,round_id,application_id,panel_id);
  perform rush.set_round_status(round_id,'ACTIVE');
  ratings := jsonb_build_array(jsonb_build_object('criterionId',criterion_id,'score',4,'note','Observed evidence'));
  perform * from rush.submit_evaluation(owner_assignment,ratings,'Owner evidence');
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform * from rush.submit_evaluation(panel_assignment,ratings,'Panel evidence');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform rush.set_round_status(round_id,'FROZEN');
  perform rush.set_cycle_status(v_cycle_id,'DECISION_LOCK');
  decision_id := rush.create_decision(v_cycle_id,application_id,'OFFER','Self-test decision');
  select * into approval_result from rush.approve_decision(decision_id);
  if approval_result.locked then raise exception 'first approval locked decision'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  select * into approval_result from rush.approve_decision(decision_id);
  if not approval_result.locked or approval_result.approvals <> 2 then raise exception 'two-person approval failed'; end if;
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  select * into applicant_view from rush.applicant_dashboard();
  if applicant_view.released_outcome is not null then raise exception 'unreleased outcome leaked'; end if;
  if applicant_view.display_status is distinct from 'SUBMITTED' then raise exception 'unreleased display status changed'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform rush.release_decision(decision_id);
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  select * into applicant_view from rush.applicant_dashboard();
  if applicant_view.released_outcome is distinct from 'OFFER' then raise exception 'released outcome unavailable'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  event_result := rush.create_event(v_cycle_id,'Self Test Event',now(),now()-interval '1 minute',now()+interval '1 minute');
  token := event_result->>'checkinToken';
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  already_checked := rush.check_in(token);
  if already_checked then raise exception 'first check-in reported duplicate'; end if;
  if not rush.check_in(token) then raise exception 'duplicate check-in was not idempotent'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform rush.declare_conflict(application_id,'Self-test conflict after release');
  if not exists(select 1 from rush.audit_events ae where ae.cycle_id=v_cycle_id and ae.action='CONFLICT_DECLARED_AFTER_RELEASE') then raise exception 'post-release conflict audit missing'; end if;
  raise exception 'WORKFLOW_SELF_TEST_PASSED' using errcode='P0001';
end $$;

revoke all on function rush.verify_full_workflow(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function rush.verify_full_workflow(uuid,uuid,uuid) to service_role;
