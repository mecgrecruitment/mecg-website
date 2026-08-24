alter table rush.pnms
  add column if not exists uniqname text check (uniqname is null or uniqname ~ '^[a-z][a-z0-9]{1,15}$'),
  add column if not exists college text check (college is null or char_length(trim(college)) between 1 and 80),
  add column if not exists grad_term text check (grad_term is null or char_length(trim(grad_term)) between 1 and 40),
  add column if not exists accessibility_notes text check (accessibility_notes is null or char_length(accessibility_notes) <= 2000);

alter table rush.applications
  add column if not exists draft_payload jsonb,
  add column if not exists offer_response text check (offer_response is null or offer_response in ('ACCEPTED','DECLINED')),
  add column if not exists offer_responded_at timestamptz;

create or replace function rush.intake_schema()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if cycle_row.id is null then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null);
  end if;

  select a.draft_payload into draft
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = cycle_row.id and a.status in ('DRAFT', 'NEEDS_INFO');

  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'draft', draft,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;

alter table rush.events
  add column if not exists location text check (location is null or char_length(trim(location)) between 1 and 200),
  add column if not exists visibility text not null default 'INTERNAL' check (visibility in ('PUBLIC','INVITE','INTERNAL')),
  add column if not exists ends_at timestamptz;

alter table rush.decisions
  add column if not exists communication_preview text check (communication_preview is null or char_length(trim(communication_preview)) between 1 and 4000);

create table if not exists rush.interest_signups (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (char_length(trim(email)) between 3 and 254),
  uniqname text,
  class_year text,
  how_heard text,
  created_at timestamptz not null default now(),
  unique (cycle_id, email)
);

