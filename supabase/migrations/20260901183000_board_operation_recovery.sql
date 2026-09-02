-- Routine Board recovery operations. All authorization and invariants live in
-- the database so API callers cannot bypass them.

-- The original outbox was decision-specific. Events use the same delivery
-- machinery, but keep a distinct source and idempotency constraint.
alter table rush.notification_outbox alter column decision_id drop not null;
alter table rush.notification_outbox add column event_id text references rush.events(id) on delete restrict;
alter table rush.notification_outbox drop constraint notification_outbox_template_key_check;
alter table rush.notification_outbox add constraint notification_outbox_template_key_check
  check (template_key in ('DECISION_RELEASED', 'EVENT_CANCELLED'));
alter table rush.notification_outbox add constraint notification_outbox_one_source_check
  check (num_nonnulls(decision_id, event_id) = 1);
alter table rush.notification_outbox add constraint notification_outbox_event_recipient_key
  unique(event_id, application_id, template_key, template_version);
create or replace function rush.claim_notification(target_notification_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); item rush.notification_outbox%rowtype; result jsonb;
begin
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if not (current_setting('request.jwt.claim.role', true) = 'service_role'
    or (actor is not null and rush.has_cycle_role(item.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])))
  then raise exception 'forbidden' using errcode = '42501'; end if;
  if item.status = 'SENT' then return null; end if;
  if item.status = 'FAILED' or item.attempt_count >= item.max_attempts then raise exception 'notification attempts exhausted' using errcode = '55000'; end if;
  if item.next_attempt_at > now() then return null; end if;
  update rush.notification_outbox set status = 'PROCESSING', attempt_count = attempt_count + 1,
    last_attempt_at = now(), next_attempt_at = now() + interval '10 minutes' where id = item.id returning * into item;

  if item.template_key = 'DECISION_RELEASED' then
    select jsonb_build_object('id',item.id,'recipient',item.recipient,'templateKey',item.template_key,
      'templateVersion',item.template_version,'attemptCount',item.attempt_count,'idempotencyKey',item.idempotency_key,
      'decisionOutcome',d.outcome::text,'applicantName',p.name)
    into result from rush.decisions d join rush.applications a on a.id=d.application_id join rush.pnms p on p.id=a.pnm_id
    where d.id=item.decision_id and a.id=item.application_id;
  elsif item.template_key = 'EVENT_CANCELLED' then
    select jsonb_build_object('id',item.id,'recipient',item.recipient,'templateKey',item.template_key,
      'templateVersion',item.template_version,'attemptCount',item.attempt_count,'idempotencyKey',item.idempotency_key,
      'eventName',e.name,'eventStartsAt',e.starts_at,'eventLocation',e.location,'applicantName',p.name)
    into result from rush.events e join rush.applications a on a.id=item.application_id join rush.pnms p on p.id=a.pnm_id
    where e.id=item.event_id;
  end if;
  if result is null then raise exception 'notification source missing' using errcode = 'P0002'; end if;
  return result;
end $$;
create function rush.update_event(
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
create function rush.cancel_event(target_event_id text, cancellation_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_row rush.events%rowtype; affected_rsvps integer;
begin
  select * into current_row from rush.events where id = target_event_id for update;
  if current_row.id is null then raise exception 'event missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_capability(current_row.cycle_id, 'EVENTS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if current_row.status = 'CANCELLED' then return; end if;
  if current_row.status = 'CLOSED' then raise exception 'event locked' using errcode = '55000'; end if;
  if char_length(trim(cancellation_reason)) not between 1 and 1000 then raise exception 'reason required' using errcode = '22023'; end if;
  select count(*) into affected_rsvps from rush.slot_rsvps r join rush.event_slots s on s.id = r.slot_id where s.event_id = target_event_id;
  update rush.events set status = 'CANCELLED', member_grading = false, updated_at = now() where id = target_event_id;
  insert into rush.notification_outbox(cycle_id, application_id, event_id, recipient, template_key, template_version, idempotency_key)
  select distinct current_row.cycle_id, a.id, target_event_id, p.contact, 'EVENT_CANCELLED', 1,
    'event-cancelled:' || target_event_id || ':' || a.id
  from rush.slot_rsvps r join rush.event_slots s on s.id = r.slot_id
  join rush.applications a on a.id = r.application_id join rush.pnms p on p.id = a.pnm_id
  where s.event_id = target_event_id
  on conflict(event_id, application_id, template_key, template_version) do nothing;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), current_row.cycle_id, 'EVENT_CANCELLED', 'Event', target_event_id,
    jsonb_build_object('reason', trim(cancellation_reason), 'affectedRsvps', affected_rsvps));
end $$;
create function rush.unassign_evaluator(target_assignment_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare assignment_row rush.evaluation_assignments%rowtype; target_cycle text;
begin
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null then return false; end if;
  select cycle_id into target_cycle from rush.rounds where id = assignment_row.round_id;
  if not rush.has_cycle_capability(target_cycle, 'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if assignment_row.status <> 'ASSIGNED' or exists(select 1 from rush.evaluations where assignment_id = target_assignment_id)
  then raise exception 'assignment has evidence' using errcode = '55000'; end if;
  delete from rush.evaluation_assignments where id = target_assignment_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), target_cycle, 'EVALUATOR_UNASSIGNED', 'EvaluationAssignment', target_assignment_id,
    jsonb_build_object('evaluatorId', assignment_row.evaluator_id, 'applicationId', assignment_row.application_id, 'roundId', assignment_row.round_id));
  return true;
