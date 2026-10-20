-- Revision tokens never repeat, including after row deletion/recreation. The row
-- lock in the conditional writer serializes with submission/status transitions.
alter table rush.applications
  add column draft_revision uuid not null default gen_random_uuid(),
  add column draft_mutation_id uuid,
  add column draft_mutation_expected uuid,
  add column draft_mutation_payload jsonb;

create or replace function rush.bump_application_draft_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.draft_payload is distinct from old.draft_payload or new.status is distinct from old.status then
    new.draft_revision := gen_random_uuid();
    new.draft_mutation_id := null;
    new.draft_mutation_expected := null;
    new.draft_mutation_payload := null;
  end if;
  return new;
end;
$$;
create trigger application_draft_revision before update on rush.applications
for each row execute function rush.bump_application_draft_revision();

-- Draft reads also project the newest READY resume. A document becoming ready
-- changes that server snapshot even before its path is saved in draft_payload.
create or replace function rush.invalidate_draft_after_resume_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'RESUME' and new.status = 'READY' then
    if tg_op = 'INSERT' or old.status is distinct from new.status then
      update rush.applications a set draft_revision = gen_random_uuid(),
        draft_mutation_id = null, draft_mutation_expected = null, draft_mutation_payload = null
      where a.id = new.application_id and a.status in ('DRAFT', 'NEEDS_INFO');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function rush.invalidate_draft_after_resume_ready() from public, anon, authenticated, service_role;
create trigger application_resume_draft_revision after insert or update of status on rush.application_documents
for each row execute function rush.invalidate_draft_after_resume_ready();

-- Keep the current validation/adoption/document ownership rules in one private
-- implementation; callers cannot bypass the revision precondition.
create or replace function rush.save_application_draft_unchecked(payload jsonb)
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
    -- A row holding this caller's own verified address, owned by an identity
    -- that cannot sign in the way this caller just did, is the same person
    -- returning after an auth provider change, not a second claimant. Adopt it
    -- rather than refusing: refusing strands the application permanently, with
    -- no action the applicant can take. The issuer is compared against the
    -- live token exactly as rush.actor_id() compares it, so this stays correct
    -- for any future provider without naming one.
    update rush.pnms p
       set auth_user_id = actor,
           updated_at = now()
     where p.normalized_contact = normalized_email
       and p.auth_user_id is distinct from actor
       and not exists (
         select 1 from rush.auth_identities i
         where i.app_user_id = p.auth_user_id
           and i.issuer = trim(trailing '/' from coalesce(auth.jwt() ->> 'iss', ''))
           and i.disabled_at is null
       )
    returning p.id into person_id;
  end if;
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

revoke all on function rush.save_application_draft_unchecked(jsonb) from public, anon, authenticated, service_role;

