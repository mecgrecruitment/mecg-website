create or replace function rush.submit_application(applicant_name text, applicant_contact text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  normalized text := lower(trim(applicant_contact));
  v_cycle_id text;
  person_id text;
  application_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then
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
    values (actor, trim(applicant_name), trim(applicant_contact), normalized) returning id into person_id;
  else
    update rush.pnms set name = trim(applicant_name), contact = trim(applicant_contact), normalized_contact = normalized where id = person_id;
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
