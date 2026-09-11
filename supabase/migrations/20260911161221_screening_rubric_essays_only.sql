-- Board decided the resume is context, not a score: applicants are not
-- disqualified on their resume, and the essays are what the club grades.
-- The resume stays in the packet for readers to see. The rubric becomes
-- essays only, MECG motivation weighs the most, and a creativity and
-- personality criterion covers the "expert in something unrelated" answer.
--
-- Data change for every unfrozen APPLICATION_SCREEN rubric with no ratings
-- against it (a frozen rubric backs scored reviews and must not move).
with target as (
  select rb.id
  from rush.rubrics rb
  join rush.rounds r on r.id = rb.round_id and r.kind = 'APPLICATION_SCREEN'
  where rb.frozen_at is null
    and not exists (
      select 1 from rush.screening_ratings sr
      join rush.rubric_criteria c on c.id = sr.criterion_id
      where c.rubric_id = rb.id
    )
)
delete from rush.rubric_criteria c
using target t
where c.rubric_id = t.id and c.key like 'resume\_%';

with target as (
  select rb.id
  from rush.rubrics rb
  join rush.rounds r on r.id = rb.round_id and r.kind = 'APPLICATION_SCREEN'
  where rb.frozen_at is null
),
weights(key, weight) as (
  values ('motivation', 30), ('problem_structuring', 20), ('ownership', 15), ('reflection', 15), ('communication', 10)
)
update rush.rubric_criteria c
set weight = w.weight
from target t
join weights w on true
where c.rubric_id = t.id and c.key = w.key;

insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position)
select rb.id, 'creativity', 'Creativity and personality',
  'Original thinking and a distinct voice, especially in the answer about becoming an expert in something unrelated.',
  10, true, coalesce((select max(c.position) from rush.rubric_criteria c where c.rubric_id = rb.id), -1) + 1
from rush.rubrics rb
join rush.rounds r on r.id = rb.round_id and r.kind = 'APPLICATION_SCREEN'
where rb.frozen_at is null
  and not exists (select 1 from rush.rubric_criteria c where c.rubric_id = rb.id and c.key = 'creativity');

-- Seed for future cycles matches.
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
      (v_rubric_id, 'motivation', 'MECG motivation', 'Explains why MECG specifically and connects that interest to concrete work.', 30, true, 0),
      (v_rubric_id, 'problem_structuring', 'Problem structuring', 'Separates a messy problem into workable parts and states relevant constraints.', 20, true, 1),
      (v_rubric_id, 'ownership', 'Evidence and ownership', 'Describes personal actions and the resulting change without relying on prestige signals.', 15, true, 2),
      (v_rubric_id, 'reflection', 'Reflection and judgment', 'Acknowledges uncertainty, tradeoffs, mistakes, or lessons.', 15, true, 3),
      (v_rubric_id, 'communication', 'Clear communication', 'Communicates directly and understandably without rewarding ornamental writing.', 10, true, 4),
      (v_rubric_id, 'creativity', 'Creativity and personality', 'Original thinking and a distinct voice, especially in the answer about becoming an expert in something unrelated.', 10, true, 5);
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
