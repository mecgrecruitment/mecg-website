alter table rush.pnms
  add column if not exists preferred_name text check (preferred_name is null or char_length(trim(preferred_name)) between 1 and 80),
  add column if not exists phone text check (phone is null or char_length(trim(phone)) between 7 and 32),
  add column if not exists class_year text check (class_year is null or class_year in ('FIRST_YEAR','SOPHOMORE','JUNIOR','SENIOR','GRADUATE')),
  add column if not exists major text check (major is null or char_length(trim(major)) between 1 and 120),
  add column if not exists linkedin_url text check (linkedin_url is null or char_length(trim(linkedin_url)) between 8 and 400);

alter table rush.applications
  add column if not exists resume_storage_path text check (
    resume_storage_path is null
    or resume_storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.pdf$'
  );

create table if not exists rush.application_questions (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  prompt text not null check (char_length(trim(prompt)) between 1 and 2000),
  input_type text not null default 'long_text' check (input_type in ('short_text','long_text','url','select')),
  required boolean not null default true,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  unique (cycle_id, key)
);

create table if not exists rush.application_responses (
  id text primary key default gen_random_uuid()::text,
  application_id text not null references rush.applications (id) on delete cascade,
  question_key text not null,
  question_text text not null,
  response_text text not null check (char_length(trim(response_text)) between 1 and 8000),
  created_at timestamptz not null default now(),
  unique (application_id, question_key)
);

alter table rush.application_questions enable row level security;
alter table rush.application_questions force row level security;
alter table rush.application_responses enable row level security;
alter table rush.application_responses force row level security;

create policy questions_read_authenticated on rush.application_questions for select to authenticated
using (
  rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  or exists (select 1 from rush.rush_cycles c where c.id = application_questions.cycle_id and c.status = 'OPEN')
);

create policy responses_read_owner_or_board on rush.application_responses for select to authenticated
using (exists (
  select 1 from rush.applications a
  where a.id = application_responses.application_id
    and (
      rush.owns_application(a.id)
      or rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[])
    )
    and not exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = a.id and c.declarer_id = auth.uid()
        and rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[])
    )
));

grant select on rush.application_questions, rush.application_responses to authenticated;
grant all on rush.application_questions, rush.application_responses to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_resumes_applicant_insert on storage.objects;
drop policy if exists storage_resumes_applicant_update on storage.objects;
drop policy if exists storage_resumes_applicant_select on storage.objects;
drop policy if exists storage_resumes_board_select_rush on storage.objects;

create policy storage_resumes_applicant_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.pdf$'
);

create policy storage_resumes_applicant_update on storage.objects for update to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_resumes_applicant_select on storage.objects for select to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_resumes_board_select_rush on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1 from rush.applications a
    where a.resume_storage_path = storage.objects.name
      and rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[])
      and not exists (
        select 1 from rush.conflict_declarations c
        where c.application_id = a.id and c.declarer_id = auth.uid()
      )
  )
);

