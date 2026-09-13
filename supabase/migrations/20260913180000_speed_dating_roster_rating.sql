-- Speed Dating is two-minute rotations now: applicants move past every member
-- table in pairs, and every member present grades every applicant they meet.
-- Groups, table numbers and a submit-all step were ceremony for a night that
-- moves too fast for them. A member sees one list of everyone enrolled, taps a
-- star, optionally types a note, and it saves on the spot. The rating stays
-- editable until the Board freezes the round. No score requires a note; a
-- two-minute meeting rarely leaves time for one. Session 1 or 2 tags each
-- rating and lives on the evaluation itself. The calibration page is no
-- longer a gate: the anchors show inline and the first save records the
-- acknowledgement, so the evaluations trigger still sees one.
--
-- The group functions from 20260913160000 stay in place until the UI has
-- fully moved off them; nothing here drops a table.
alter table rush.evaluations
  add column if not exists session integer null check (session between 1 and 4);

-- Ratings submitted through groups carried their session on the pair claim.
-- Copy it onto the evaluation once so the Board's read needs no pair lookup.
update rush.evaluations evaluation
set session = claimed.session
from rush.evaluation_assignments assignment
join lateral (
  select pair.session
  from rush.speed_dating_pair_members member
  join rush.speed_dating_pairs pair on pair.id = member.pair_id and pair.round_id = assignment.round_id
  join rush.speed_dating_pair_claims claim
    on claim.pair_id = pair.id
   and claim.evaluator_id = assignment.evaluator_id
   and claim.submitted_at is not null
  where member.application_id = assignment.application_id
  order by claim.submitted_at desc
  limit 1
) claimed on true
where assignment.id = evaluation.assignment_id
  and evaluation.session is null;

-- One tap, one saved rating. Creates the member's assignment and evaluation
-- on the first save and rewrites the same rows on every later one; a frozen
-- round refuses before anything is touched.
create or replace function rush.rate_speed_dating_applicant(
  target_round_id text,
  target_application_id text,
  target_session integer,
  score integer,
  note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  active_criterion_id text;
  assignment_row rush.evaluation_assignments%rowtype;
  evaluation_row rush.evaluations%rowtype;
  clean_score integer := score;
  clean_note text := nullif(trim(note), '');
  saved_at timestamptz := now();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id for share;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'not a Speed Dating round' using errcode = '55000';
  end if;
  if round_row.status <> 'ACTIVE' then
    raise exception 'round is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    where participation.round_id = target_round_id
      and participation.application_id = target_application_id
      and application.cycle_id = round_row.cycle_id
  ) then
    raise exception 'applicant is not in this round' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.conflict_declarations conflict
    where conflict.declarer_id = actor and conflict.application_id = target_application_id
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;
  if target_session is null or target_session not between 1 and 4 then
    raise exception 'session must be between 1 and 4' using errcode = '22023';
  end if;
  if clean_score is null or clean_score not between 1 and 5 then
    raise exception 'score must be 1 to 5' using errcode = '22023';
  end if;
  if char_length(clean_note) > 2000 then
    raise exception 'note must be 2000 characters or fewer' using errcode = '22023';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;
  select criterion.id into active_criterion_id
  from rush.rubric_criteria criterion
  where criterion.rubric_id = active_rubric_id
    and criterion.required
    and criterion.weight = 100
    and (select count(*) from rush.rubric_criteria where rubric_id = active_rubric_id) = 1;
  if active_criterion_id is null then
    raise exception 'Speed Dating rubric is not ready' using errcode = '55000';
  end if;

  -- Saving a rating is the acknowledgement; the evaluations trigger insists on one.
  insert into rush.round_calibration_acknowledgements (round_id, rubric_id, evaluator_id)
  values (target_round_id, active_rubric_id, actor)
  on conflict (round_id, rubric_id, evaluator_id) do nothing;

  insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
  values (target_round_id, target_application_id, actor)
  on conflict (round_id, application_id, evaluator_id) do nothing;
  select * into assignment_row
  from rush.evaluation_assignments assignment
  where assignment.round_id = target_round_id
    and assignment.application_id = target_application_id
    and assignment.evaluator_id = actor
  for update;
  if assignment_row.status = 'LOCKED' then
    raise exception 'round is frozen' using errcode = '55000';
  end if;

  select * into evaluation_row
  from rush.evaluations evaluation
  where evaluation.assignment_id = assignment_row.id
    and evaluation.voided_at is null
  order by evaluation.version desc
  limit 1
  for update;
  if evaluation_row.id is null then
    insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, version, status, submitted_at, session)
    values (
      assignment_row.id,
      actor,
      active_rubric_id,
      (select coalesce(max(version), 0) + 1 from rush.evaluations where assignment_id = assignment_row.id),
      'SUBMITTED',
      saved_at,
      target_session
    )
    returning * into evaluation_row;
  elsif evaluation_row.status in ('DRAFT', 'SUBMITTED') then
    update rush.evaluations evaluation
    set session = target_session,
        status = 'SUBMITTED',
        submitted_at = coalesce(evaluation.submitted_at, saved_at),
        updated_at = saved_at
    where evaluation.id = evaluation_row.id
    returning * into evaluation_row;
  else
    raise exception 'round is frozen' using errcode = '55000';
  end if;

  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  values (evaluation_row.id, active_criterion_id, clean_score, clean_note)
  on conflict (evaluation_id, criterion_id) do update
    set score = excluded.score, note = excluded.note;

  update rush.evaluation_assignments
  set status = 'SUBMITTED'
  where id = assignment_row.id and status <> 'SUBMITTED';

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'SPEED_DATING_RATED', 'Application', target_application_id,
          jsonb_build_object('roundId', target_round_id, 'session', target_session,
                             'score', clean_score, 'hasNote', clean_note is not null));

  return jsonb_build_object(
    'applicationId', target_application_id,
    'score', clean_score,
    'note', coalesce(clean_note, ''),
    'session', target_session,
    'savedAt', evaluation_row.updated_at
  );
