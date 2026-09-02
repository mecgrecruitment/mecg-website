-- Private screening drafts and reviewer-only workflow context. This does not
-- change distribution or the invariant of three distinct committee reviews.
create table rush.screening_review_drafts (
  assignment_id text primary key references rush.screening_assignments(id) on delete cascade,
  reviewer_id uuid not null references rush.profiles(id),
  rubric_id text not null references rush.rubrics(id),
  ratings jsonb not null,
  evidence text not null default '',
  recommendation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(ratings) = 'array'),
  check (char_length(evidence) <= 6000),
  check (recommendation in ('', 'ADVANCE', 'HOLD', 'DECLINE'))
);

create index screening_review_drafts_reviewer_updated_idx
  on rush.screening_review_drafts(reviewer_id, updated_at desc);
alter table rush.screening_review_drafts enable row level security;
alter table rush.screening_review_drafts force row level security;

create or replace function rush.screening_reviewer_context(target_cycle_id text)
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
  if actor is null or not rush.is_eligible_screening_reviewer(target_cycle_id, actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'completed', count(*) filter (where a.status in ('SUBMITTED', 'LOCKED')),
    'total', count(*) filter (where a.status <> 'RECUSED'),
    'deadline', max(r.closes_at),
    'publishedAt', max(b.published_at)
  ) into result
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  join rush.rubrics rubric on rubric.id = b.rubric_id
  join rush.rounds r on r.id = rubric.round_id
  join rush.screening_reviewers sr on sr.batch_id = b.id and sr.reviewer_id = actor and sr.active
  where b.cycle_id = target_cycle_id and b.status = 'PUBLISHED' and a.reviewer_id = actor;
  return coalesce(result, jsonb_build_object('completed', 0, 'total', 0, 'deadline', null, 'publishedAt', null));
end;
$$;

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
    'criteria', (
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
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

create or replace function rush.get_screening_review_draft(target_assignment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  draft rush.screening_review_drafts%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select d.* into draft
  from rush.screening_review_drafts d
  join rush.screening_assignments a on a.id = d.assignment_id
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  join rush.screening_reviewers sr on sr.batch_id = b.id and sr.reviewer_id = actor and sr.active
  where d.assignment_id = target_assignment_id
    and d.reviewer_id = actor
    and a.reviewer_id = actor
    and a.status = 'ASSIGNED'
    and b.status = 'PUBLISHED'
    and d.rubric_id = b.rubric_id
    and rush.is_eligible_screening_reviewer(b.cycle_id, actor);
  if draft.assignment_id is null then return null; end if;
  return jsonb_build_object(
    'ratings', draft.ratings,
    'evidence', draft.evidence,
    'recommendation', draft.recommendation,
    'updatedAt', draft.updated_at
  );
end;
$$;

create or replace function rush.save_screening_review_draft(
  target_assignment_id text,
  draft_ratings jsonb,
  draft_evidence text,
  draft_recommendation text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_rubric_id text;
  target_cycle_id text;
  expected integer;
  saved_at timestamptz;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if draft_ratings is null
     or jsonb_typeof(draft_ratings) <> 'array'
     or jsonb_array_length(draft_ratings) = 0
     or jsonb_array_length(draft_ratings) > 50
     or octet_length(draft_ratings::text) > 65536
     or char_length(coalesce(draft_evidence, '')) > 6000
     or coalesce(draft_recommendation, '') not in ('', 'ADVANCE', 'HOLD', 'DECLINE') then
    raise exception 'invalid screening draft' using errcode = '22023';
  end if;

  select b.rubric_id, b.cycle_id into target_rubric_id, target_cycle_id
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  join rush.screening_reviewers sr on sr.batch_id = b.id and sr.reviewer_id = actor and sr.active
  where a.id = target_assignment_id
    and a.reviewer_id = actor
    and a.status = 'ASSIGNED'
    and b.status = 'PUBLISHED'
  for update of a;
  if target_rubric_id is null or not rush.is_eligible_screening_reviewer(target_cycle_id, actor) then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  select count(*) into expected from rush.rubric_criteria c where c.rubric_id = target_rubric_id;
  if jsonb_array_length(draft_ratings) <> expected
     or (select count(distinct x->>'criterionId') from jsonb_array_elements(draft_ratings) x) <> expected
     or exists (
       select 1 from jsonb_array_elements(draft_ratings) x
       where jsonb_typeof(x) <> 'object'
          or not (x ? 'criterionId' and x ? 'score' and x ? 'note')
          or jsonb_typeof(x->'criterionId') <> 'string'
          or jsonb_typeof(x->'score') <> 'string'
          or jsonb_typeof(x->'note') <> 'string'
          or x->>'score' not in ('', '1', '2', '3', '4', '5')
          or char_length(x->>'note') > 2000
          or not exists (
            select 1 from rush.rubric_criteria c
            where c.rubric_id = target_rubric_id and c.id = x->>'criterionId'
          )
     ) then raise exception 'invalid screening draft ratings' using errcode = '22023'; end if;

  insert into rush.screening_review_drafts(assignment_id, reviewer_id, rubric_id, ratings, evidence, recommendation)
  values (target_assignment_id, actor, target_rubric_id, draft_ratings, coalesce(draft_evidence, ''), coalesce(draft_recommendation, ''))
  on conflict (assignment_id) do update
    set reviewer_id = excluded.reviewer_id,
        rubric_id = excluded.rubric_id,
        ratings = excluded.ratings,
        evidence = excluded.evidence,
        recommendation = excluded.recommendation,
        updated_at = now()
  returning updated_at into saved_at;
  return saved_at;
end;
$$;

create or replace function rush.next_screening_assignment(target_assignment_id text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  batch_id text;
  next_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select p.batch_id into batch_id
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  where a.id = target_assignment_id and a.reviewer_id = actor;
  if batch_id is null then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  select a.id into next_id
  from rush.screening_assignments a
  join rush.screening_packets p on p.id = a.packet_id
  join rush.screening_batches b on b.id = p.batch_id
  where p.batch_id = batch_id
    and a.reviewer_id = actor
    and a.status = 'ASSIGNED'
    and b.status = 'PUBLISHED'
    and rush.is_eligible_screening_reviewer(b.cycle_id, actor)
  order by p.candidate_code
  limit 1;
  return next_id;
end;
$$;

create or replace function rush.clear_screening_review_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from rush.screening_review_drafts where assignment_id = new.assignment_id;
  return new;
end;
$$;

create trigger screening_reviews_clear_draft
after insert on rush.screening_reviews
for each row execute function rush.clear_screening_review_draft();

create or replace function rush.clear_inactive_screening_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'ASSIGNED' then
    delete from rush.screening_review_drafts where assignment_id = new.id;
  end if;
  return new;
end;
$$;

create trigger screening_assignments_clear_inactive_draft
after update of status on rush.screening_assignments
for each row execute function rush.clear_inactive_screening_draft();

revoke all on table rush.screening_review_drafts from public, anon, authenticated;
revoke all on function rush.screening_reviewer_context(text), rush.get_screening_review_draft(text), rush.save_screening_review_draft(text,jsonb,text,text), rush.next_screening_assignment(text) from public, anon;
revoke all on function rush.clear_screening_review_draft(), rush.clear_inactive_screening_draft() from public, anon, authenticated;
grant execute on function rush.screening_reviewer_context(text), rush.get_screening_review_draft(text), rush.save_screening_review_draft(text,jsonb,text,text), rush.next_screening_assignment(text) to authenticated, service_role;
