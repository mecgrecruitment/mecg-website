-- Launch hardening for the Fall 2026 applicant portal.
--
-- Three defects, all confirmed against the linked project rather than inferred
-- from the migration text:
--
--   1. rush.seed_cycle_questions(text) is SECURITY DEFINER with no caller check
--      and EXECUTE for `authenticated`. Any signed-in user -- including a fresh
--      signup whose actor_id() is still null -- could rewrite the live cycle's
--      question prompts, input types, required flags and word limits. The cycle
--      id needed to aim it is handed out by the anon-callable
--      rush.public_recruitment(). It is only ever called from other definer
--      functions (create_cycle, clone_cycle, the Fall 2026 bootstrap), which
--      run as the owner, so removing the grant costs nothing.
--
--   2. rush.check_rate_limit(text) and rush.prune_rate_limits() were revoked
--      from `public` but never from `authenticated`, and
--      20260821090000_rush_foundation.sql's ALTER DEFAULT PRIVILEGES had
--      already granted EXECUTE to `authenticated` at creation. The bucket key
--      is caller-supplied and the counter increments unconditionally, so one
--      signed-in applicant could burn the shared apply-ip bucket for a whole
--      venue and 429 everybody else. The comment in src/lib/rate-limit.ts
--      claiming EXECUTE is service_role-only was simply wrong.
--
--   3. rush.submit_application's resume-path guard depended on null
--      propagation; see the comment at the guard itself.
--
-- Every other SECURITY DEFINER function on the applicant and board paths was
-- checked and derives authorization from rush.actor_id(), has_cycle_role() or
-- has_cycle_capability(). These three were the exceptions.

revoke execute on function rush.seed_cycle_questions(text) from authenticated;
revoke execute on function rush.check_rate_limit(text) from authenticated;
revoke execute on function rush.prune_rate_limits() from authenticated;

