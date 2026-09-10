-- The Clerk cutover (2026-09-03) minted a second app user for applicants who
-- had already started an application under the old Supabase-auth identity.
-- rush.actor_id() resolves the new identity, which owns no rush.pnms row, so
-- save_application_draft refused every autosave with 'contact belongs to
-- another account' (23505) and begin_resume_upload / begin_headshot_upload
-- refused every upload with 'save the application before uploading' (55000).
-- Applicants saw only "we could not start the resume upload" and could not
-- recover by any action available to them.
--
-- Two parts: adopt the stranded rows now, and stop the function from creating
-- new strandings. The upload RPCs need no change -- they all key off the pnm
-- row this function is responsible for creating.

-- Part 1: hand each orphaned pnm to the Clerk account for the same verified
-- address. Guarded three ways: the old owner has no live Clerk identity (so no
-- reachable account loses its application), the new owner has no pnm of its own
-- (pnms.auth_user_id is UNIQUE), and the address matches exactly. Verified
-- before writing: ten rows, exactly one candidate each.
update rush.pnms p
   set auth_user_id = current_owner.id,
       updated_at = now()
  from rush.profiles legacy, rush.profiles current_owner
 where p.auth_user_id = legacy.id
   and current_owner.id <> legacy.id
   and current_owner.active
   and lower(current_owner.primary_email) = p.normalized_contact
   and exists (
     select 1 from rush.auth_identities i
     where i.app_user_id = current_owner.id
       and i.issuer = 'https://clerk.mecgmichigan.com'
       and i.disabled_at is null
   )
   and not exists (
     select 1 from rush.auth_identities i
     where i.app_user_id = legacy.id
       and i.issuer = 'https://clerk.mecgmichigan.com'
       and i.disabled_at is null
   )
   and not exists (
     select 1 from rush.pnms other where other.auth_user_id = current_owner.id
   );

-- Part 2: identical to the deployed function except for the adoption block
-- below the draft validation.
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
