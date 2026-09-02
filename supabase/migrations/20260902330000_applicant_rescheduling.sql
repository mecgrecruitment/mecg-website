-- Applicant-owned future bookings can be cancelled or moved without Board
-- intervention. Reschedules update the existing booking inside one transaction,
-- so capacity is never released before the replacement is secured.
create function rush.cancel_my_event_rsvp(target_slot_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); slot rush.event_slots%rowtype; event_row rush.events%rowtype; app_id text; deleted_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into slot from rush.event_slots where id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select * into event_row from rush.events where id=slot.event_id;
  select a.id into app_id from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=event_row.cycle_id;
  if app_id is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rsvp:'||app_id||':'||event_row.id,0));
  delete from rush.slot_rsvps where slot_id=slot.id and application_id=app_id returning id into deleted_id;
  if deleted_id is null then return false; end if;
  if slot.starts_at<=now() then raise exception 'past RSVP cannot be cancelled' using errcode='55000'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,event_row.cycle_id,'APPLICANT_RSVP_CANCELLED','SlotRsvp',deleted_id,jsonb_build_object('slotId',slot.id,'eventId',event_row.id));
  return true;
end $$;

create function rush.reschedule_my_event_rsvp(current_slot_id text,next_slot_id text)
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
    or (event_row.visibility='INVITE' and app_row.status not in ('INVITED','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED'))
  then raise exception 'slot unavailable' using errcode='55000'; end if;
  select count(*) into taken from rush.slot_rsvps where slot_id=next_slot.id;
  if taken>=next_slot.capacity then raise exception 'slot full' using errcode='55000'; end if;
  update rush.slot_rsvps set slot_id=next_slot.id where id=booking.id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,event_row.cycle_id,'APPLICANT_RSVP_RESCHEDULED','SlotRsvp',booking.id,jsonb_build_object('fromSlotId',current_slot.id,'toSlotId',next_slot.id,'eventId',event_row.id));
  return true;
end $$;

create function rush.cancel_my_buddy_booking(target_slot_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); slot rush.buddy_slots%rowtype; app_id text; deleted_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into slot from rush.buddy_slots where id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select a.id into app_id from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=slot.cycle_id;
  if app_id is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('buddy:'||app_id||':'||slot.cycle_id,0));
  delete from rush.buddy_bookings where slot_id=slot.id and application_id=app_id returning id into deleted_id;
  if deleted_id is null then return false; end if;
  if slot.starts_at<=now() then raise exception 'past member chat cannot be cancelled' using errcode='55000'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,slot.cycle_id,'APPLICANT_BUDDY_CANCELLED','BuddyBooking',deleted_id,jsonb_build_object('slotId',slot.id));
  return true;
end $$;

create function rush.reschedule_my_buddy_booking(current_slot_id text,next_slot_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=rush.actor_id(); current_slot rush.buddy_slots%rowtype; next_slot rush.buddy_slots%rowtype; app_row rush.applications%rowtype; booking rush.buddy_bookings%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into current_slot from rush.buddy_slots where id=current_slot_id;
  select * into next_slot from rush.buddy_slots where id=next_slot_id;
  if current_slot.id is null or next_slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  if current_slot.cycle_id<>next_slot.cycle_id then raise exception 'replacement must be in the same cycle' using errcode='22023'; end if;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id where p.auth_user_id=actor and a.cycle_id=current_slot.cycle_id;
  if app_row.id is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('buddy:'||app_row.id||':'||current_slot.cycle_id,0));
  perform 1 from rush.buddy_slots where id in (current_slot_id,next_slot_id) order by id for update;
  select * into booking from rush.buddy_bookings where slot_id=current_slot.id and application_id=app_row.id for update;
  if booking.id is null and exists(select 1 from rush.buddy_bookings where slot_id=next_slot.id and application_id=app_row.id) then return false; end if;
  if booking.id is null then raise exception 'member chat missing' using errcode='P0002'; end if;
  if current_slot.id=next_slot.id then return false; end if;
  if current_slot.starts_at<=now() or next_slot.starts_at<=now() or app_row.status in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN')
    or not exists(select 1 from rush.rush_cycles where id=current_slot.cycle_id and status in ('OPEN','IN_PROCESS','DECISION_LOCK'))
    or exists(select 1 from rush.buddy_bookings where slot_id=next_slot.id)
  then raise exception 'slot unavailable' using errcode='55000'; end if;
  update rush.buddy_bookings set slot_id=next_slot.id where id=booking.id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(actor,current_slot.cycle_id,'APPLICANT_BUDDY_RESCHEDULED','BuddyBooking',booking.id,jsonb_build_object('fromSlotId',current_slot.id,'toSlotId',next_slot.id));
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
        and (e.visibility='PUBLIC' or ma.status in ('INVITED','IN_PROCESS','FINAL_REVIEW','OFFERED','WAITLISTED'))
        and not exists(select 1 from rush.slot_rsvps own where own.application_id=ma.id and own.slot_id=s.id)
        and (select count(*) from rush.slot_rsvps x where x.slot_id=s.id)<s.capacity),'[]'::jsonb),
    'openBuddy',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'cycleId',s.cycle_id,'startsAt',s.starts_at,'endsAt',s.ends_at) order by s.starts_at)
      from my_apps ma join rush.rush_cycles c on c.id=ma.cycle_id join rush.buddy_slots s on s.cycle_id=ma.cycle_id
      where ma.status not in ('DRAFT','NEEDS_INFO','REJECTED','WITHDRAWN') and c.status in ('OPEN','IN_PROCESS','DECISION_LOCK') and s.starts_at>now()
        and not exists(select 1 from rush.buddy_bookings b where b.slot_id=s.id)),'[]'::jsonb)
  );
$$;

revoke all on function rush.cancel_my_event_rsvp(text),rush.reschedule_my_event_rsvp(text,text),rush.cancel_my_buddy_booking(text),rush.reschedule_my_buddy_booking(text,text) from public,anon;
grant execute on function rush.cancel_my_event_rsvp(text),rush.reschedule_my_event_rsvp(text,text),rush.cancel_my_buddy_booking(text),rush.reschedule_my_buddy_booking(text,text) to authenticated,service_role;
