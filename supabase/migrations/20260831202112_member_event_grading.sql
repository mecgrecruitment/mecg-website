-- Member event grading: members check in with the same QR token as applicants,
-- then submit blind per-applicant impressions while the grading window is open
-- (check-in window plus a 4 hour grace period).

alter table rush.events add column if not exists member_grading boolean not null default false;

create table rush.member_checkins (
  id text primary key default gen_random_uuid()::text,
  member_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null references rush.events (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (member_id, event_id)
);

create table rush.event_impressions (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references rush.events (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  score int not null check (score between 1 and 5),
  tags text[] not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 6),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, application_id, member_id)
);

create index event_impressions_event_application_idx
  on rush.event_impressions (event_id, application_id);

-- Same shape as rush.round_cycle_id: a security definer lookup so policies can
-- resolve an event's cycle without evaluating rush.events RLS inside a policy.
create or replace function rush.event_cycle_id(target_event_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cycle_id from rush.events where id = target_event_id;
$$;

-- Replaces the 20260821120000 definition. Applicant behavior is unchanged; a
-- member of the event's cycle now lands in rush.member_checkins instead of
-- being rejected for want of an application.
create or replace function rush.check_in(raw_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row rush.events%rowtype;
  person_id text;
  inserted_count integer;
  checkin_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into event_row from rush.events
  where checkin_token_digest = encode(extensions.digest(raw_token, 'sha256'), 'hex') for update;
  if event_row.id is null or event_row.status <> 'PUBLISHED' then raise exception 'event not found' using errcode = 'P0002'; end if;
  if now() not between event_row.checkin_opens_at and event_row.checkin_closes_at then
    raise exception 'check-in is closed' using errcode = '42501';
  end if;
  if event_row.cycle_id is not null and exists (
    select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED')
  ) then raise exception 'event not found' using errcode = 'P0002'; end if;
  if event_row.cycle_id is not null and exists (
    select 1 from rush.memberships where user_id = actor and cycle_id = event_row.cycle_id and active
  ) then
    insert into rush.member_checkins (member_id, event_id) values (actor, event_row.id)
    on conflict (member_id, event_id) do nothing returning id into checkin_id;
    get diagnostics inserted_count = row_count;
    if inserted_count = 1 then
      insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
      values (actor, event_row.cycle_id, 'MEMBER_CHECKED_IN', 'MemberCheckin', checkin_id);
    end if;
    return inserted_count = 0;
  end if;
  select id into person_id from rush.pnms where auth_user_id = actor;
  if person_id is null then raise exception 'application required' using errcode = '42501'; end if;
  if event_row.cycle_id is not null and not exists (
    select 1 from rush.applications where pnm_id = person_id and cycle_id = event_row.cycle_id
  ) then raise exception 'application required' using errcode = '42501'; end if;
  insert into rush.checkins (pnm_id, event_id) values (person_id, event_row.id)
  on conflict (pnm_id, event_id) do nothing returning id into checkin_id;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
    values (actor, event_row.cycle_id, 'APPLICANT_CHECKED_IN', 'Checkin', checkin_id);
  end if;
  return inserted_count = 0;
end;
$$;

create or replace function rush.set_event_grading(target_event_id text, enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row rush.events%rowtype;
begin
  select * into event_row from rush.events where id = target_event_id for update;
  if event_row.id is null then raise exception 'event missing' using errcode = 'P0002'; end if;
  if event_row.cycle_id is null or not rush.has_cycle_capability(event_row.cycle_id, 'EVENTS') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED')) then
    raise exception 'cycle closed' using errcode = '55000';
  end if;
  update rush.events set member_grading = enabled where id = target_event_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), event_row.cycle_id, 'EVENT_GRADING_SET', 'Event', target_event_id, jsonb_build_object('enabled', enabled));
end;
$$;

create or replace function rush.my_grading_events()
returns table (event_id text, event_name text, starts_at timestamptz, grading_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.starts_at,
    now() between e.checkin_opens_at and e.checkin_closes_at + interval '4 hours'
  from rush.events e
  join rush.member_checkins mc on mc.event_id = e.id and mc.member_id = auth.uid()
  join rush.rush_cycles c on c.id = e.cycle_id and c.status not in ('CLOSED', 'ARCHIVED')
  where e.member_grading and e.status = 'PUBLISHED'
    and now() <= e.checkin_closes_at + interval '4 hours'
  order by e.starts_at;
$$;

create or replace function rush.event_grading_roster(target_event_id text)
returns table (application_id text, applicant_name text, impression_id text, score int, tags text[], note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row rush.events%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into event_row from rush.events where id = target_event_id;
  if event_row.id is null or event_row.status <> 'PUBLISHED' or not event_row.member_grading
    or event_row.cycle_id is null
    or exists (select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED'))
  then
    raise exception 'grading unavailable' using errcode = '42501';
  end if;
  if now() not between event_row.checkin_opens_at and event_row.checkin_closes_at + interval '4 hours' then
    raise exception 'grading is closed' using errcode = '42501';
  end if;
  if not exists (select 1 from rush.member_checkins mc where mc.member_id = actor and mc.event_id = target_event_id) then
    raise exception 'check in to this event first' using errcode = '42501';
  end if;
  return query
  select a.id, p.name, i.id, i.score, i.tags, i.note
  from rush.checkins c
  join rush.pnms p on p.id = c.pnm_id
  join rush.applications a on a.pnm_id = c.pnm_id and a.cycle_id = event_row.cycle_id
  left join rush.event_impressions i
    on i.event_id = target_event_id and i.application_id = a.id and i.member_id = actor
  where c.event_id = target_event_id
    and a.status not in ('DRAFT', 'WITHDRAWN')
    and not exists (
      select 1 from rush.conflict_declarations cd
      where cd.application_id = a.id and cd.declarer_id = actor
    )
  order by p.name;
end;
$$;

create or replace function rush.submit_event_impression(
  target_event_id text,
  target_application_id text,
  impression_score int,
  impression_tags text[],
  impression_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row rush.events%rowtype;
  app_row rush.applications%rowtype;
  cleaned_tags text[] := '{}';
  tag text;
  result_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into event_row from rush.events where id = target_event_id;
  if event_row.id is null or event_row.status <> 'PUBLISHED' or not event_row.member_grading
    or event_row.cycle_id is null
  then
    raise exception 'grading unavailable' using errcode = '42501';
  end if;
  if exists (select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED')) then
    raise exception 'cycle closed' using errcode = '55000';
  end if;
  if now() not between event_row.checkin_opens_at and event_row.checkin_closes_at + interval '4 hours' then
    raise exception 'grading is closed' using errcode = '42501';
  end if;
  if not exists (select 1 from rush.member_checkins where member_id = actor and event_id = target_event_id) then
    raise exception 'check in to this event first' using errcode = '42501';
  end if;
  select * into app_row from rush.applications where id = target_application_id;
  if app_row.id is null or app_row.cycle_id <> event_row.cycle_id or app_row.status in ('DRAFT', 'WITHDRAWN') then
    raise exception 'application missing' using errcode = 'P0002';
  end if;
  if not exists (select 1 from rush.checkins where pnm_id = app_row.pnm_id and event_id = target_event_id) then
    raise exception 'applicant is not checked in to this event' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations
    where application_id = target_application_id and declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;
  if impression_score is null or impression_score not between 1 and 5 then
    raise exception 'invalid score' using errcode = '22023';
  end if;
  if coalesce(array_length(impression_tags, 1), 0) > 6 then
    raise exception 'too many tags' using errcode = '22023';
  end if;
  foreach tag in array coalesce(impression_tags, '{}') loop
    if char_length(trim(tag)) not between 1 and 40 then
      raise exception 'invalid tag' using errcode = '22023';
    end if;
    cleaned_tags := cleaned_tags || trim(tag);
  end loop;
  if char_length(coalesce(impression_note, '')) > 1000 then
    raise exception 'note too long' using errcode = '22023';
  end if;
  insert into rush.event_impressions (event_id, application_id, member_id, score, tags, note)
  values (target_event_id, target_application_id, actor, impression_score, cleaned_tags, coalesce(impression_note, ''))
  on conflict (event_id, application_id, member_id)
  do update set score = excluded.score, tags = excluded.tags, note = excluded.note, updated_at = now()
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, event_row.cycle_id, 'IMPRESSION_SUBMITTED', 'EventImpression', result_id);
  return result_id;
end;
$$;

alter table rush.member_checkins enable row level security;
alter table rush.member_checkins force row level security;
alter table rush.event_impressions enable row level security;
alter table rush.event_impressions force row level security;

-- All writes go through the RPCs above, so both tables are select-only.
-- Staff read reuses rush.has_cycle_role (covers PANEL for hash/deliberation
-- pages, unlike has_cycle_capability) via the security definer cycle lookup.
create policy member_checkins_read_own_or_staff on rush.member_checkins
for select to authenticated
using (
  member_id = auth.uid()
  or rush.has_cycle_role(
    rush.event_cycle_id(event_id),
    array['BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  )
);

-- Blind grading: regular MEMBERs only ever see their own impressions.
create policy event_impressions_read_own_or_staff on rush.event_impressions
for select to authenticated
using (
  member_id = auth.uid()
  or rush.has_cycle_role(
    rush.event_cycle_id(event_id),
    array['BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  )
);

grant select on rush.member_checkins, rush.event_impressions to authenticated;
grant all on rush.member_checkins, rush.event_impressions to service_role;

revoke all on function
  rush.event_cycle_id(text),
  rush.check_in(text),
  rush.set_event_grading(text, boolean),
  rush.my_grading_events(),
  rush.event_grading_roster(text),
  rush.submit_event_impression(text, text, int, text[], text)
from public, anon;
grant execute on function
  rush.event_cycle_id(text),
  rush.check_in(text),
  rush.set_event_grading(text, boolean),
  rush.my_grading_events(),
  rush.event_grading_roster(text),
  rush.submit_event_impression(text, text, int, text[], text)
to authenticated, service_role;;
