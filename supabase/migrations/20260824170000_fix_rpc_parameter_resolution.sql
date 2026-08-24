create or replace function rush.submit_application(
  applicant_name text,
  applicant_contact text,
  preferred_name text default null,
  phone text default null,
  class_year text default null,
  major text default null,
  linkedin_url text default null,
  resume_storage_path text default null,
  answers jsonb default '[]'::jsonb,
  consent boolean default true
)
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
  existing_status rush.application_status;
  question_row rush.application_questions%rowtype;
  answer_text text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if consent is not true then raise exception 'consent is required' using errcode = '22023'; end if;
  if char_length(trim(applicant_name)) not between 1 and 120 or char_length(normalized) not between 3 and 254 then
    raise exception 'invalid applicant details' using errcode = '22023';
  end if;
  if class_year is not null and class_year not in ('FIRST_YEAR','SOPHOMORE','JUNIOR','SENIOR','GRADUATE') then
    raise exception 'invalid class year' using errcode = '22023';
  end if;
  if resume_storage_path is not null and resume_storage_path !~ ('^' || actor::text || '/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.pdf$') then
    raise exception 'invalid resume path' using errcode = '22023';
  end if;

  select id into v_cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  if resume_storage_path is not null and resume_storage_path not like (actor::text || '/' || v_cycle_id || '/%') then
    raise exception 'invalid resume path' using errcode = '22023';
  end if;
  if resume_storage_path is null or not exists (
    select 1 from storage.objects where bucket_id = 'resumes' and name = resume_storage_path
  ) then
    raise exception 'resume upload is required' using errcode = '22023';
  end if;

  for question_row in
    select * from rush.application_questions where cycle_id = v_cycle_id order by sort_order
  loop
    answer_text := nullif(trim(answers ->> question_row.key), '');
    if question_row.required and answer_text is null then
      raise exception 'missing answer for %', question_row.key using errcode = '22023';
    end if;
    if answer_text is not null and char_length(answer_text) > 8000 then
      raise exception 'answer too long' using errcode = '22023';
    end if;
  end loop;

  select id into person_id from rush.pnms where auth_user_id = actor for update;
  if person_id is null then
    if exists (select 1 from rush.pnms where normalized_contact = normalized and auth_user_id is distinct from actor) then
      raise exception 'contact belongs to another account' using errcode = '23505';
    end if;
    insert into rush.pnms (auth_user_id, name, contact, normalized_contact, preferred_name, phone, class_year, major, linkedin_url)
    values (
      actor, trim(applicant_name), trim(applicant_contact), normalized,
      nullif(trim(preferred_name), ''), nullif(trim(phone), ''), class_year,
      nullif(trim(major), ''), nullif(trim(linkedin_url), '')
    ) returning id into person_id;
  else
    update rush.pnms as p set
      name = trim(applicant_name),
      contact = trim(applicant_contact),
      normalized_contact = normalized,
      preferred_name = coalesce(nullif(trim(submit_application.preferred_name), ''), p.preferred_name),
      phone = coalesce(nullif(trim(submit_application.phone), ''), p.phone),
      class_year = coalesce(submit_application.class_year, p.class_year),
      major = coalesce(nullif(trim(submit_application.major), ''), p.major),
      linkedin_url = coalesce(nullif(trim(submit_application.linkedin_url), ''), p.linkedin_url)
    where p.id = person_id;
  end if;

  select a.id, a.status into application_id, existing_status
  from rush.applications a where a.pnm_id = person_id and a.cycle_id = v_cycle_id for update;
  if application_id is not null and existing_status not in ('DRAFT','NEEDS_INFO') then return application_id; end if;

  if application_id is null then
    insert into rush.applications (pnm_id, cycle_id, status, submitted_at, resume_storage_path)
    values (person_id, v_cycle_id, 'SUBMITTED', now(), resume_storage_path)
    returning id into application_id;
  else
    update rush.applications
    set status = 'SUBMITTED', submitted_at = now(), resume_storage_path = coalesce(submit_application.resume_storage_path, rush.applications.resume_storage_path)
    where id = application_id;
  end if;

  delete from rush.application_responses r where r.application_id = application_id;
  insert into rush.application_responses (application_id, question_key, question_text, response_text)
  select application_id, q.key, q.prompt, trim(answers ->> q.key)
  from rush.application_questions q
  where q.cycle_id = v_cycle_id and nullif(trim(answers ->> q.key), '') is not null;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, v_cycle_id, 'APPLICATION_SUBMITTED', 'Application', application_id);
  return application_id;
end;
$$;

create or replace function rush.submit_interest(
  full_name text,
  email text,
  uniqname text default null,
  class_year text default null,
  how_heard text default null
)
returns text language plpgsql security definer set search_path='' as $$
declare v_cycle_id text; result_id text;
begin
  if char_length(trim(full_name)) not between 1 and 120 or char_length(trim(email)) not between 3 and 254 then
    raise exception 'invalid interest details' using errcode='22023';
  end if;
  select id into v_cycle_id from rush.rush_cycles where status in ('DRAFT','OPEN','IN_PROCESS') order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'recruitment is not open' using errcode='55000'; end if;
  insert into rush.interest_signups as signup (cycle_id, name, email, uniqname, class_year, how_heard)
  values (
    v_cycle_id,
    trim(full_name),
    lower(trim(submit_interest.email)),
    nullif(lower(trim(submit_interest.uniqname)),''),
    submit_interest.class_year,
    nullif(trim(submit_interest.how_heard),'')
  )
  on conflict on constraint interest_signups_cycle_id_email_key do update set name = excluded.name
  returning signup.id into result_id;
  return result_id;
