create function rush.submit_application(applicant_name text, applicant_contact text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized text := lower(trim(applicant_contact));
  v_cycle_id text;
  person_id text;
  application_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120
    or char_length(normalized) not between 3 and 254 then
    raise exception 'invalid applicant details' using errcode = '22023';
  end if;
  select id into v_cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  select id into person_id from rush.pnms where auth_user_id = actor for update;
  if person_id is null then
    if exists (select 1 from rush.pnms where normalized_contact = normalized and auth_user_id is distinct from actor) then
      raise exception 'contact belongs to another account' using errcode = '23505';
    end if;
    insert into rush.pnms (auth_user_id, name, contact, normalized_contact)
    values (actor, trim(applicant_name), trim(applicant_contact), normalized)
    returning id into person_id;
  else
    update rush.pnms set name = trim(applicant_name), contact = trim(applicant_contact), normalized_contact = normalized
    where id = person_id;
  end if;

  insert into rush.applications (pnm_id, cycle_id, status, submitted_at)
  values (person_id, v_cycle_id, 'SUBMITTED', now())
  on conflict (pnm_id, cycle_id) do update set updated_at = rush.applications.updated_at
  returning id into application_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, v_cycle_id, 'APPLICATION_SUBMITTED', 'Application', application_id);
  return application_id;
end;
$$;

create function rush.event_for_token(raw_token text)
returns table (id text, name text, starts_at timestamptz, is_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.starts_at,
    e.status = 'PUBLISHED' and now() between e.checkin_opens_at and e.checkin_closes_at
      and (c.id is null or c.status not in ('CLOSED', 'ARCHIVED'))
  from rush.events e left join rush.rush_cycles c on c.id = e.cycle_id
  where e.checkin_token_digest = encode(extensions.digest(raw_token, 'sha256'), 'hex');
$$;

create function rush.check_in(raw_token text)
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

revoke all on function rush.submit_application(text, text) from public, anon;
revoke all on function rush.event_for_token(text) from public;
revoke all on function rush.check_in(text) from public, anon;
grant execute on function rush.submit_application(text, text) to authenticated, service_role;
grant execute on function rush.event_for_token(text) to anon, authenticated, service_role;
grant execute on function rush.check_in(text) to authenticated, service_role;
