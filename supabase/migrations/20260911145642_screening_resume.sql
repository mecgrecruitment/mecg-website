-- Blind screening reviewers may view the applicant's resume through their own
-- assignment. The path is only released for a live, published assignment the
-- actor holds, and every view is audited against the assignment, not the
-- application, so the reviewer never learns the application id.
create or replace function rush.authorize_screening_resume(target_assignment_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  v_application_id text;
  v_cycle_id text;
  v_path text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select p.application_id, b.cycle_id
  into v_application_id, v_cycle_id
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  join rush.screening_reviewers sr on sr.batch_id = b.id and sr.reviewer_id = a.reviewer_id and sr.active
  where a.id = target_assignment_id
    and a.reviewer_id = actor
    and b.status = 'PUBLISHED'
    and a.status = 'ASSIGNED'
    and rush.is_eligible_screening_reviewer(b.cycle_id, actor);
  if v_application_id is null then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  select resume_storage_path into v_path
  from rush.applications
  where id = v_application_id;
  if v_path is null then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from rush.application_documents d
    where d.object_path = v_path
      and d.application_id = v_application_id
      and d.status = 'ATTACHED'
  ) then
    raise exception 'resume not found' using errcode = 'P0002';
  end if;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, v_cycle_id, 'SCREENING_RESUME_VIEWED', 'ScreeningAssignment', target_assignment_id);
  return v_path;
end;
$$;

revoke all on function rush.authorize_screening_resume(text) from public, anon;
grant execute on function rush.authorize_screening_resume(text) to authenticated, service_role;

-- Criteria now carry their key so the reviewer UI can group the resume
-- criteria apart from the written-response ones, and the detail reports
-- whether a resume is attached so the UI knows whether to offer the link.
create or replace function rush.screening_assignment_detail(target_assignment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  result jsonb;
begin
  select jsonb_build_object(
    'assignmentId', a.id,
    'candidateCode', p.candidate_code,
    'status', a.status,
    'content', p.content,
    'hasResume', exists (
      select 1
      from rush.applications app
      join rush.application_documents d on d.application_id = app.id and d.object_path = app.resume_storage_path and d.status = 'ATTACHED'
      where app.id = p.application_id
    ),
    'criteria', (
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'key', c.key,
        'name', c.name,
        'description', c.description,
        'weight', c.weight,
        'required', c.required
      ) order by c.position)
      from rush.rubric_criteria c where c.rubric_id = b.rubric_id
    ),
    'progress', jsonb_build_object(
      'completed', (select count(*) from rush.screening_assignments own where own.reviewer_id = actor and own.status in ('SUBMITTED', 'LOCKED') and own.packet_id in (select packet.id from rush.screening_packets packet where packet.batch_id = b.id)),
      'total', (select count(*) from rush.screening_assignments own where own.reviewer_id = actor and own.status <> 'RECUSED' and own.packet_id in (select packet.id from rush.screening_packets packet where packet.batch_id = b.id)),
      'deadline', r.closes_at,
      'publishedAt', b.published_at
    )
  ) into result
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  join rush.rubrics rubric on rubric.id = b.rubric_id
  join rush.rounds r on r.id = rubric.round_id
  join rush.screening_reviewers sr on sr.batch_id = b.id and sr.reviewer_id = a.reviewer_id and sr.active
  where a.id = target_assignment_id
    and a.reviewer_id = actor
    and b.status = 'PUBLISHED'
    and a.status = 'ASSIGNED'
    and rush.is_eligible_screening_reviewer(b.cycle_id, actor);
  if result is null then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

revoke all on function rush.screening_assignment_detail(text) from public, anon;
grant execute on function rush.screening_assignment_detail(text) to authenticated, service_role;

-- Existing unfrozen screening rubrics gain the four resume criteria after
-- their current last position. Frozen rubrics already back scored reviews
-- and stay as they are.
insert into rush.rubric_criteria(rubric_id, key, name, description, weight, required, position)
select
  rb.id,
  v.key,
  v.name,
  v.description,
  v.weight,
  v.required,
  coalesce((select max(c.position) from rush.rubric_criteria c where c.rubric_id = rb.id), -1) + v.ord
from rush.rubrics rb
join rush.rounds r on r.id = rb.round_id and r.kind = 'APPLICATION_SCREEN'
cross join (
  values
    (1, 'resume_technical', 'Technical & Analytical Skills', 'Relevant coursework, tools, and quantitative or analytical depth shown on the resume.', 30, true),
    (2, 'resume_projects', 'Project Experience & Impact', 'Concrete projects or roles with a stated outcome, scope, or result.', 30, true),
    (3, 'resume_leadership', 'Leadership & Community', 'Leads, organises, or contributes beyond individual work; sustained involvement.', 20, true),
    (4, 'resume_communication', 'Communication & Professionalism', 'Clear, well-organised, error-free resume that communicates priorities.', 20, true)
) as v(ord, key, name, description, weight, required)
where rb.frozen_at is null
  and not exists (
    select 1 from rush.rubric_criteria c
    where c.rubric_id = rb.id and c.key = 'resume_technical'
  );