end;
$$;

-- The member's list for the night: everyone enrolled, with the member's own
-- current rating on each. Names only; the page is used on a phone in a room
-- full of people.
create or replace function rush.my_speed_dating_roster(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  active_criterion_id text;
  applicant_items jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'not a Speed Dating round' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;
  select criterion.id into active_criterion_id
  from rush.rubric_criteria criterion
  where criterion.rubric_id = active_rubric_id
  order by criterion.position
  limit 1;

  applicant_items := coalesce((
    select jsonb_agg(jsonb_build_object(
      'applicationId', application.id,
      'name', pnm.name,
      'score', mine.score,
      'note', coalesce(mine.note, ''),
      'session', mine.session,
      'savedAt', mine.saved_at
    ) order by pnm.name, application.id)
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    join rush.pnms pnm on pnm.id = application.pnm_id
    left join lateral (
      select rating.score, rating.note, evaluation.session, evaluation.updated_at saved_at
      from rush.evaluation_assignments assignment
      join lateral (
        select candidate.id, candidate.session, candidate.updated_at
        from rush.evaluations candidate
        where candidate.assignment_id = assignment.id
          and candidate.voided_at is null
          and candidate.status in ('SUBMITTED', 'LOCKED')
        order by candidate.version desc
        limit 1
      ) evaluation on true
      join rush.criterion_ratings rating
        on rating.evaluation_id = evaluation.id
       and rating.criterion_id = active_criterion_id
      where assignment.round_id = target_round_id
        and assignment.application_id = application.id
        and assignment.evaluator_id = actor
    ) mine on true
    where participation.round_id = target_round_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
      and not exists (
        select 1 from rush.conflict_declarations conflict
        where conflict.application_id = application.id and conflict.declarer_id = actor
      )
  ), '[]'::jsonb);

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'criterion', (
      select jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'description', criterion.description
      )
      from rush.rubric_criteria criterion
      where criterion.id = active_criterion_id
    ),
    'rubricReady', active_rubric_id is not null and (
      select count(*) = 1
        and max(criterion.weight) = 100
        and bool_and(criterion.required)
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
    ),
    'progress', jsonb_build_object(
      'scored', (
        select count(*) from jsonb_array_elements(applicant_items) item
        where item->'score' <> 'null'::jsonb
      ),
      'total', jsonb_array_length(applicant_items)
    ),
    'applicants', applicant_items
  );
end;
$$;

-- The Board's read of the night, without tables. A score is the evaluator's
-- latest submitted evaluation on the applicant; its session is on the row.
create or replace function rush.speed_dating_results(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'not a Speed Dating round' using errcode = '55000';
  end if;

  with scored as (
    select
      participation.application_id,
      assignment.evaluator_id,
      profile.display_name evaluator_name,
      evaluation.submitted_at,
      evaluation.session,
      rating.score,
      rating.note
    from rush.round_participations participation
    join rush.evaluation_assignments assignment
      on assignment.round_id = participation.round_id
     and assignment.application_id = participation.application_id
    join rush.profiles profile on profile.id = assignment.evaluator_id
    join lateral (
      select evaluation.id, evaluation.submitted_at, evaluation.session
      from rush.evaluations evaluation
      where evaluation.assignment_id = assignment.id
        and evaluation.voided_at is null
        and evaluation.status in ('SUBMITTED', 'LOCKED')
      order by evaluation.version desc
      limit 1
    ) evaluation on true
    join lateral (
      select rating.score, rating.note
      from rush.criterion_ratings rating
      join rush.rubric_criteria criterion on criterion.id = rating.criterion_id
      where rating.evaluation_id = evaluation.id
      order by criterion.position
      limit 1
    ) rating on true
    where participation.round_id = target_round_id
      and rating.score is not null
  ),
  applicant as (
    select application.id, pnm.name, application.status::text status
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    join rush.pnms pnm on pnm.id = application.pnm_id
    where participation.round_id = target_round_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
  )
  select jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', applicant.id,
        'name', applicant.name,
        'status', applicant.status,
        'mean', stats.mean,
        'count', stats.grader_count,
        'stddev', stats.stddev,
        'scores', coalesce((
          select jsonb_agg(jsonb_build_object(
            'evaluatorName', s.evaluator_name,
            'evaluatorId', s.evaluator_id,
            'session', s.session,
            'score', s.score,
            'note', coalesce(s.note, ''),
            'submittedAt', s.submitted_at
          ) order by s.session, s.evaluator_name)
          from scored s
          where s.application_id = applicant.id
        ), '[]'::jsonb)
      ) order by stats.mean desc nulls last, applicant.name, applicant.id)
      from applicant
      cross join lateral (
        select
          round(avg(s.score), 2) mean,
          count(*)::integer grader_count,
          case when count(*) >= 2 then round(stddev_pop(s.score), 2) end stddev
        from scored s
        where s.application_id = applicant.id
      ) stats
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function rush.rate_speed_dating_applicant(text, text, integer, integer, text) from public, anon;
revoke all on function rush.my_speed_dating_roster(text) from public, anon;
revoke all on function rush.speed_dating_results(text) from public, anon;
grant execute on function rush.rate_speed_dating_applicant(text, text, integer, integer, text) to authenticated, service_role;
grant execute on function rush.my_speed_dating_roster(text) to authenticated, service_role;
grant execute on function rush.speed_dating_results(text) to authenticated, service_role;