create or replace function rush.submit_application(
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor uuid := rush.actor_id();
  normalized text := lower(trim(applicant_contact));
  v_cycle_id text;
  open_cycle_id text;
  person_id text;
  application_id text;
  existing_status rush.application_status;
  existing_resume_path text;
  question_row rush.application_questions%rowtype;
  answer_text text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('submit:'||actor::text,0));
  if consent is not true then raise exception 'consent is required' using errcode = '22023'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then
    raise exception 'invalid applicant details' using errcode = '22023';
  end if;
  if preferred_name is not null and char_length(trim(preferred_name)) not between 1 and 80 then raise exception 'invalid preferred name' using errcode='22023'; end if;
  if phone is not null and char_length(trim(phone)) not between 7 and 32 then raise exception 'invalid phone' using errcode='22023'; end if;
  if class_year is null or class_year not in ('FIRST_YEAR','SOPHOMORE','JUNIOR','SENIOR','GRADUATE') then raise exception 'invalid class year' using errcode='22023'; end if;
  if major is null or char_length(trim(major)) not between 1 and 120 then raise exception 'invalid major' using errcode='22023'; end if;
  if uniqname is null or lower(trim(uniqname)) !~ '^[a-z][a-z0-9]{1,15}$' then raise exception 'invalid uniqname' using errcode='22023'; end if;
  if college is null or college not in ('Engineering','LSA','Ross','Information','Stamps','Kinesiology','Nursing','Public Policy','Other') then raise exception 'invalid college' using errcode='22023'; end if;
  if grad_term is not null and char_length(trim(grad_term)) not between 1 and 40 then raise exception 'invalid graduation term' using errcode='22023'; end if;
  if accessibility_notes is not null and char_length(accessibility_notes) > 2000 then raise exception 'invalid accessibility notes' using errcode='22023'; end if;
  if linkedin_url is not null and (char_length(trim(linkedin_url)) not between 8 and 400 or trim(linkedin_url) !~* '^https?://[^[:space:]]+$') then raise exception 'invalid linkedin url' using errcode='22023'; end if;
  if jsonb_typeof(answers) <> 'object' or (select count(*) from jsonb_object_keys(answers)) > 50 then raise exception 'invalid answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each(answers) x where char_length(x.key) > 80 or x.key !~ '^[a-z][a-z0-9_]*$' or jsonb_typeof(x.value) <> 'string') then raise exception 'invalid answers' using errcode='22023'; end if;
  if exists (select 1 from jsonb_each_text(answers) x where char_length(x.value) > 8000)
    or (select coalesce(sum(char_length(x.value)), 0) from jsonb_each_text(answers) x) > 40000 then
    raise exception 'answers too long' using errcode='22023';
  end if;
  if resume_storage_path is null or resume_storage_path !~ ('^' || actor::text || '/[A-Za-z0-9_-]+/(resume|[0-9a-f-]{36})\.pdf$') then raise exception 'invalid resume path' using errcode='22023'; end if;
  v_cycle_id := split_part(resume_storage_path,'/',2);

  select p.id into person_id from rush.pnms p where p.auth_user_id=actor for update;
  if person_id is not null then
    select a.id,a.status,a.resume_storage_path into application_id,existing_status,existing_resume_path from rush.applications a
    where a.pnm_id=person_id and a.cycle_id=v_cycle_id for update;
    if application_id is not null and existing_status not in ('DRAFT','NEEDS_INFO') then
      if resume_storage_path = actor::text || '/' || v_cycle_id || '/resume.pdf'
        or resume_storage_path = existing_resume_path then
        return jsonb_build_object('applicationId',application_id,'submittedNow',false);
      end if;
      raise exception 'invalid resume path' using errcode='22023';
    end if;
  end if;

  select c.id into open_cycle_id from rush.rush_cycles c
  where c.status = 'OPEN' and (c.opens_at is null or c.opens_at <= now()) and (c.closes_at is null or c.closes_at >= now())
  order by c.created_at desc limit 1;
  if open_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  -- The old guard accepted a UUID-named resume only when it already equalled
  -- applications.resume_storage_path. On a first submission that column is
  -- null, so the comparison was null, the whole conjunction was null, and the
  -- IF fell through: the happy path worked by three-valued logic rather than by
  -- intent. Anyone whose row already carried a path -- a NEEDS_INFO
  -- resubmission, or an applicant who used the /applicant replace flow -- then
  -- uploaded a replacement, the fresh path no longer equalled the stored one,
  -- and submit raised 'invalid resume path' with no way out from the UI.
  --
  -- Authorize the path the way the storage policies and the
  -- applications_require_ready_resume trigger already do: the caller must own a
  -- live resume document at exactly that path in the open cycle. Ownership is
  -- derived from actor_id(), never trusted from the argument, and the partial
  -- unique indexes cap the caller at one READY plus one ATTACHED document per
  -- cycle, so this admits their own current resume and nothing else.
  if v_cycle_id <> open_cycle_id then raise exception 'invalid resume path' using errcode='22023'; end if;
  if resume_storage_path <> (actor::text || '/' || open_cycle_id || '/resume.pdf')
    and not exists (
      select 1 from rush.application_documents d
      where d.object_path = resume_storage_path
        and d.owner_user_id = actor
        and d.cycle_id = open_cycle_id
        and d.kind = 'RESUME'
        and d.status in ('READY','ATTACHED')
    ) then raise exception 'invalid resume path' using errcode='22023'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id='resumes' and o.name=resume_storage_path) then raise exception 'resume upload is required' using errcode='22023'; end if;
  if exists (select 1 from jsonb_object_keys(answers) as answer_key(key) where not exists (select 1 from rush.application_questions q where q.cycle_id=v_cycle_id and q.key=answer_key.key)) then raise exception 'unknown application answer' using errcode='22023'; end if;

  for question_row in select * from rush.application_questions q where q.cycle_id=v_cycle_id order by q.sort_order loop
    answer_text := nullif(trim(answers ->> question_row.key), '');
    if question_row.required and answer_text is null then raise exception 'missing answer for %', question_row.key using errcode='22023'; end if;
    if answer_text is not null and char_length(answer_text) > 8000 then raise exception 'answer too long' using errcode='22023'; end if;
    if question_row.input_type='select' and answer_text is not null and (
      jsonb_typeof(question_row.options)<>'array' or not exists (
        select 1 from jsonb_array_elements(question_row.options) configured(value)
        where jsonb_typeof(configured.value)='string' and configured.value #>> '{}' = answer_text
      )
    ) then raise exception 'invalid selection for %',question_row.key using errcode='22023'; end if;
    if question_row.input_type='url' and answer_text is not null and answer_text !~* '^https?://[^/?#[:space:]]+([/?#][^[:space:]]*)?$' then
      raise exception 'invalid url for %',question_row.key using errcode='22023';
    end if;
  end loop;

  if person_id is null then
    if exists (select 1 from rush.pnms p where p.normalized_contact=normalized and p.auth_user_id is distinct from actor) then raise exception 'contact belongs to another account' using errcode='23505'; end if;
    insert into rush.pnms (auth_user_id,name,contact,normalized_contact,preferred_name,phone,class_year,major,linkedin_url,uniqname,college,grad_term,accessibility_notes)
    values (actor,trim(applicant_name),trim(applicant_contact),normalized,nullif(trim(preferred_name),''),nullif(trim(phone),''),class_year,trim(major),nullif(trim(linkedin_url),''),lower(trim(uniqname)),college,nullif(trim(grad_term),''),nullif(trim(accessibility_notes),''))
    returning id into person_id;
  else
    update rush.pnms p set
      name=trim(applicant_name), contact=trim(applicant_contact), normalized_contact=normalized,
      preferred_name=coalesce(nullif(trim(submit_application.preferred_name),''),p.preferred_name),
      phone=coalesce(nullif(trim(submit_application.phone),''),p.phone), class_year=coalesce(submit_application.class_year,p.class_year),
      major=trim(submit_application.major), linkedin_url=coalesce(nullif(trim(submit_application.linkedin_url),''),p.linkedin_url),
      uniqname=lower(trim(submit_application.uniqname)), college=coalesce(submit_application.college,p.college),
      grad_term=coalesce(nullif(trim(submit_application.grad_term),''),p.grad_term),
      accessibility_notes=coalesce(nullif(trim(submit_application.accessibility_notes),''),p.accessibility_notes)
    where p.id=person_id;
  end if;
  if application_id is null then
    insert into rush.applications (pnm_id,cycle_id,status,submitted_at,resume_storage_path,draft_payload)
    values (person_id,v_cycle_id,'SUBMITTED',now(),resume_storage_path,null) returning id into application_id;
  else
    update rush.applications a set status='SUBMITTED',submitted_at=now(),resume_storage_path=submit_application.resume_storage_path,draft_payload=null
    where a.id=application_id;
  end if;
  delete from rush.application_responses r where r.application_id=application_id;
  insert into rush.application_responses (application_id,question_key,question_text,response_text)
  select application_id,q.key,q.prompt,trim(answers ->> q.key) from rush.application_questions q
  where q.cycle_id=v_cycle_id and nullif(trim(answers ->> q.key),'') is not null;
  insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id)
  values (actor,v_cycle_id,'APPLICATION_SUBMITTED','Application',application_id);
  return jsonb_build_object('applicationId',application_id,'submittedNow',true);