-- New screening rubrics seed the resume criteria alongside the written ones.
create or replace function rush.create_screening_batch(target_cycle_id text, reviewer_ids uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  v_round_id text;
  v_rubric_id text;
  v_batch_id text;
  reviewer uuid;
  distinct_reviewer_count integer;
begin
  if actor is null or not rush.has_cycle_capability(target_cycle_id, 'SCREENING_ADMINISTRATION') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from rush.rush_cycles
    where id = target_cycle_id and status in ('OPEN', 'IN_PROCESS')
  ) then
    raise exception 'cycle unavailable' using errcode = '55000';
  end if;

  select count(distinct candidate)
  into distinct_reviewer_count
  from unnest(coalesce(reviewer_ids, array[]::uuid[])) as candidates(candidate);
  if distinct_reviewer_count < 3 or distinct_reviewer_count <> coalesce(array_length(reviewer_ids, 1), 0) then
    raise exception 'at least three distinct eligible reviewers are required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(reviewer_ids) as candidates(candidate)
    where not rush.is_eligible_screening_reviewer(target_cycle_id, candidate)
  ) then
    raise exception 'reviewers must be active Recruitment Committee, Board, or Owner members; Panel members are excluded' using errcode = '42501';
  end if;

  insert into rush.rounds(cycle_id, kind, name, status, weight)
  values (target_cycle_id, 'APPLICATION_SCREEN', 'Blind application screening', 'PUBLISHED', 0)
  on conflict(cycle_id, kind) do update set name = excluded.name
  returning id into v_round_id;

  select id into v_rubric_id
  from rush.rubrics
  where round_id = v_round_id
  order by version desc
  limit 1;
  if v_rubric_id is null then
    insert into rush.rubrics(round_id, version)
    values (v_round_id, 1)
    returning id into v_rubric_id;
    insert into rush.rubric_criteria(rubric_id, key, name, description, weight, required, position)
    values
      (v_rubric_id, 'motivation', 'MECG motivation', 'Explains why MECG specifically and connects that interest to concrete work.', 20, true, 0),
      (v_rubric_id, 'problem_structuring', 'Problem structuring', 'Separates a messy problem into workable parts and states relevant constraints.', 25, true, 1),
      (v_rubric_id, 'ownership', 'Evidence and ownership', 'Describes personal actions and the resulting change without relying on prestige signals.', 20, true, 2),
      (v_rubric_id, 'reflection', 'Reflection and judgment', 'Acknowledges uncertainty, tradeoffs, mistakes, or lessons.', 20, true, 3),
      (v_rubric_id, 'communication', 'Clear communication', 'Communicates directly and understandably without rewarding ornamental writing.', 15, true, 4),
      (v_rubric_id, 'resume_technical', 'Technical & Analytical Skills', 'Relevant coursework, tools, and quantitative or analytical depth shown on the resume.', 30, true, 5),
      (v_rubric_id, 'resume_projects', 'Project Experience & Impact', 'Concrete projects or roles with a stated outcome, scope, or result.', 30, true, 6),
      (v_rubric_id, 'resume_leadership', 'Leadership & Community', 'Leads, organises, or contributes beyond individual work; sustained involvement.', 20, true, 7),
      (v_rubric_id, 'resume_communication', 'Communication & Professionalism', 'Clear, well-organised, error-free resume that communicates priorities.', 20, true, 8);
  end if;

  insert into rush.screening_batches(cycle_id, rubric_id, reviews_per_application, created_by)
  values (target_cycle_id, v_rubric_id, 3, actor)
  returning id into v_batch_id;
  foreach reviewer in array reviewer_ids loop
    insert into rush.screening_reviewers(batch_id, reviewer_id)
    values (v_batch_id, reviewer);
  end loop;

  insert into rush.screening_packets(batch_id, application_id, candidate_code, content, content_hash)
  select
    v_batch_id,
    a.id,
    'Applicant ' || upper(substr(encode(extensions.digest(a.id || v_batch_id, 'sha256'), 'hex'), 1, 6)),
    jsonb_build_object(
      'responses',
      coalesce((
        select jsonb_agg(jsonb_build_object('question', r.question_text, 'answer', r.response_text) order by r.created_at)
        from rush.application_responses r
        where r.application_id = a.id
      ), '[]'::jsonb)
    ),
    encode(extensions.digest(coalesce((
      select string_agg(r.question_text || E'\n' || r.response_text, E'\n' order by r.created_at)
      from rush.application_responses r
      where r.application_id = a.id
    ), ''), 'sha256'), 'hex')
  from rush.applications a
  where a.cycle_id = target_cycle_id
    and a.status not in ('DRAFT', 'WITHDRAWN');
  if not found then
    raise exception 'no submitted applications are available' using errcode = '55000';
  end if;

  insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    target_cycle_id,
    'SCREENING_BATCH_CREATED',
    'ScreeningBatch',
    v_batch_id,
    jsonb_build_object('reviewerCount', distinct_reviewer_count, 'reviewsPerApplication', 3)
  );
  return v_batch_id;
end;
$$;

revoke all on function rush.create_screening_batch(text, uuid[]) from public, anon;
grant execute on function rush.create_screening_batch(text, uuid[]) to authenticated, service_role;