end; $$;

create or replace function rush.set_applicant_profile(
  uniqname text default null,
  college text default null,
  grad_term text default null,
  accessibility_notes text default null
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode='42501'; end if;
  update rush.pnms as p set
    uniqname = coalesce(nullif(lower(trim(set_applicant_profile.uniqname)),''), p.uniqname),
    college = coalesce(nullif(trim(set_applicant_profile.college),''), p.college),
    grad_term = coalesce(nullif(trim(set_applicant_profile.grad_term),''), p.grad_term),
    accessibility_notes = coalesce(nullif(trim(set_applicant_profile.accessibility_notes),''), p.accessibility_notes)
  where p.auth_user_id = auth.uid();
end; $$;

create or replace function rush.verify_full_workflow(owner_id uuid, panel_id uuid, applicant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_cycle_id text; round_id text; rubric_id text; criterion_id text; application_id text;
  owner_assignment text; panel_assignment text; decision_id text; event_result jsonb; token text;
  ratings jsonb; approval_result record; already_checked boolean; applicant_view record;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if not exists(select 1 from rush.profiles where id=owner_id) or not exists(select 1 from rush.profiles where id=panel_id) or not exists(select 1 from rush.profiles where id=applicant_id) then raise exception 'test profiles missing'; end if;
  insert into rush.rush_cycles(name,status) values('SELF TEST '||gen_random_uuid(),'OPEN') returning id into v_cycle_id;
  insert into rush.memberships(user_id,cycle_id,role) values(owner_id,v_cycle_id,'OWNER'),(panel_id,v_cycle_id,'PANEL');
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  application_id := rush.submit_application('Workflow Applicant'::text,('workflow-'||applicant_id||'@example.invalid')::text);
  update rush.rush_cycles set status='IN_PROCESS' where id=v_cycle_id;
  insert into rush.rounds(cycle_id,kind,name,status,weight) values(v_cycle_id,'SELF_TEST','Self Test','PUBLISHED',100) returning id into round_id;
  insert into rush.rubrics(round_id,version) values(round_id,1) returning id into rubric_id;
  insert into rush.rubric_criteria(rubric_id,key,name,description,weight,required,position) values(rubric_id,'criterion','Criterion','Test criterion',100,true,0) returning id into criterion_id;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  owner_assignment := rush.assign_evaluator(v_cycle_id,round_id,application_id,owner_id);
  panel_assignment := rush.assign_evaluator(v_cycle_id,round_id,application_id,panel_id);
  perform rush.set_round_status(round_id,'ACTIVE');
  ratings := jsonb_build_array(jsonb_build_object('criterionId',criterion_id,'score',4,'note','Observed evidence'));
  perform * from rush.submit_evaluation(owner_assignment,ratings,'Owner evidence');
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform * from rush.submit_evaluation(panel_assignment,ratings,'Panel evidence');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform rush.set_round_status(round_id,'FROZEN');
  perform rush.set_cycle_status(v_cycle_id,'DECISION_LOCK');
  decision_id := rush.create_decision(v_cycle_id,application_id,'OFFER','Self-test decision');
  select * into approval_result from rush.approve_decision(decision_id);
  if approval_result.locked then raise exception 'first approval locked decision'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  select * into approval_result from rush.approve_decision(decision_id);
  if not approval_result.locked or approval_result.approvals <> 2 then raise exception 'two-person approval failed'; end if;
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  select * into applicant_view from rush.applicant_dashboard();
  if applicant_view.released_outcome is not null or applicant_view.display_status <> 'FINAL_REVIEW' then raise exception 'unreleased outcome leaked'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform rush.release_decision(decision_id);
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  select * into applicant_view from rush.applicant_dashboard();
  if applicant_view.released_outcome <> 'OFFER' then raise exception 'released outcome unavailable'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  event_result := rush.create_event(v_cycle_id,'Self Test Event',now(),now()-interval '1 minute',now()+interval '1 minute');
  token := event_result->>'checkinToken';
  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated')::text,true);
  already_checked := rush.check_in(token);
  if already_checked then raise exception 'first check-in reported duplicate'; end if;
  if not rush.check_in(token) then raise exception 'duplicate check-in was not idempotent'; end if;
  perform set_config('request.jwt.claim.sub',panel_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',panel_id,'role','authenticated')::text,true);
  perform rush.declare_conflict(application_id,'Self-test conflict after release');
  if not exists(select 1 from rush.audit_events ae where ae.cycle_id=v_cycle_id and ae.action='CONFLICT_DECLARED_AFTER_RELEASE') then raise exception 'post-release conflict audit missing'; end if;
  raise exception 'WORKFLOW_SELF_TEST_PASSED' using errcode='P0001';
end; $$;