end;
$$;

-- rush.submit_interest is granted to anon on purpose: the public interest form
-- posts it through the visitor's own session. That means a direct
-- POST /rest/v1/rpc/submit_interest bypasses the only throttle, which lives in
-- src/app/api/interest/route.ts, and the upsert's `do update set name` lets an
-- anonymous caller rewrite the stored name for any address already signed up.
-- Bound it per address so abusing one record costs the default bucket (5 per
-- 300s) while a person correcting their own typo is unaffected. Keyed by email
-- rather than globally on purpose: a global bucket would let one caller lock
-- the real form for everyone.
create or replace function rush.submit_interest(
  full_name text,
  email text,
  uniqname text default null,
  class_year text default null,
  how_heard text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_cycle_id text; result_id text; normalized_email text;
begin
  if char_length(trim(full_name)) not between 1 and 120 or char_length(trim(email)) not between 3 and 254 then
    raise exception 'invalid interest details' using errcode='22023';
  end if;
  normalized_email := lower(trim(submit_interest.email));
  if not rush.check_rate_limit('interest-signup:' || normalized_email) then
    raise exception 'too many requests' using errcode='53400';
  end if;
  select id into v_cycle_id from rush.rush_cycles where status in ('DRAFT','OPEN','IN_PROCESS') order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'recruitment is not open' using errcode='55000'; end if;
  insert into rush.interest_signups as signup (cycle_id, name, email, uniqname, class_year, how_heard)
  values (
    v_cycle_id,
    trim(full_name),
    normalized_email,
    nullif(lower(trim(submit_interest.uniqname)),''),
    submit_interest.class_year,
    nullif(trim(submit_interest.how_heard),'')
  )
  on conflict on constraint interest_signups_cycle_id_email_key do update set name = excluded.name
  returning signup.id into result_id;
  return result_id;
end; $$;
