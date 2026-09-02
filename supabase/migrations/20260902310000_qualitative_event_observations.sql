-- Event notes are supporting qualitative context, not a second scoring model.
-- Preserve historic numeric impressions for audit/history while making every
-- new record explicitly observation-only. Formal rubric evaluations remain
-- the sole source of merit scores and decision readiness.

alter table rush.event_impressions
  add column legacy_numeric boolean not null default false,
  add column legacy_score integer check (legacy_score is null or legacy_score between 1 and 5);
alter table rush.event_impressions alter column score drop not null;
update rush.event_impressions
set legacy_numeric = score is not null,
    legacy_score = score,
    score = null;
alter table rush.event_impressions add constraint event_impressions_legacy_score_only_check
  check (
    score is null
    and ((legacy_numeric and legacy_score between 1 and 5) or (not legacy_numeric and legacy_score is null))
  );
comment on column rush.event_impressions.score is
  'Retired numeric field, always null. Formal rubric evaluations are the only merit score.';
comment on column rush.event_impressions.legacy_numeric is
  'True only for a numeric impression created before qualitative observations replaced event scoring.';
comment on column rush.event_impressions.legacy_score is
  'Historic numeric impression retained for audit only and never used as decision evidence.';

create or replace function rush.event_observation_roster(target_event_id text)
returns table (
  application_id text,
  applicant_name text,
  observation_id text,
  tags text[],
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  event_row rush.events%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into event_row from rush.events where id = target_event_id;
  if event_row.id is null or event_row.status <> 'PUBLISHED' or not event_row.member_grading
    or event_row.cycle_id is null
    or exists (select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED'))
  then
    raise exception 'observations unavailable' using errcode = '42501';
  end if;
  if now() not between event_row.checkin_opens_at and event_row.checkin_closes_at + interval '4 hours' then
    raise exception 'observations are closed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.member_checkins mc
    where mc.member_id = actor and mc.event_id = target_event_id
  ) then
    raise exception 'check in to this event first' using errcode = '42501';
  end if;
  return query
  select a.id, p.name, observation.id, observation.tags, observation.note
  from rush.checkins attendance
  join rush.pnms p on p.id = attendance.pnm_id
  join rush.applications a on a.pnm_id = attendance.pnm_id and a.cycle_id = event_row.cycle_id
  left join rush.event_impressions observation
    on observation.event_id = target_event_id
   and observation.application_id = a.id
   and observation.member_id = actor
  where attendance.event_id = target_event_id
    and a.status not in ('DRAFT', 'WITHDRAWN')
    and not exists (
      select 1 from rush.conflict_declarations conflict
      where conflict.application_id = a.id and conflict.declarer_id = actor
    )
  order by p.name;
end;
$$;

create or replace function rush.submit_event_observation(
  target_event_id text,
  target_application_id text,
  observation_tags text[],
  observation_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
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
    raise exception 'observations unavailable' using errcode = '42501';
  end if;
  if exists (select 1 from rush.rush_cycles where id = event_row.cycle_id and status in ('CLOSED', 'ARCHIVED')) then
    raise exception 'cycle closed' using errcode = '55000';
  end if;
  if now() not between event_row.checkin_opens_at and event_row.checkin_closes_at + interval '4 hours' then
    raise exception 'observations are closed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.member_checkins where member_id = actor and event_id = target_event_id
  ) then
    raise exception 'check in to this event first' using errcode = '42501';
  end if;
  select * into app_row from rush.applications where id = target_application_id;
  if app_row.id is null or app_row.cycle_id <> event_row.cycle_id or app_row.status in ('DRAFT', 'WITHDRAWN') then
    raise exception 'application missing' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from rush.checkins where pnm_id = app_row.pnm_id and event_id = target_event_id
  ) then
    raise exception 'applicant is not checked in to this event' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations
    where application_id = target_application_id and declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;
  if coalesce(array_length(observation_tags, 1), 0) > 6 then
    raise exception 'too many tags' using errcode = '22023';
  end if;
  foreach tag in array coalesce(observation_tags, '{}') loop
    if char_length(trim(tag)) not between 1 and 40 or trim(tag) = any(cleaned_tags) then
      raise exception 'invalid tag' using errcode = '22023';
    end if;
    cleaned_tags := cleaned_tags || trim(tag);
  end loop;
  if char_length(coalesce(observation_note, '')) > 1000 then
    raise exception 'note too long' using errcode = '22023';
  end if;
  if coalesce(array_length(cleaned_tags, 1), 0) = 0 and nullif(trim(coalesce(observation_note, '')), '') is null then
    raise exception 'add a tag or observation note' using errcode = '22023';
  end if;

  insert into rush.event_impressions (
    event_id, application_id, member_id, score, legacy_numeric, tags, note
  ) values (
    target_event_id, target_application_id, actor, null, false,
    cleaned_tags, trim(coalesce(observation_note, ''))
  )
  on conflict (event_id, application_id, member_id)
  do update set
    score = null,
    tags = excluded.tags,
    note = excluded.note,
    updated_at = now()
  returning id into result_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor, event_row.cycle_id, 'EVENT_OBSERVATION_SAVED', 'EventObservation', result_id,
    jsonb_build_object('tagCount', coalesce(array_length(cleaned_tags, 1), 0), 'hasNote', trim(coalesce(observation_note, '')) <> '')
  );
  return result_id;
end;
$$;

-- Retain historic functions for migration rollback/audit compatibility, but no
-- application role may use the numeric write or score-bearing roster anymore.
revoke all on function rush.event_grading_roster(text) from public, anon, authenticated, service_role;
revoke all on function rush.submit_event_impression(text, text, int, text[], text)
  from public, anon, authenticated, service_role;
revoke all on function rush.event_observation_roster(text), rush.submit_event_observation(text, text, text[], text)
  from public, anon;
grant execute on function rush.event_observation_roster(text), rush.submit_event_observation(text, text, text[], text)
  to authenticated, service_role;