create or replace function rush.seed_cycle_questions(target_cycle_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into rush.application_questions (cycle_id, key, prompt, input_type, required, sort_order)
  values
    (target_cycle_id, 'why_mecg', 'Why do you want to join MECG this cycle?', 'long_text', true, 0),
    (target_cycle_id, 'problem_example', 'Describe a messy problem you helped structure. What did you do, and what changed?', 'long_text', true, 1)
  on conflict (cycle_id, key) do nothing;
end;
$$;

create or replace function rush.create_cycle(cycle_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_id text;
  speed_round_id text;
  case_round_id text;
  speed_rubric_id text;
  case_rubric_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(cycle_name)) not between 1 and 120 then
    raise exception 'invalid cycle name' using errcode = '22023';
  end if;
  if exists (select 1 from rush.rush_cycles where lower(name) = lower(trim(cycle_name))) then
    raise exception 'cycle exists' using errcode = '23505';
  end if;
  if exists (select 1 from rush.rush_cycles) and not exists (
    select 1 from rush.memberships where user_id = actor and active and role = 'OWNER'
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from rush.rush_cycles) and not exists (
    select 1 from public.members where user_id = actor and deleted_at is null and role = 'board'
  ) then raise exception 'only an existing board member can initialize rush' using errcode = '42501'; end if;

  insert into rush.rush_cycles (name) values (trim(cycle_name)) returning id into cycle_id;
  insert into rush.memberships (user_id, cycle_id, role) values (actor, cycle_id, 'OWNER');

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'SPEED_DATING', 'Speed Dating', 40) returning id into speed_round_id;
  insert into rush.rubrics (round_id, version) values (speed_round_id, 1) returning id into speed_rubric_id;
  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (speed_rubric_id, 'communication', 'Clear communication and concision', 'Answers clearly, concisely, and adapts to the listener.', 25, true, 0),
    (speed_rubric_id, 'listening', 'Listening and question quality', 'Listens, follows up, and builds on the conversation.', 20, false, 1),
    (speed_rubric_id, 'reasoning', 'Structured reasoning', 'States assumptions and works through tradeoffs.', 20, false, 2),
    (speed_rubric_id, 'coachability', 'Collaboration and coachability', 'Receives feedback respectfully and incorporates it.', 20, false, 3),
    (speed_rubric_id, 'judgment', 'Judgment and integrity', 'Separates facts from assumptions and acknowledges limits.', 15, false, 4);

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'GROUP_CASE', 'Group Case', 60) returning id into case_round_id;
  insert into rush.rubrics (round_id, version) values (case_round_id, 1) returning id into case_rubric_id;
  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (case_rubric_id, 'framing', 'Problem framing and assumptions', 'Clarifies the objective, ambiguity, and assumptions.', 20, false, 0),
    (case_rubric_id, 'analysis', 'Analysis and evidence', 'Uses evidence and tests assumptions.', 20, false, 1),
    (case_rubric_id, 'collaboration', 'Collaboration and inclusion', 'Invites contributions and resolves disagreement constructively.', 25, true, 2),
    (case_rubric_id, 'communication', 'Communication and listening', 'Synthesizes clearly and keeps the group aligned.', 15, false, 3),
    (case_rubric_id, 'ownership', 'Ownership and reliability', 'Follows through without taking over.', 10, false, 4),
    (case_rubric_id, 'recommendation', 'Recommendation and judgment', 'Prioritizes actions, limitations, and next steps.', 10, false, 5);

  perform rush.seed_cycle_questions(cycle_id);
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, cycle_id, 'CYCLE_CREATED', 'RushCycle', cycle_id);
  return cycle_id;
end;
$$;

insert into rush.application_questions (cycle_id, key, prompt, input_type, required, sort_order)
select c.id, q.key, q.prompt, 'long_text', true, q.sort_order
from rush.rush_cycles c
cross join (values
  ('why_mecg', 'Why do you want to join MECG this cycle?', 0),
  ('problem_example', 'Describe a messy problem you helped structure. What did you do, and what changed?', 1)
) as q(key, prompt, sort_order)
on conflict (cycle_id, key) do nothing;

create or replace function rush.intake_schema()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_row rush.rush_cycles%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if cycle_row.id is null then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function rush.create_resume_upload()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_cycle_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select id into v_cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;
  return actor::text || '/' || v_cycle_id || '/' || gen_random_uuid()::text || '.pdf';
end;
$$;

