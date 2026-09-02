-- Festifall, and any event held before applications open, puts the check-in QR
-- in front of students who have an account but no application. The Fall 2026
-- cycle does not accept applications until 20:00, the minute Festifall check-in
-- closes, and submitting one requires a resume upload nobody completes standing
-- at a table on the Diag.
--
-- Both check-in paths rejected those students. rush.check_in raised
-- 'application required' twice: once for a missing pnms row, which nothing
-- creates except submit_application, and once for a missing application in the
-- event's cycle. rush.staff_assisted_check_in matched identifiers only against
-- existing applications, so the board's manual fallback failed identically and
-- there was no way to record a walk-up at all.
--
-- Attendance is operational evidence only. It feeds no impression, evaluation,
-- or decision, and the rotating event token is the real gate on who can record
-- it. So the requirement is identity, not application status: derive the pnms
-- record from the signed-in profile and let the attendance row stand alone.
-- When the student applies later, applications.pnm_id joins it back to their
-- application with no backfill, which is how the event page already builds its
-- coverage list.

-- Shared by both check-in paths so the self-service and staff-assisted routes
-- resolve the same person to the same pnms row.
create or replace function rush.pnm_for_actor(actor uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  person_id text;
  profile_name text;
  profile_email text;
  derived_uniqname text;
begin
  if actor is null then return null; end if;
  select id into person_id from rush.pnms where auth_user_id = actor;
  if person_id is not null then return person_id; end if;

  select nullif(lower(trim(p.primary_email)), ''), nullif(trim(p.display_name), '')
    into profile_email, profile_name
  from rush.profiles p
  where p.id = actor;
  if profile_email is null or char_length(profile_email) not between 3 and 254 then
    raise exception 'profile contact required' using errcode = '42501';
  end if;

  -- Only a real uniqname, so the board can look a walk-up up by it at the table.
  -- Two people cannot share one, and a shared address would have been claimed by
  -- the update below, so this cannot make an assisted lookup ambiguous.
  derived_uniqname := split_part(profile_email, '@', 1);
  if profile_email not like '%@umich.edu' or derived_uniqname !~ '^[a-z][a-z0-9]{1,15}$' then
    derived_uniqname := null;
  end if;

  -- Claim an unlinked record (interest signup, board-entered) rather than
  -- creating a second one: normalized_contact is unique, so the insert below
  -- would fail against it anyway.
  update rush.pnms set auth_user_id = actor, updated_at = now()
  where normalized_contact = profile_email and auth_user_id is null
  returning id into person_id;
  if person_id is not null then return person_id; end if;

  insert into rush.pnms (auth_user_id, name, contact, normalized_contact, uniqname)
  values (
    actor,
    left(coalesce(profile_name, profile_email), 120),
    profile_email,
    profile_email,
    derived_uniqname
  )
  on conflict (normalized_contact) do nothing
  returning id into person_id;
  if person_id is null then
    raise exception 'contact belongs to another account' using errcode = '23505';
  end if;
  return person_id;
end;
$$;
revoke all on function rush.pnm_for_actor(uuid) from public, anon, authenticated;

create or replace function rush.check_in(raw_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
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
  person_id := rush.pnm_for_actor(actor);
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

-- Resolve the identifier to a person rather than to an application, so the
-- fallback covers a walk-up who has signed in but not applied. The blind
-- screening candidate_code stays application-scoped because that is the only
-- thing it identifies.
create or replace function rush.staff_assisted_check_in(
  target_event_id text,
  applicant_identifier text,
  reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  event_row rush.events%rowtype;
  pnm_ids text[];
  applicant_pnm_id text;
  application_row rush.applications%rowtype;
  normalized_identifier text := lower(trim(applicant_identifier));
  checkin_row rush.checkins%rowtype;
  was_duplicate boolean := false;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if normalized_identifier is null or char_length(normalized_identifier) not between 2 and 254
    or reason_code is null
    or reason_code not in ('NO_CAMERA', 'CONNECTIVITY_FAILURE', 'QR_FAILURE', 'SIGN_IN_UNAVAILABLE', 'ACCESSIBILITY_SUPPORT')
  then raise exception 'invalid assisted check-in details' using errcode = '22023'; end if;

  select * into event_row from rush.events where id = target_event_id for update;
  if event_row.id is null then raise exception 'event missing' using errcode = 'P0002'; end if;
  if event_row.cycle_id is null or not rush.has_cycle_capability(event_row.cycle_id, 'APPLICANT_OPERATIONS') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if event_row.status <> 'PUBLISHED'
    or now() not between event_row.checkin_opens_at and event_row.checkin_closes_at
    or exists (select 1 from rush.rush_cycles c where c.id = event_row.cycle_id and c.status in ('CLOSED', 'ARCHIVED'))
  then raise exception 'check-in unavailable' using errcode = '55000'; end if;

  select array_agg(distinct matches.pnm_id) into pnm_ids
  from (
    select p.id as pnm_id
    from rush.pnms p
    where lower(p.normalized_contact) = normalized_identifier
      or lower(coalesce(p.uniqname, '')) = normalized_identifier
    union
    select a.pnm_id
    from rush.applications a
    join rush.screening_packets sp on sp.application_id = a.id
    join rush.screening_batches sb on sb.id = sp.batch_id and sb.cycle_id = a.cycle_id
    where a.cycle_id = event_row.cycle_id
      and a.status <> 'WITHDRAWN'
      and lower(sp.candidate_code) = normalized_identifier
  ) matches;

  if coalesce(array_length(pnm_ids, 1), 0) = 0 then
    raise exception 'applicant missing' using errcode = 'P0002';
  end if;
  if array_length(pnm_ids, 1) <> 1 then
    raise exception 'ambiguous applicant identifier' using errcode = '22023';
  end if;
  applicant_pnm_id := pnm_ids[1];

  -- A withdrawal is a decision to stop being processed in this cycle, so it
  -- still blocks attendance. Having no application at all does not.
  select * into application_row from rush.applications
  where pnm_id = applicant_pnm_id and cycle_id = event_row.cycle_id for update;
  if application_row.id is not null and application_row.status = 'WITHDRAWN' then
    raise exception 'applicant missing' using errcode = 'P0002';
  end if;

  select * into checkin_row from rush.checkins
  where pnm_id = applicant_pnm_id and event_id = event_row.id
  for update;
  if checkin_row.id is not null then
    was_duplicate := true;
  else
    insert into rush.checkins (pnm_id, event_id, checkin_method, checked_in_by, reason_code)
    values (applicant_pnm_id, event_row.id, 'STAFF_ASSISTED', actor, reason_code)
    returning * into checkin_row;

    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
    values (
      actor,
      event_row.cycle_id,
      'APPLICANT_STAFF_ASSISTED_CHECKIN',
      'Checkin',
      checkin_row.id,
      jsonb_build_object('applicationId', application_row.id, 'method', 'STAFF_ASSISTED', 'reasonCode', reason_code)
    );
  end if;

  return jsonb_build_object(
    'checkinId', checkin_row.id,
    'applicationId', application_row.id,
    'duplicate', was_duplicate
  );
end;
$$;
revoke all on function rush.staff_assisted_check_in(text, text, text) from public, anon;
grant execute on function rush.staff_assisted_check_in(text, text, text) to authenticated, service_role;
revoke all on function rush.check_in(text) from public, anon;
grant execute on function rush.check_in(text) to authenticated, service_role;
