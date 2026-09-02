-- Private, cross-device drafts for evaluation assignments. The table has no
-- client-facing policies; evaluators can only read and write their own draft
-- through the ownership-checking functions below.
create table rush.evaluation_drafts (
  assignment_id text primary key references rush.evaluation_assignments (id) on delete cascade,
  evaluator_id uuid not null references rush.profiles (id),
  rubric_id text not null references rush.rubrics (id),
  ratings jsonb not null,
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(ratings) = 'array'),
  check (evidence is null or char_length(evidence) <= 4000)
);

create index evaluation_drafts_evaluator_updated_idx
  on rush.evaluation_drafts (evaluator_id, updated_at desc);

alter table rush.evaluation_drafts enable row level security;
alter table rush.evaluation_drafts force row level security;

create or replace function rush.get_evaluation_draft(target_assignment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  assignment_row rush.evaluation_assignments%rowtype;
  active_rubric_id text;
  draft_row rush.evaluation_drafts%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into assignment_row
  from rush.evaluation_assignments
  where id = target_assignment_id and evaluator_id = actor;
  if assignment_row.id is null then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  if assignment_row.status not in ('ASSIGNED', 'IN_PROGRESS') then return null; end if;

  select r.id into active_rubric_id
  from rush.rubrics r
  where r.round_id = assignment_row.round_id
  order by r.version desc
  limit 1;
  if active_rubric_id is null then return null; end if;

  select * into draft_row
  from rush.evaluation_drafts d
  where d.assignment_id = target_assignment_id
    and d.evaluator_id = actor
    and d.rubric_id = active_rubric_id;

  if draft_row.assignment_id is null then return null; end if;
  return jsonb_build_object(
    'ratings', draft_row.ratings,
    'evidence', coalesce(draft_row.evidence, ''),
    'updatedAt', draft_row.updated_at
  );
end;
$$;

create or replace function rush.save_evaluation_draft(
  target_assignment_id text,
  submitted_ratings jsonb,
  submitted_evidence text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  assignment_row rush.evaluation_assignments%rowtype;
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  expected_count integer;
  saved_at timestamptz;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_ratings) <> 'array'
     or jsonb_array_length(submitted_ratings) = 0
     or jsonb_array_length(submitted_ratings) > 50
     or octet_length(submitted_ratings::text) > 65536
     or char_length(coalesce(submitted_evidence, '')) > 4000 then
    raise exception 'invalid draft' using errcode = '22023';
  end if;

  select * into assignment_row
  from rush.evaluation_assignments
  where id = target_assignment_id
  for update;
  if assignment_row.id is null or assignment_row.evaluator_id <> actor then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  select * into round_row from rush.rounds where id = assignment_row.round_id;
  if assignment_row.status not in ('ASSIGNED', 'IN_PROGRESS')
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'assignment closed' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'role revoked' using errcode = '42501';
  end if;
  if exists (
    select 1 from rush.conflict_declarations
    where application_id = assignment_row.application_id and declarer_id = actor
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;

  select r.id into active_rubric_id
  from rush.rubrics r
  where r.round_id = assignment_row.round_id
  order by r.version desc
  limit 1;
  if active_rubric_id is null then raise exception 'rubric missing' using errcode = '55000'; end if;

  select count(*) into expected_count
  from rush.rubric_criteria c
  where c.rubric_id = active_rubric_id;

  if jsonb_array_length(submitted_ratings) <> expected_count
     or (select count(distinct x->>'criterionId') from jsonb_array_elements(submitted_ratings) x) <> expected_count
     or exists (
       select 1
       from jsonb_array_elements(submitted_ratings) x
       where jsonb_typeof(x) <> 'object'
          or not (x ? 'criterionId' and x ? 'score' and x ? 'note')
          or jsonb_typeof(x->'criterionId') <> 'string'
          or jsonb_typeof(x->'score') <> 'string'
          or jsonb_typeof(x->'note') <> 'string'
          or x->>'score' not in ('', '1', '2', '3', '4', '5', 'NO')
          or char_length(x->>'note') > 2000
          or not exists (
            select 1 from rush.rubric_criteria c
            where c.rubric_id = active_rubric_id and c.id = x->>'criterionId'
          )
     ) then raise exception 'invalid draft ratings' using errcode = '22023'; end if;

  insert into rush.evaluation_drafts (assignment_id, evaluator_id, rubric_id, ratings, evidence)
  values (
    target_assignment_id,
    actor,
    active_rubric_id,
    submitted_ratings,
    nullif(submitted_evidence, '')
  )
  on conflict (assignment_id) do update
    set evaluator_id = excluded.evaluator_id,
        rubric_id = excluded.rubric_id,
        ratings = excluded.ratings,
        evidence = excluded.evidence,
        updated_at = now()
  returning updated_at into saved_at;

  return saved_at;
end;
$$;

create or replace function rush.discard_evaluation_draft(target_assignment_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (
    select 1 from rush.evaluation_assignments a
    where a.id = target_assignment_id and a.evaluator_id = actor
  ) then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  delete from rush.evaluation_drafts
  where assignment_id = target_assignment_id and evaluator_id = actor;
end;
$$;

create or replace function rush.clear_submitted_evaluation_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('SUBMITTED', 'LOCKED') then
    delete from rush.evaluation_drafts where assignment_id = new.assignment_id;
  end if;
  return new;
end;
$$;

create trigger evaluations_clear_submitted_draft
after insert or update of status on rush.evaluations
for each row execute function rush.clear_submitted_evaluation_draft();

revoke all on table rush.evaluation_drafts from public, anon, authenticated;
revoke all on function rush.get_evaluation_draft(text), rush.save_evaluation_draft(text,jsonb,text), rush.discard_evaluation_draft(text) from public, anon;
revoke all on function rush.clear_submitted_evaluation_draft() from public, anon, authenticated;
grant execute on function rush.get_evaluation_draft(text), rush.save_evaluation_draft(text,jsonb,text), rush.discard_evaluation_draft(text) to authenticated, service_role;