drop function if exists rush.submit_application(text, text);

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
  if resume_storage_path is not null and (
    resume_storage_path !~ ('^' || actor::text || '/[A-Za-z0-9_-]+/[0-9a-f-]{36}\.pdf$')
  ) then
    raise exception 'invalid resume path' using errcode = '22023';
  end if;

  select id into v_cycle_id from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;
  if v_cycle_id is null then raise exception 'applications are not open' using errcode = '55000'; end if;

  if resume_storage_path is not null and resume_storage_path not like (actor::text || '/' || v_cycle_id || '/%') then
    raise exception 'invalid resume path' using errcode = '22023';
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
    update rush.pnms set
      name = trim(applicant_name),
      contact = trim(applicant_contact),
      normalized_contact = normalized,
      preferred_name = coalesce(nullif(trim(preferred_name), ''), preferred_name),
      phone = coalesce(nullif(trim(phone), ''), phone),
      class_year = coalesce(class_year, rush.pnms.class_year),
      major = coalesce(nullif(trim(major), ''), major),
      linkedin_url = coalesce(nullif(trim(linkedin_url), ''), linkedin_url)
    where id = person_id;
  end if;

  select a.id, a.status into application_id, existing_status
  from rush.applications a where a.pnm_id = person_id and a.cycle_id = v_cycle_id for update;
  if application_id is not null and existing_status not in ('DRAFT','NEEDS_INFO') then
    return application_id;
  end if;

  if application_id is null then
    insert into rush.applications (pnm_id, cycle_id, status, submitted_at, resume_storage_path)
    values (person_id, v_cycle_id, 'SUBMITTED', now(), resume_storage_path)
    returning id into application_id;
  else
    update rush.applications
    set status = 'SUBMITTED', submitted_at = now(), resume_storage_path = coalesce(rush.submit_application.resume_storage_path, rush.applications.resume_storage_path)
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

drop function if exists rush.applicant_dashboard();

create function rush.applicant_dashboard()
returns table(
  application_id text,
  applicant_name text,
  cycle_name text,
  display_status text,
  released_outcome rush.decision_outcome,
  released_at timestamptz,
  has_resume boolean,
  responses jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, p.name, c.name,
    case when d.id is not null then d.outcome::text when a.status in ('OFFERED','WAITLISTED','REJECTED') then 'FINAL_REVIEW' else a.status::text end,
    d.outcome, d.released_at,
    a.resume_storage_path is not null,
    coalesce((
      select jsonb_agg(jsonb_build_object('key', r.question_key, 'prompt', r.question_text, 'answer', r.response_text) order by r.created_at)
      from rush.application_responses r where r.application_id = a.id
    ), '[]'::jsonb)
  from rush.pnms p
  join rush.applications a on a.pnm_id = p.id
  join rush.rush_cycles c on c.id = a.cycle_id
  left join lateral (
    select x.id, x.outcome, x.released_at
    from rush.decisions x
    where x.application_id = a.id and x.status = 'RELEASED'
    order by x.released_at desc limit 1
  ) d on true
  where p.auth_user_id = auth.uid()
  order by a.created_at desc;
$$;

create or replace function rush.set_application_status(target_application_id text, next_status rush.application_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_row rush.applications%rowtype;
begin
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from rush.conflict_declarations c where c.application_id = app_row.id and c.declarer_id = auth.uid()) then
    raise exception 'conflict recusal' using errcode = '42501';
  end if;
  if next_status in ('OFFERED','WAITLISTED','REJECTED') then
    raise exception 'outcomes must be released through Hash' using errcode = '55000';
  end if;
  update rush.applications set status = next_status where id = target_application_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), app_row.cycle_id, 'APPLICATION_STATUS_CHANGED', 'Application', target_application_id,
    jsonb_build_object('from', app_row.status, 'to', next_status));
end;
$$;

revoke all on function rush.seed_cycle_questions(text), rush.intake_schema(), rush.create_resume_upload(),
  rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean),
  rush.applicant_dashboard(), rush.set_application_status(text, rush.application_status)
from public, anon;
grant execute on function rush.seed_cycle_questions(text), rush.intake_schema(), rush.create_resume_upload(),
  rush.submit_application(text,text,text,text,text,text,text,text,jsonb,boolean),
  rush.applicant_dashboard(), rush.set_application_status(text, rush.application_status)
to authenticated, service_role;