end $$;
create function rush.reassign_evaluator(target_assignment_id text, replacement_evaluator_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare assignment_row rush.evaluation_assignments%rowtype; target_cycle text;
begin
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null then raise exception 'assignment missing' using errcode = 'P0002'; end if;
  select cycle_id into target_cycle from rush.rounds where id = assignment_row.round_id;
  if not rush.has_cycle_capability(target_cycle, 'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if assignment_row.evaluator_id = replacement_evaluator_id then return target_assignment_id; end if;
  if assignment_row.status <> 'ASSIGNED' or exists(select 1 from rush.evaluations where assignment_id = target_assignment_id)
  then raise exception 'assignment has evidence' using errcode = '55000'; end if;
  if not exists(select 1 from rush.memberships where cycle_id = target_cycle and user_id = replacement_evaluator_id and active)
    or exists(select 1 from rush.conflict_declarations where application_id = assignment_row.application_id and declarer_id = replacement_evaluator_id)
  then raise exception 'replacement evaluator ineligible' using errcode = '42501'; end if;
  if rush.is_eligible_screening_reviewer(target_cycle, replacement_evaluator_id)
    and exists(select 1 from rush.screening_batches where cycle_id = target_cycle and status = 'PUBLISHED')
  then raise exception 'replacement evaluator ineligible' using errcode = '42501'; end if;
  update rush.evaluation_assignments set evaluator_id = replacement_evaluator_id, updated_at = now() where id = target_assignment_id;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), target_cycle, 'EVALUATOR_REASSIGNED', 'EvaluationAssignment', target_assignment_id,
    jsonb_build_object('fromEvaluatorId', assignment_row.evaluator_id, 'toEvaluatorId', replacement_evaluator_id));
  return target_assignment_id;
end $$;
create function rush.deactivate_cycle_membership(target_user_id uuid, target_cycle_id text, revocation_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare previous_roles text[];
begin
  if auth.uid() = target_user_id then raise exception 'self deactivation forbidden' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[]) then raise exception 'owner required' using errcode = '42501'; end if;
  if char_length(trim(revocation_reason)) not between 1 and 1000 then raise exception 'reason required' using errcode = '22023'; end if;
  perform id from rush.memberships where cycle_id = target_cycle_id order by id for update;
  select array_agg(role::text order by role::text) into previous_roles from rush.memberships
    where cycle_id = target_cycle_id and user_id = target_user_id and active;
  if previous_roles is null then return false; end if;
  if 'OWNER' = any(previous_roles) and not exists(select 1 from rush.memberships
    where cycle_id = target_cycle_id and role = 'OWNER' and active and user_id <> target_user_id)
  then raise exception 'cycle must retain an owner' using errcode = '55000'; end if;
  update rush.memberships set active = false, revoked_at = now()
    where cycle_id = target_cycle_id and user_id = target_user_id and active;
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), target_cycle_id, 'MEMBERSHIP_DEACTIVATED', 'Profile', target_user_id::text,
    jsonb_build_object('roles', previous_roles, 'reason', trim(revocation_reason)));
  return true;
end $$;
create function rush.restore_cycle_membership(target_user_id uuid, target_cycle_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare restored_roles text[]; role_snapshot jsonb;
begin
  if auth.uid() = target_user_id then raise exception 'self restoration forbidden' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['OWNER']::rush.member_role[]) then raise exception 'owner required' using errcode = '42501'; end if;
  if not exists(select 1 from rush.profiles where id = target_user_id and active) then raise exception 'user missing' using errcode = 'P0002'; end if;
  perform id from rush.memberships where cycle_id = target_cycle_id order by id for update;
  select metadata->'roles' into role_snapshot
  from rush.audit_events where cycle_id = target_cycle_id and action = 'MEMBERSHIP_DEACTIVATED'
    and resource_id = target_user_id::text order by created_at desc limit 1;
  if role_snapshot is null then return false; end if;
  select array_agg(value) into restored_roles from jsonb_array_elements_text(role_snapshot);
  if exists(select 1 from rush.screening_reviewers sr join rush.screening_batches b on b.id = sr.batch_id
    where sr.reviewer_id = target_user_id and b.cycle_id = target_cycle_id)
    and restored_roles && array['RECRUITMENT_COMMITTEE','BOARD','PANEL','OWNER']::text[]
  then raise exception 'screening reviewer cannot receive a privileged role in the same cycle' using errcode = '42501'; end if;
  update rush.memberships set active = true, revoked_at = null
    where cycle_id = target_cycle_id and user_id = target_user_id and not active and role::text = any(restored_roles);
  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values(auth.uid(), target_cycle_id, 'MEMBERSHIP_RESTORED', 'Profile', target_user_id::text,
    jsonb_build_object('roles', restored_roles));
  return true;
end $$;
revoke all on function rush.update_event(text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz),
  rush.cancel_event(text,text), rush.unassign_evaluator(text), rush.reassign_evaluator(text,uuid),
  rush.deactivate_cycle_membership(uuid,text,text), rush.restore_cycle_membership(uuid,text) from public, anon;
grant execute on function rush.update_event(text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz),
  rush.cancel_event(text,text), rush.unassign_evaluator(text), rush.reassign_evaluator(text,uuid),
  rush.deactivate_cycle_membership(uuid,text,text), rush.restore_cycle_membership(uuid,text) to authenticated, service_role;
