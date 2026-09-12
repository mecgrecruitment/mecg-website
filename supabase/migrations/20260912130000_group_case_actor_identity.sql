-- 20260912100100 re-issued set_application_status and rsvp_slot with auth.uid()
-- instead of rush.actor_id(). Under third-party auth the two differ, so a board
-- status change recorded no actor and an applicant RSVP could not find its
-- application. Same bodies, provider-neutral identity. Caught by the
-- foundation suite's "all Rush functions use provider-neutral actor identity".

create or replace function rush.set_application_status(target_application_id text,next_status rush.application_status)
returns void language plpgsql security definer set search_path='' as $$
declare app_row rush.applications%rowtype;
begin
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode='P0002'; end if;
  if not rush.has_cycle_capability(app_row.cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if;
  if exists (select 1 from rush.conflict_declarations c where c.application_id=app_row.id and c.declarer_id=rush.actor_id()) then raise exception 'conflict recusal' using errcode='42501'; end if;
  if next_status in ('OFFERED','WAITLISTED','REJECTED','WITHDRAWN') then raise exception 'decision and withdrawal outcomes cannot be set manually' using errcode='55000'; end if;
  if next_status<>app_row.status and not (
    (app_row.status='DRAFT' and next_status='SUBMITTED') or
    (app_row.status='SUBMITTED' and next_status in ('NEEDS_INFO','ELIGIBLE')) or
    (app_row.status='NEEDS_INFO' and next_status in ('SUBMITTED','ELIGIBLE')) or
    (app_row.status='ELIGIBLE' and next_status='INVITED') or
    (app_row.status='INVITED' and next_status='GROUP_CASE') or
    (app_row.status='GROUP_CASE' and next_status='IN_PROCESS') or
    (app_row.status='IN_PROCESS' and next_status='FINAL_REVIEW')
  ) then raise exception 'invalid application transition' using errcode='55000'; end if;
  update rush.applications a set status=next_status where a.id=target_application_id;
  if next_status<>app_row.status then
    insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
    values (rush.actor_id(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
  end if;
end; $$;

create or replace function rush.rsvp_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := rush.actor_id(); slot rush.event_slots%rowtype; event_row rush.events%rowtype; app_row rush.applications%rowtype; taken integer; result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select s.* into slot from rush.event_slots s where s.id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select e.* into event_row from rush.events e where e.id=slot.event_id;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=event_row.cycle_id;
  if app_row.id is null or app_row.status in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') then raise exception 'eligible application required' using errcode='42501'; end if;
  if event_row.status<>'PUBLISHED' or event_row.visibility='INTERNAL' or slot.starts_at<=now()
    or not exists (select 1 from rush.rush_cycles c where c.id=event_row.cycle_id and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK'))
    or (event_row.visibility='INVITE' and app_row.status not in ('INVITED','GROUP_CASE','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED')) then raise exception 'slot unavailable' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rsvp:'||app_row.id||':'||event_row.id,0));
  select r.id into result_id from rush.slot_rsvps r where r.slot_id=slot.id and r.application_id=app_row.id;
  if result_id is not null then return result_id; end if;
  if exists (select 1 from rush.slot_rsvps r join rush.event_slots booked on booked.id=r.slot_id where r.application_id=app_row.id and booked.event_id=event_row.id) then raise exception 'event already booked' using errcode='55000'; end if;
  select count(*) into taken from rush.slot_rsvps r where r.slot_id=slot.id;
  if taken>=slot.capacity then raise exception 'slot full' using errcode='55000'; end if;
  insert into rush.slot_rsvps (slot_id,application_id) values (slot.id,app_row.id) returning id into result_id;
  return result_id;
end; $$;