create or replace function rush.save_application_draft(payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'reload the application to save with a revision' using errcode = '55000';
end;
$$;

create or replace function rush.save_application_draft_v2(
  payload jsonb, expected_revision uuid, mutation_id uuid, cycle_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := rush.actor_id();
  selected_cycle text;
  existing rush.applications%rowtype;
  saved_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if mutation_id is null or cycle_id is null then raise exception 'draft precondition required' using errcode = '22023'; end if;
  -- Serializes first saves before a person/application row exists. Row locks
  -- below also serialize this writer with submission, deletion and status changes.
  perform pg_advisory_xact_lock(hashtextextended('application-draft:' || actor::text, 0));
  select c.id into selected_cycle from rush.rush_cycles c
  where c.status = 'OPEN' and (c.opens_at is null or c.opens_at <= now())
    and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc limit 1;
  if selected_cycle is distinct from cycle_id or not rush.application_portal_allows(actor) then
    raise exception 'application can no longer be edited' using errcode = '55000';
  end if;
  select a.* into existing from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = selected_cycle
  for update of a;
  if found then
    if existing.status not in ('DRAFT', 'NEEDS_INFO') then
      raise exception 'application can no longer be edited' using errcode = '55000';
    end if;
    if existing.draft_mutation_id = mutation_id then
      if existing.draft_mutation_expected is not distinct from expected_revision
        and existing.draft_mutation_payload = payload then
        return jsonb_build_object('kind', 'saved', 'revision', existing.draft_revision);
      end if;
      raise exception 'mutation id reused with different draft' using errcode = '22023';
    end if;
    if existing.draft_revision is distinct from expected_revision then
      return jsonb_build_object('kind', 'conflict', 'draft', rush.application_draft());
    end if;
  elsif expected_revision is not null then
    return jsonb_build_object('kind', 'conflict', 'draft', null);
  end if;
  saved_id := rush.save_application_draft_unchecked(payload);
  if not exists (select 1 from rush.applications a where a.id = saved_id and a.cycle_id = selected_cycle) then
    raise exception 'application cycle changed' using errcode = '55000';
  end if;
  update rush.applications a set
    draft_revision = gen_random_uuid(),
    draft_mutation_id = mutation_id,
    draft_mutation_expected = expected_revision,
    draft_mutation_payload = payload
  where a.id = saved_id returning a.* into existing;
  return jsonb_build_object('kind', 'saved', 'revision', existing.draft_revision);
end;
$$;
revoke all on function rush.save_application_draft_v2(jsonb,uuid,uuid,text) from public, anon;
grant execute on function rush.save_application_draft_v2(jsonb,uuid,uuid,text) to authenticated, service_role;

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

  select coalesce(a.draft_payload, jsonb_build_object(
    'name', p.name,
    'preferredName', coalesce(p.preferred_name, ''),
    'phone', coalesce(p.phone, ''),
    'classYear', coalesce(p.class_year::text, ''),
    'major', coalesce(p.major, ''),
    'college', coalesce(p.college::text, ''),
    'uniqname', coalesce(p.uniqname, ''),
    'gradTerm', coalesce(p.grad_term, ''),
    'accessibilityNotes', coalesce(p.accessibility_notes, ''),
    'linkedinUrl', coalesce(p.linkedin_url, ''),
    'answers', coalesce((
      select jsonb_object_agg(r.question_key, r.response_text)
      from rush.application_responses r
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = r.question_key
      where r.application_id = a.id
    ), '{}'::jsonb),
    'resumeStoragePath', coalesce(a.resume_storage_path, ''),
    'currentStep', 'details'
  )) || jsonb_build_object(
    'answers', coalesce((
      select jsonb_object_agg(candidate.key, candidate.value)
      from jsonb_each(coalesce(a.draft_payload->'answers', (
        select coalesce(jsonb_object_agg(r.question_key, r.response_text), '{}'::jsonb)
        from rush.application_responses r
        where r.application_id = a.id
      ))) candidate
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = candidate.key
    ), '{}'::jsonb),
    'revision', a.draft_revision,
    'resumeStoragePath', coalesce((
      select d.object_path
      from rush.application_documents d
      where d.owner_user_id = actor
        and d.cycle_id = current_cycle_id
        and d.kind = 'RESUME'
        and d.status = 'READY'
      order by d.ready_at desc nulls last, d.created_at desc
      limit 1
    ), a.resume_storage_path, a.draft_payload->>'resumeStoragePath', '')
  ) into result
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor
    and a.cycle_id = current_cycle_id
    and a.status in ('DRAFT', 'NEEDS_INFO');
  return result;
end;
$$;

create or replace function rush.intake_schema()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
  needs_info boolean;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;

  if cycle_row.id is null or not rush.application_portal_allows(actor) then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null, 'needsInfo', false);
  end if;

  select coalesce(a.draft_payload, jsonb_build_object(
    'name', p.name,
    'preferredName', coalesce(p.preferred_name, ''),
    'phone', coalesce(p.phone, ''),
    'classYear', coalesce(p.class_year::text, ''),
    'major', coalesce(p.major, ''),
    'college', coalesce(p.college::text, ''),
    'uniqname', coalesce(p.uniqname, ''),
    'gradTerm', coalesce(p.grad_term, ''),
    'accessibilityNotes', coalesce(p.accessibility_notes, ''),
    'linkedinUrl', coalesce(p.linkedin_url, ''),
    'answers', coalesce((
      select jsonb_object_agg(r.question_key, r.response_text)
      from rush.application_responses r
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = r.question_key
      where r.application_id = a.id
    ), '{}'::jsonb),
    'resumeStoragePath', coalesce(a.resume_storage_path, ''),
    'currentStep', 'details'
  )) || jsonb_build_object(
    'answers', coalesce((
      select jsonb_object_agg(candidate.key, candidate.value)
      from jsonb_each(coalesce(a.draft_payload->'answers', (
        select coalesce(jsonb_object_agg(r.question_key, r.response_text), '{}'::jsonb)
        from rush.application_responses r
        where r.application_id = a.id
      ))) candidate
      join rush.application_questions q
        on q.cycle_id = a.cycle_id and q.key = candidate.key
    ), '{}'::jsonb),
    'revision', a.draft_revision,
    'resumeStoragePath', coalesce((
      select d.object_path
      from rush.application_documents d
      where d.owner_user_id = actor
        and d.cycle_id = cycle_row.id
        and d.kind = 'RESUME'
        and d.status = 'READY'
      order by d.ready_at desc nulls last, d.created_at desc
      limit 1
    ), a.resume_storage_path, a.draft_payload->>'resumeStoragePath', '')
  ), (a.status = 'NEEDS_INFO')
  into draft, needs_info
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = cycle_row.id and a.status in ('DRAFT', 'NEEDS_INFO');

  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'draft', draft,
    'needsInfo', coalesce(needs_info, false),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options,
        'maxWords', q.word_limit
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;


-- Only the revision-aware entry point is callable by application instances.
-- Internal owner-executed fixtures can still call the historical implementation.
revoke all on function rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text),
 rush.submit_application_reliable(text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text)
 from public, anon, authenticated, service_role;

