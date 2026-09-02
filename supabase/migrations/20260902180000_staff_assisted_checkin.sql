-- Audited attendance fallback for applicants who cannot use the event QR flow.
-- Attendance remains operational evidence only; this migration does not read or
-- write event impressions, evaluations, ratings, or decisions.

alter table rush.checkins
  add column if not exists checkin_method text not null default 'SELF_SERVICE',
  add column if not exists checked_in_by uuid references rush.profiles (id),
  add column if not exists reason_code text;
alter table rush.checkins drop constraint if exists checkins_method_details_check;
alter table rush.checkins add constraint checkins_method_details_check check (
  (checkin_method = 'SELF_SERVICE' and checked_in_by is null and reason_code is null)
  or
  (checkin_method = 'STAFF_ASSISTED'
    and checked_in_by is not null
    and reason_code in ('NO_CAMERA', 'CONNECTIVITY_FAILURE', 'QR_FAILURE', 'SIGN_IN_UNAVAILABLE', 'ACCESSIBILITY_SUPPORT'))
);
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
  application_ids text[];
  application_row rush.applications%rowtype;
  applicant_pnm_id text;
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

  select array_agg(matches.id order by matches.id) into application_ids
  from (
    select distinct a.id
    from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    left join rush.screening_packets sp on sp.application_id = a.id
    left join rush.screening_batches sb on sb.id = sp.batch_id and sb.cycle_id = a.cycle_id
    where a.cycle_id = event_row.cycle_id
      and a.status <> 'WITHDRAWN'
      and (
        lower(p.normalized_contact) = normalized_identifier
        or lower(coalesce(p.uniqname, '')) = normalized_identifier
        or (sb.id is not null and lower(sp.candidate_code) = normalized_identifier)
      )
  ) matches;

  if coalesce(array_length(application_ids, 1), 0) = 0 then
    raise exception 'applicant missing' using errcode = 'P0002';
  end if;
  if array_length(application_ids, 1) <> 1 then
    raise exception 'ambiguous applicant identifier' using errcode = '22023';
  end if;

  select * into application_row from rush.applications where id = application_ids[1] for update;
  if application_row.id is null or application_row.cycle_id <> event_row.cycle_id or application_row.status = 'WITHDRAWN' then
    raise exception 'applicant missing' using errcode = 'P0002';
  end if;
  select pnm_id into applicant_pnm_id from rush.applications where id = application_row.id;

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