create table if not exists rush.event_slots (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references rush.events (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 8 check (capacity between 1 and 80),
  check (ends_at > starts_at)
);

create table if not exists rush.slot_rsvps (
  id text primary key default gen_random_uuid()::text,
  slot_id text not null references rush.event_slots (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (slot_id, application_id)
);

create table if not exists rush.case_groups (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  prompt text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists rush.case_group_members (
  group_id text not null references rush.case_groups (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  primary key (group_id, application_id)
);

create table if not exists rush.buddy_slots (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  member_id uuid not null references rush.profiles (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists rush.buddy_bookings (
  id text primary key default gen_random_uuid()::text,
  slot_id text not null references rush.buddy_slots (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (slot_id),
  unique (application_id, slot_id)
);

create table if not exists rush.process_surveys (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

alter table rush.interest_signups enable row level security; alter table rush.interest_signups force row level security;
alter table rush.event_slots enable row level security; alter table rush.event_slots force row level security;
alter table rush.slot_rsvps enable row level security; alter table rush.slot_rsvps force row level security;
alter table rush.case_groups enable row level security; alter table rush.case_groups force row level security;
alter table rush.case_group_members enable row level security; alter table rush.case_group_members force row level security;
alter table rush.buddy_slots enable row level security; alter table rush.buddy_slots force row level security;
alter table rush.buddy_bookings enable row level security; alter table rush.buddy_bookings force row level security;
alter table rush.process_surveys enable row level security; alter table rush.process_surveys force row level security;

create policy interest_board_read on rush.interest_signups for select to authenticated
using (rush.has_cycle_role(cycle_id, array['BOARD','OWNER']::rush.member_role[]));
create policy slots_read on rush.event_slots for select to authenticated
using (exists (select 1 from rush.events e where e.id = event_slots.event_id and (
  rush.has_cycle_role(e.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or exists (select 1 from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.cycle_id=e.cycle_id and p.auth_user_id=auth.uid())
)));
create policy rsvps_read on rush.slot_rsvps for select to authenticated
using (rush.owns_application(application_id) or exists (
  select 1 from rush.event_slots s join rush.events e on e.id=s.event_id
  where s.id=slot_rsvps.slot_id and rush.has_cycle_role(e.cycle_id, array['BOARD','OWNER']::rush.member_role[])
));
create policy groups_read on rush.case_groups for select to authenticated
using (rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or exists (select 1 from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.cycle_id=case_groups.cycle_id and p.auth_user_id=auth.uid()));
create policy group_members_read on rush.case_group_members for select to authenticated
using (rush.owns_application(application_id) or exists (
  select 1 from rush.case_groups g where g.id=case_group_members.group_id
  and rush.has_cycle_role(g.cycle_id, array['BOARD','OWNER','MEMBER','PANEL']::rush.member_role[])
));
create policy buddy_slots_read on rush.buddy_slots for select to authenticated
using (member_id=auth.uid() or rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or exists (select 1 from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.cycle_id=buddy_slots.cycle_id and p.auth_user_id=auth.uid()));
create policy buddy_bookings_read on rush.buddy_bookings for select to authenticated
using (rush.owns_application(application_id) or exists (
  select 1 from rush.buddy_slots s where s.id=buddy_bookings.slot_id and (s.member_id=auth.uid() or rush.has_cycle_role(s.cycle_id, array['BOARD','OWNER']::rush.member_role[]))
));
create policy surveys_board_read on rush.process_surveys for select to authenticated
using (rush.has_cycle_role(cycle_id, array['BOARD','OWNER']::rush.member_role[]));

grant select on rush.interest_signups, rush.event_slots, rush.slot_rsvps, rush.case_groups, rush.case_group_members, rush.buddy_slots, rush.buddy_bookings, rush.process_surveys to authenticated;
grant all on rush.interest_signups, rush.event_slots, rush.slot_rsvps, rush.case_groups, rush.case_group_members, rush.buddy_slots, rush.buddy_bookings, rush.process_surveys to service_role;

grant usage on schema rush to anon;

create or replace function rush.public_recruitment()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cycle_row rush.rush_cycles%rowtype;
begin
  select * into cycle_row from rush.rush_cycles
  where status in ('DRAFT','OPEN','IN_PROCESS')
  order by created_at desc limit 1;
  if cycle_row.id is null then
    return jsonb_build_object('cycle', null, 'events', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'cycle', jsonb_build_object('id', cycle_row.id, 'name', cycle_row.name, 'status', cycle_row.status, 'opensAt', cycle_row.opens_at, 'closesAt', cycle_row.closes_at),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'kind', e.kind, 'visibility', e.visibility,
        'startsAt', e.starts_at, 'endsAt', e.ends_at, 'location', e.location
      ) order by e.starts_at)
      from rush.events e
      where e.cycle_id = cycle_row.id and e.status = 'PUBLISHED' and e.visibility = 'PUBLIC'
    ), '[]'::jsonb)
  );
end; $$;

create or replace function rush.submit_interest(full_name text, email text, uniqname text default null, class_year text default null, how_heard text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_cycle_id text; result_id text;
begin
  if char_length(trim(full_name)) not between 1 and 120 or char_length(trim(email)) not between 3 and 254 then
    raise exception 'invalid interest details' using errcode='22023';
  end if;
  select id into v_cycle_id from rush.rush_cycles where status in ('DRAFT','OPEN','IN_PROCESS') order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'recruitment is not open' using errcode='55000'; end if;
  insert into rush.interest_signups (cycle_id, name, email, uniqname, class_year, how_heard)
  values (v_cycle_id, trim(full_name), lower(trim(email)), nullif(lower(trim(uniqname)),''), class_year, nullif(trim(how_heard),''))
  on conflict (cycle_id, email) do update set name = excluded.name
  returning id into result_id;
  return result_id;
end; $$;

drop function if exists rush.create_event(text,text,timestamptz,timestamptz,timestamptz);

create function rush.create_event(
  target_cycle_id text,
  event_name text,
  event_starts_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  event_kind text default 'GENERAL',
  event_location text default null,
  event_visibility text default 'INTERNAL',
  event_ends_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare raw_token text := gen_random_uuid()::text || gen_random_uuid()::text; event_id text;
begin
  if not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from rush.rush_cycles where id=target_cycle_id and status not in ('CLOSED','ARCHIVED')) then raise exception 'cycle closed' using errcode='55000'; end if;
  if char_length(trim(event_name)) not between 1 and 160 or closes_at <= opens_at then raise exception 'invalid event' using errcode='22023'; end if;
  if event_visibility not in ('PUBLIC','INVITE','INTERNAL') then raise exception 'invalid visibility' using errcode='22023'; end if;
  insert into rush.events(cycle_id,name,kind,status,starts_at,ends_at,location,visibility,checkin_opens_at,checkin_closes_at,checkin_token_digest)
  values(target_cycle_id,trim(event_name),coalesce(nullif(trim(event_kind),''),'GENERAL'),'PUBLISHED',event_starts_at,event_ends_at,nullif(trim(event_location),''),event_visibility,opens_at,closes_at,encode(extensions.digest(raw_token,'sha256'),'hex'))
  returning id into event_id;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),target_cycle_id,'EVENT_CREATED','Event',event_id);
  return jsonb_build_object('id',event_id,'checkinToken',raw_token);
end; $$;

create or replace function rush.save_application_draft(payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); v_cycle_id text; person_id text; application_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select id into v_cycle_id from rush.rush_cycles where status='OPEN' order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode='55000'; end if;
  select id into person_id from rush.pnms where auth_user_id=actor;
  if person_id is null then
    insert into rush.pnms (auth_user_id, name, contact, normalized_contact)
    values (actor, coalesce(nullif(trim(payload->>'name'),''),'Applicant'), coalesce(auth.jwt()->>'email','pending@invalid'), lower(coalesce(auth.jwt()->>'email','pending@invalid')))
    returning id into person_id;
  end if;
  insert into rush.applications (pnm_id, cycle_id, status, draft_payload)
  values (person_id, v_cycle_id, 'DRAFT', payload)
  on conflict (pnm_id, cycle_id) do update
    set draft_payload = excluded.draft_payload
    where rush.applications.status in ('DRAFT','NEEDS_INFO')
  returning id into application_id;
  return application_id;
end; $$;

create or replace function rush.create_event_slot(target_event_id text, slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer default 8)
returns text language plpgsql security definer set search_path='' as $$
declare target_cycle text; result_id text;
begin
  select cycle_id into target_cycle from rush.events where id=target_event_id;
  if target_cycle is null or not rush.has_cycle_role(target_cycle, array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.event_slots (event_id, starts_at, ends_at, capacity) values (target_event_id, slot_starts_at, slot_ends_at, slot_capacity) returning id into result_id;
  return result_id;
end; $$;

create or replace function rush.rsvp_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); slot rush.event_slots%rowtype; app_id text; taken integer; result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into slot from rush.event_slots where id=target_slot_id;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  select a.id into app_id from rush.applications a join rush.pnms p on p.id=a.pnm_id join rush.events e on e.id=slot.event_id
  where p.auth_user_id=actor and a.cycle_id=e.cycle_id;
  if app_id is null then raise exception 'application required' using errcode='42501'; end if;
  select count(*) into taken from rush.slot_rsvps where slot_id=target_slot_id;
  if taken >= slot.capacity then raise exception 'slot full' using errcode='55000'; end if;
  insert into rush.slot_rsvps (slot_id, application_id) values (target_slot_id, app_id)
  on conflict (slot_id, application_id) do update set created_at=rush.slot_rsvps.created_at
  returning id into result_id;
  return result_id;
end; $$;

create or replace function rush.create_case_group(target_cycle_id text, group_name text, group_prompt text default '')
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.case_groups (cycle_id, name, prompt) values (target_cycle_id, trim(group_name), coalesce(group_prompt,'')) returning id into result_id;
  return result_id;
end; $$;

create or replace function rush.assign_case_group(target_group_id text, target_application_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_cycle text;
begin
  select cycle_id into v_cycle from rush.case_groups where id=target_group_id;
  if v_cycle is null or not rush.has_cycle_role(v_cycle, array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  delete from rush.case_group_members where application_id=target_application_id and group_id in (select id from rush.case_groups where cycle_id=v_cycle);
  insert into rush.case_group_members (group_id, application_id) values (target_group_id, target_application_id);
end; $$;

create or replace function rush.create_buddy_slot(target_cycle_id text, slot_starts_at timestamptz, slot_ends_at timestamptz)
returns text language plpgsql security definer set search_path='' as $$
declare result_id text;
begin
  if auth.uid() is null or not rush.has_cycle_role(target_cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into rush.buddy_slots (cycle_id, member_id, starts_at, ends_at) values (target_cycle_id, auth.uid(), slot_starts_at, slot_ends_at) returning id into result_id;
  return result_id;
end; $$;

create or replace function rush.book_buddy_slot(target_slot_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); slot rush.buddy_slots%rowtype; app_id text; result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into slot from rush.buddy_slots where id=target_slot_id for update;
  if slot.id is null then raise exception 'slot missing' using errcode='P0002'; end if;
  if exists (select 1 from rush.buddy_bookings where slot_id=target_slot_id) then raise exception 'slot taken' using errcode='55000'; end if;
  select a.id into app_id from rush.applications a join rush.pnms p on p.id=a.pnm_id
  where p.auth_user_id=actor and a.cycle_id=slot.cycle_id;
  if app_id is null then raise exception 'application required' using errcode='42501'; end if;
  insert into rush.buddy_bookings (slot_id, application_id) values (target_slot_id, app_id) returning id into result_id;
  return result_id;
end; $$;

create or replace function rush.respond_to_offer(accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); app_row rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select a.* into app_row from rush.applications a join rush.pnms p on p.id=a.pnm_id
  where p.auth_user_id=actor and a.status='OFFERED' order by a.submitted_at desc limit 1;
  if app_row.id is null then raise exception 'no offer' using errcode='P0002'; end if;
  update rush.applications set offer_response = case when accept then 'ACCEPTED' else 'DECLINED' end, offer_responded_at=now() where id=app_row.id;
end; $$;

create or replace function rush.set_decision_preview(target_decision_id text, preview_text text)
returns void language plpgsql security definer set search_path='' as $$
declare d rush.decisions%rowtype;
begin
  select * into d from rush.decisions where id=target_decision_id;
  if d.id is null or not rush.has_cycle_role(d.cycle_id, array['PANEL','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  update rush.decisions set communication_preview = trim(preview_text) where id=target_decision_id;
end; $$;

create or replace function rush.submit_process_survey(score integer, survey_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); v_cycle_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if score not between 1 and 5 then raise exception 'invalid rating' using errcode='22023'; end if;
  select a.cycle_id into v_cycle_id from rush.applications a join rush.pnms p on p.id=a.pnm_id
  where p.auth_user_id=actor order by a.created_at desc limit 1;
  if v_cycle_id is null then raise exception 'application required' using errcode='42501'; end if;
  insert into rush.process_surveys (cycle_id, rating, note) values (v_cycle_id, score, nullif(trim(survey_note),''));
end; $$;

create or replace function rush.set_applicant_profile(
  uniqname text default null,
  college text default null,
  grad_term text default null,
  accessibility_notes text default null
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  update rush.pnms set
    uniqname = coalesce(nullif(lower(trim(uniqname)),''), rush.pnms.uniqname),
    college = coalesce(nullif(trim(college),''), rush.pnms.college),
    grad_term = coalesce(nullif(trim(grad_term),''), rush.pnms.grad_term),
    accessibility_notes = coalesce(nullif(trim(accessibility_notes),''), rush.pnms.accessibility_notes)
  where auth_user_id = auth.uid();
end; $$;

create or replace function rush.applicant_schedule()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'rsvps', coalesce((
      select jsonb_agg(jsonb_build_object('slotId', s.id, 'eventName', e.name, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'location', e.location) order by s.starts_at)
      from rush.slot_rsvps r
      join rush.event_slots s on s.id=r.slot_id
      join rush.events e on e.id=s.event_id
      join rush.applications a on a.id=r.application_id
      join rush.pnms p on p.id=a.pnm_id
      where p.auth_user_id=auth.uid()
    ), '[]'::jsonb),
    'group', (
      select jsonb_build_object('name', g.name, 'prompt', g.prompt)
      from rush.case_group_members m
      join rush.case_groups g on g.id=m.group_id
      join rush.applications a on a.id=m.application_id
      join rush.pnms p on p.id=a.pnm_id
      where p.auth_user_id=auth.uid()
      limit 1
    ),
    'buddy', (
      select jsonb_build_object('startsAt', s.starts_at, 'endsAt', s.ends_at)
      from rush.buddy_bookings b
      join rush.buddy_slots s on s.id=b.slot_id
      join rush.applications a on a.id=b.application_id
      join rush.pnms p on p.id=a.pnm_id
      where p.auth_user_id=auth.uid()
      limit 1
    ),
    'openSlots', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'eventName', e.name, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'remaining', s.capacity - (select count(*) from rush.slot_rsvps x where x.slot_id=s.id)) order by s.starts_at)
      from rush.event_slots s
      join rush.events e on e.id=s.event_id
      join rush.applications a on a.cycle_id=e.cycle_id
      join rush.pnms p on p.id=a.pnm_id
      where p.auth_user_id=auth.uid() and e.visibility in ('PUBLIC','INVITE')
    ), '[]'::jsonb),
    'openBuddy', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at) order by s.starts_at)
      from rush.buddy_slots s
      join rush.applications a on a.cycle_id=s.cycle_id
      join rush.pnms p on p.id=a.pnm_id
      where p.auth_user_id=auth.uid()
        and not exists (select 1 from rush.buddy_bookings b where b.slot_id=s.id)
    ), '[]'::jsonb)
  );
$$;

revoke all on function rush.public_recruitment(), rush.submit_interest(text,text,text,text,text) from public;
grant execute on function rush.public_recruitment(), rush.submit_interest(text,text,text,text,text) to anon, authenticated, service_role;

revoke all on function
  rush.create_event(text,text,timestamptz,timestamptz,timestamptz,text,text,text,timestamptz),
  rush.save_application_draft(jsonb),
  rush.create_event_slot(text,timestamptz,timestamptz,integer),
  rush.rsvp_slot(text),
  rush.create_case_group(text,text,text),
  rush.assign_case_group(text,text),
  rush.create_buddy_slot(text,timestamptz,timestamptz),
  rush.book_buddy_slot(text),
  rush.respond_to_offer(boolean),
  rush.set_decision_preview(text,text),
  rush.submit_process_survey(integer,text),
  rush.set_applicant_profile(text,text,text,text),
  rush.applicant_schedule()
from public, anon;
grant execute on function
  rush.create_event(text,text,timestamptz,timestamptz,timestamptz,text,text,text,timestamptz),
  rush.save_application_draft(jsonb),
  rush.create_event_slot(text,timestamptz,timestamptz,integer),
  rush.rsvp_slot(text),
  rush.create_case_group(text,text,text),
  rush.assign_case_group(text,text),
  rush.create_buddy_slot(text,timestamptz,timestamptz),
  rush.book_buddy_slot(text),
  rush.respond_to_offer(boolean),
  rush.set_decision_preview(text,text),
  rush.submit_process_survey(integer,text),
  rush.set_applicant_profile(text,text,text,text),
  rush.applicant_schedule()
to authenticated, service_role;
