-- Make the existing application draft payload a strict, resumable server
-- document. Ownership is derived from the authenticated profile; callers never
-- provide an application or applicant id.
create or replace function rush.application_draft()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  current_cycle_id text;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select c.id into current_cycle_id
  from rush.rush_cycles c
  where c.status = 'OPEN'
    and (c.opens_at is null or c.opens_at <= now())
    and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc
  limit 1;
  if current_cycle_id is null or not rush.application_portal_allows(actor) then return null; end if;

  select a.draft_payload into result
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = current_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO');
  return result;
end;
$$;

create or replace function rush.save_application_draft(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  v_cycle_id text;
  person_id text;
  application_id text;
  draft_answers jsonb := coalesce(payload->'answers', '{}'::jsonb);
  actor_email text;
  normalized_email text;
  resume_path text := coalesce(payload->>'resumeStoragePath', '');
  normalized_payload jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 65536 then
    raise exception 'invalid draft' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(payload) supplied(key)
    where supplied.key not in (
      'name', 'preferredName', 'phone', 'classYear', 'major', 'college',
      'uniqname', 'gradTerm', 'accessibilityNotes', 'linkedinUrl', 'answers',
      'resumeStoragePath', 'currentStep'
    )
  ) then raise exception 'invalid draft field' using errcode = '22023'; end if;
  if jsonb_typeof(draft_answers) <> 'object' then
    raise exception 'invalid draft answers' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(draft_answers)) > 50
     or (payload ? 'currentStep' and jsonb_typeof(payload->'currentStep') <> 'string')
     or coalesce(payload->>'currentStep', 'details') not in ('details', 'responses', 'materials', 'review') then
    raise exception 'invalid draft' using errcode = '22023';
  end if;

  if exists (
    select 1 from (values
      ('name', 120), ('preferredName', 80), ('phone', 32), ('classYear', 20),
      ('major', 120), ('college', 80), ('uniqname', 16), ('gradTerm', 40),
      ('accessibilityNotes', 2000), ('linkedinUrl', 400), ('resumeStoragePath', 240)
    ) limits(key, maximum)
    where payload ? limits.key
      and (jsonb_typeof(payload->limits.key) <> 'string' or char_length(payload->>limits.key) > limits.maximum)
  ) then raise exception 'invalid draft field' using errcode = '22023'; end if;
  if coalesce(payload->>'classYear', '') <> '' and coalesce(payload->>'classYear', '') not in ('FIRST_YEAR','SOPHOMORE','JUNIOR','SENIOR','GRADUATE') then
    raise exception 'invalid class year' using errcode = '22023';
  end if;
  if coalesce(payload->>'college', '') <> '' and coalesce(payload->>'college', '') not in ('Engineering','LSA','Ross','Information','Stamps','Kinesiology','Nursing','Public Policy','Other') then
    raise exception 'invalid college' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(draft_answers) x
    where char_length(x.key) > 80
       or x.key !~ '^[a-z][a-z0-9_]*$'
       or jsonb_typeof(x.value) <> 'string'
       or char_length(x.value #>> '{}') > 8000
  ) or (select coalesce(sum(char_length(x.value)), 0) from jsonb_each_text(draft_answers) x) > 40000 then
    raise exception 'invalid draft answers' using errcode = '22023';
  end if;

  select c.id into v_cycle_id from rush.rush_cycles c
  where c.status = 'OPEN'
    and (c.opens_at is null or c.opens_at <= now())
    and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  if exists (
    select 1 from jsonb_object_keys(draft_answers) supplied(key)
    where not exists (
      select 1 from rush.application_questions q
      where q.cycle_id = v_cycle_id and q.key = supplied.key
    )
  ) then raise exception 'unknown application answer' using errcode = '22023'; end if;
  if resume_path <> '' and not exists (
    select 1 from rush.application_documents d
    where d.object_path = resume_path
      and d.owner_user_id = actor
      and d.cycle_id = v_cycle_id
      and d.kind = 'RESUME'
      and d.status in ('READY', 'ATTACHED')
  ) then raise exception 'invalid resume path' using errcode = '22023'; end if;

  select p.primary_email into actor_email from rush.profiles p where p.id = actor;
  normalized_email := lower(trim(coalesce(actor_email, '')));
  if char_length(normalized_email) not between 3 and 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a verified email is required' using errcode = '22023';
  end if;
  select p.id into person_id from rush.pnms p where p.auth_user_id = actor;
  if person_id is null then
    if exists (
      select 1 from rush.pnms p
      where p.normalized_contact = normalized_email and p.auth_user_id is distinct from actor
    ) then raise exception 'contact belongs to another account' using errcode = '23505'; end if;
    insert into rush.pnms (auth_user_id, name, contact, normalized_contact)
    values (actor, coalesce(nullif(trim(payload->>'name'), ''), 'Applicant'), trim(actor_email), normalized_email)
    returning id into person_id;
  end if;

  normalized_payload := jsonb_build_object(
    'name', coalesce(payload->>'name', ''),
    'preferredName', coalesce(payload->>'preferredName', ''),
    'phone', coalesce(payload->>'phone', ''),
    'classYear', coalesce(payload->>'classYear', ''),
    'major', coalesce(payload->>'major', ''),
    'college', coalesce(payload->>'college', ''),
    'uniqname', coalesce(payload->>'uniqname', ''),
    'gradTerm', coalesce(payload->>'gradTerm', ''),
    'accessibilityNotes', coalesce(payload->>'accessibilityNotes', ''),
    'linkedinUrl', coalesce(payload->>'linkedinUrl', ''),
    'answers', draft_answers,
    'resumeStoragePath', resume_path,
    'currentStep', coalesce(payload->>'currentStep', 'details')
  );

  insert into rush.applications (pnm_id, cycle_id, status, draft_payload)
  values (person_id, v_cycle_id, 'DRAFT', normalized_payload)
  on conflict (pnm_id, cycle_id) do update set draft_payload = excluded.draft_payload
  where rush.applications.status in ('DRAFT', 'NEEDS_INFO')
  returning id into application_id;
  if application_id is null then raise exception 'application can no longer be edited' using errcode = '55000'; end if;
  return application_id;
end;
$$;

revoke all on function rush.application_draft(), rush.save_application_draft(jsonb) from public, anon;
grant execute on function rush.application_draft(), rush.save_application_draft(jsonb) to authenticated, service_role;