create or replace function rush.submit_application_v2(
  expected_revision uuid,
  cycle_id text,
  applicant_name text,
  applicant_contact text,
  preferred_name text default null,
  phone text default null,
  class_year text default null,
  major text default null,
  linkedin_url text default null,
  resume_storage_path text default null,
  answers jsonb default '{}'::jsonb,
  consent boolean default true,
  uniqname text default null,
  college text default null,
  grad_term text default null,
  accessibility_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := rush.actor_id();
  existing rush.applications%rowtype;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if cycle_id is null then raise exception 'draft precondition required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('application-draft:' || actor::text, 0));
  select a.* into existing from rush.applications a join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = submit_application_v2.cycle_id
  for update of a;
  if found then
    -- A committed submission wins over retry preconditions; never duplicate the
    -- submission or its outbox obligation after an acknowledgement is lost.
    if existing.submitted_at is not null and existing.status not in ('DRAFT', 'NEEDS_INFO') then
      return jsonb_build_object('applicationId', existing.id, 'submittedNow', false);
    end if;
    if existing.draft_revision is distinct from expected_revision then
      return jsonb_build_object('kind', 'conflict', 'draft', rush.application_draft());
    end if;
  elsif expected_revision is not null then
    return jsonb_build_object('kind', 'conflict', 'draft', null);
  end if;
  if not exists (select 1 from rush.rush_cycles c where c.id = submit_application_v2.cycle_id
    and c.status = 'OPEN' and (c.opens_at is null or c.opens_at <= now())
    and (c.closes_at is null or c.closes_at >= now())) then
    raise exception 'applications are not open' using errcode = '55000';
  end if;
  result := rush.submit_application_reliable(applicant_name, applicant_contact, preferred_name,
    phone, class_year, major, linkedin_url, resume_storage_path, answers, consent,
    uniqname, college, grad_term, accessibility_notes);
  if not exists (select 1 from rush.applications a where a.id = result->>'applicationId'
    and a.cycle_id = submit_application_v2.cycle_id) then
    raise exception 'application cycle changed' using errcode = '55000';
  end if;
  return result;
end;
$$;
revoke all on function rush.submit_application_v2(uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text) from public, anon;
grant execute on function rush.submit_application_v2(uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,text,text,text) to authenticated, service_role;

-- The guarded synthetic workflow must exercise the preconditioned writers too.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('rush.submit_application_self_test(text,text)'::regprocedure) into definition;
  definition := replace(definition, 'application_id := rush.save_application_draft(jsonb_build_object(', 'result := rush.save_application_draft_v2(jsonb_build_object(');
  definition := replace(definition, E'''answers'', ''{}''::jsonb\n  ));', E'''answers'', ''{}''::jsonb\n  ), null, gen_random_uuid(), cycle_id);\n  select a.id into application_id from rush.applications a join rush.pnms p on p.id = a.pnm_id where p.auth_user_id = actor and a.draft_revision = (result->>''revision'')::uuid;');
  definition := replace(definition, E'result := rush.submit_application(\n', E'result := rush.submit_application_v2(\n    (select a.draft_revision from rush.applications a where a.id = application_id), cycle_id,\n');
  if position('rush.save_application_draft(' in definition) > 0 or position('rush.submit_application(' in definition) > 0 then
    raise exception 'workflow fixture revision patch failed';
  end if;
  execute definition;
end;
$migration$;
