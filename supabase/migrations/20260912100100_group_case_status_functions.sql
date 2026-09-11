-- Route the manual pipeline through GROUP_CASE and let Group Case applicants
-- see and book invite-only events, matching the other invited stages.
create or replace function rush.set_application_status(target_application_id text,next_status rush.application_status)
returns void language plpgsql security definer set search_path='' as $$
declare app_row rush.applications%rowtype;
begin
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode='P0002'; end if;
  if not rush.has_cycle_capability(app_row.cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if;
  if exists (select 1 from rush.conflict_declarations c where c.application_id=app_row.id and c.declarer_id=auth.uid()) then raise exception 'conflict recusal' using errcode='42501'; end if;
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
    values (auth.uid(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
  end if;
end; $$;

create or replace function rush.rsvp_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); slot rush.event_slots%rowtype; event_row rush.events%rowtype; app_row rush.applications%rowtype; taken integer; result_id text;
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

create or replace function rush.reschedule_my_event_rsvp(current_slot_id text,next_slot_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); current_slot rush.event_slots%rowtype; next_slot rush.event_slots%rowtype; event_row rush.events%rowtype; app_row rush.applications%rowtype; booking rush.slot_rsvps%rowtype; taken integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into current_slot from rush.event_slots where id=current_slot_id;
  select * into next_slot from rush.event_slots where id=next_slot_id;
  if current_slot.id is null or next_slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  if current_slot.event_id<>next_slot.event_id then raise exception 'replacement must be for the same event' using errcode='22023'; end if;
  select * into event_row from rush.events where id=current_slot.event_id;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=event_row.cycle_id;
  if app_row.id is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rsvp:'||app_row.id||':'||event_row.id,0));
  perform 1 from rush.event_slots where id in (current_slot_id,next_slot_id) order by id for update;
  select * into booking from rush.slot_rsvps where slot_id=current_slot.id and application_id=app_row.id for update;
  if booking.id is null and exists(select 1 from rush.slot_rsvps where slot_id=next_slot.id and application_id=app_row.id) then return false; end if;
  if booking.id is null then raise exception 'RSVP missing' using errcode='P0002'; end if;
  if current_slot.id=next_slot.id then return false; end if;
  if current_slot.starts_at<=now() or next_slot.starts_at<=now() or event_row.status<>'PUBLISHED'
    or app_row.status in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN')
    or not exists(select 1 from rush.rush_cycles where id=event_row.cycle_id and status in ('OPEN','IN_PROCESS','DECISION_LOCK'))
    or (event_row.visibility='INVITE' and app_row.status not in ('INVITED','GROUP_CASE','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED'))
  then raise exception 'slot unavailable' using errcode='55000'; end if;
  select count(*) into taken from rush.slot_rsvps where slot_id=next_slot.id;
  if taken>=next_slot.capacity then raise exception 'slot full' using errcode='55000'; end if;
  update rush.slot_rsvps set slot_id=next_slot.id where id=booking.id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,event_row.cycle_id,'APPLICANT_RSVP_RESCHEDULED','SlotRsvp',booking.id,jsonb_build_object('fromSlotId',current_slot.id,'toSlotId',next_slot.id,'eventId',event_row.id));
  return true;
end $$;

create or replace function rush.applicant_schedule()
returns jsonb language sql stable security definer set search_path='' as $$
  with my_apps as (
    select distinct on (a.cycle_id) a.id,a.cycle_id,a.status from rush.applications a join rush.pnms p on p.id=a.pnm_id
    where p.auth_user_id=rush.actor_id() order by a.cycle_id,a.created_at desc
  )
  select jsonb_build_object(
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('slotId',s.id,'eventId',e.id,'eventName',e.name,'startsAt',s.starts_at,'endsAt',s.ends_at,'location',e.location) order by s.starts_at)
      from my_apps ma join rush.slot_rsvps r on r.application_id=ma.id join rush.event_slots s on s.id=r.slot_id join rush.events e on e.id=s.event_id),'[]'::jsonb),
    'group',(select jsonb_build_object('name',g.name,'prompt',g.prompt) from my_apps ma join rush.case_group_members m on m.application_id=ma.id join rush.case_groups g on g.id=m.group_id order by g.created_at desc limit 1),
    'buddy',(select jsonb_build_object('slotId',s.id,'cycleId',s.cycle_id,'startsAt',s.starts_at,'endsAt',s.ends_at) from my_apps ma join rush.buddy_bookings b on b.application_id=ma.id join rush.buddy_slots s on s.id=b.slot_id order by s.starts_at desc limit 1),
    'buddies',coalesce((select jsonb_agg(jsonb_build_object('slotId',s.id,'cycleId',s.cycle_id,'startsAt',s.starts_at,'endsAt',s.ends_at) order by s.starts_at) from my_apps ma join rush.buddy_bookings b on b.application_id=ma.id join rush.buddy_slots s on s.id=b.slot_id),'[]'::jsonb),
    'openSlots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'eventId',e.id,'eventName',e.name,'startsAt',s.starts_at,'endsAt',s.ends_at,'remaining',s.capacity-(select count(*) from rush.slot_rsvps x where x.slot_id=s.id)) order by s.starts_at)
      from my_apps ma join rush.rush_cycles c on c.id=ma.cycle_id join rush.events e on e.cycle_id=ma.cycle_id join rush.event_slots s on s.event_id=e.id
      where ma.status not in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK') and e.status='PUBLISHED' and e.visibility in ('PUBLIC','INVITE') and s.starts_at>now()
        and (e.visibility='PUBLIC' or ma.status in ('INVITED','GROUP_CASE','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED'))
        and not exists(select 1 from rush.slot_rsvps own where own.application_id=ma.id and own.slot_id=s.id)
        and (select count(*) from rush.slot_rsvps x where x.slot_id=s.id)<s.capacity),'[]'::jsonb),
    'openBuddy',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'cycleId',s.cycle_id,'startsAt',s.starts_at,'endsAt',s.ends_at) order by s.starts_at)
      from my_apps ma join rush.rush_cycles c on c.id=ma.cycle_id join rush.buddy_slots s on s.cycle_id=ma.cycle_id
      where ma.status not in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK') and s.starts_at>now()
        and not exists(select 1 from rush.buddy_bookings b where b.slot_id=s.id)),'[]'::jsonb)
  );
$$;

