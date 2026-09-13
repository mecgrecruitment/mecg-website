-- Speed Dating groups are formed off-app. On the night an evaluator searches
-- the two or three applicants at their table, starts a group, scores everyone
-- in it, and submits once. The pair tables stay as the group record (who sat
-- together, who graded); the Board no longer builds or publishes them. A group
-- may hold three applicants, and several evaluators at one table may each
-- start their own group for the same applicants in the same session, so the
-- per-session uniqueness on membership goes.
alter table rush.speed_dating_pair_members
  drop constraint if exists speed_dating_pair_members_position_check;
alter table rush.speed_dating_pair_members
  add constraint speed_dating_pair_members_position_check check (position between 1 and 3);
alter table rush.speed_dating_pair_members
  drop constraint if exists speed_dating_pair_members_round_id_session_application_id_key;
create index if not exists speed_dating_pair_members_round_application_idx
  on rush.speed_dating_pair_members(round_id, application_id);

drop function if exists rush.replace_speed_dating_pairs(text, jsonb, boolean);
drop function if exists rush.claim_speed_dating_pair(text);
drop function if exists rush.report_wrong_speed_dating_pair(text);
drop table if exists rush.speed_dating_pair_reports;

-- Starting a group is the old claim plus the old Board pair insert in one
-- transaction: the group row, its members, the actor's claim, and the
-- evaluator's assignments. The round lock serialises the label counter.
create or replace function rush.start_speed_dating_group(
  target_round_id text,
  target_application_ids text[],
  target_session integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  scored_name text;
  group_number integer;
  new_pair_id text;
  new_label text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id for update;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'round is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_session is null or target_session not between 1 and 4 then
    raise exception 'session must be between 1 and 4' using errcode = '22023';
  end if;
  if target_application_ids is null
     or coalesce(array_length(target_application_ids, 1), 0) not between 2 and 3
     or (
       select count(distinct item.application_id)
       from unnest(target_application_ids) item(application_id)
       where nullif(trim(item.application_id), '') is not null
     ) <> array_length(target_application_ids, 1) then
    raise exception 'a group needs two or three different applicants' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(target_application_ids) item(application_id)
    where not exists (
      select 1
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      where participation.round_id = target_round_id
        and participation.application_id = item.application_id
        and application.cycle_id = round_row.cycle_id
    )
  ) then
    raise exception 'every applicant must be advanced into this round' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.conflict_declarations conflict
    where conflict.declarer_id = actor
      and conflict.application_id = any(target_application_ids)
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;

  select pnm.name into scored_name
  from rush.evaluation_assignments assignment
  join rush.applications application on application.id = assignment.application_id
  join rush.pnms pnm on pnm.id = application.pnm_id
  where assignment.round_id = target_round_id
    and assignment.evaluator_id = actor
    and assignment.application_id = any(target_application_ids)
    and (
      assignment.status in ('SUBMITTED', 'LOCKED')
      or exists (
        select 1 from rush.evaluations evaluation
        where evaluation.assignment_id = assignment.id
          and evaluation.status in ('SUBMITTED', 'LOCKED')
      )
    )
  order by pnm.name
  limit 1;
  if scored_name is not null then
    raise exception 'You already scored %. Start a group without them.', scored_name using errcode = '55000';
  end if;

  if not exists (
    select 1
    from rush.rubrics rubric
    join rush.round_calibration_acknowledgements acknowledgement
      on acknowledgement.round_id = target_round_id
     and acknowledgement.rubric_id = rubric.id
     and acknowledgement.evaluator_id = actor
    where rubric.id = (select id from rush.rubrics where round_id = target_round_id order by version desc limit 1)
  ) then raise exception 'calibration required' using errcode = '55000'; end if;

  -- Discarded groups leave gaps, so the next number follows the highest
  -- label rather than the row count; (round_id, label) is unique.
  select coalesce(max(substring(pair.label from '^Group (\d+)$')::integer), 0) + 1 into group_number
  from rush.speed_dating_pairs pair
  where pair.round_id = target_round_id;
  new_label := 'Group ' || lpad(group_number::text, greatest(2, length(group_number::text)), '0');

  insert into rush.speed_dating_pairs (round_id, session, label, status, created_by, published_at)
  values (target_round_id, target_session, new_label, 'PUBLISHED', actor, now())
  returning id into new_pair_id;

  insert into rush.speed_dating_pair_members (pair_id, round_id, session, application_id, position)
  select new_pair_id, target_round_id, target_session, item.application_id, item.ordinality::smallint
  from unnest(target_application_ids) with ordinality item(application_id, ordinality);

  insert into rush.speed_dating_pair_claims (pair_id, evaluator_id)
  values (new_pair_id, actor);

  insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
  select target_round_id, item.application_id, actor
  from unnest(target_application_ids) item(application_id)
  on conflict (round_id, application_id, evaluator_id) do nothing;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'SPEED_DATING_GROUP_STARTED', 'SpeedDatingPair', new_pair_id,
          jsonb_build_object('applicationIds', to_jsonb(target_application_ids), 'session', target_session));

  return jsonb_build_object('pairId', new_pair_id, 'label', new_label);
end;
$$;

-- A wrong table is fixed by throwing the group away before anything is
-- submitted. Assignments stay: they are the evaluator's own drafts.
create or replace function rush.discard_speed_dating_group(target_pair_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id for update;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  if pair_row.created_by <> actor then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (
    select 1 from rush.speed_dating_pair_claims claim
    where claim.pair_id = pair_row.id and claim.submitted_at is not null
  ) then raise exception 'submitted groups cannot be discarded' using errcode = '55000'; end if;

  delete from rush.speed_dating_pairs where id = pair_row.id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  select actor, round.cycle_id, 'SPEED_DATING_GROUP_DISCARDED', 'SpeedDatingPair', pair_row.id
  from rush.rounds round
  where round.id = pair_row.round_id;

  return jsonb_build_object('pairId', pair_row.id, 'discarded', true);
end;
$$;

-- The member queue lists only the actor's own groups plus every participant
-- they may still grade, so the grading page can search names before a group
-- exists. Conflicted applicants are omitted rather than shown disabled.
create or replace function rush.my_speed_dating_pairs(target_round_id text)
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
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'calibrated', active_rubric_id is not null and exists (
      select 1 from rush.round_calibration_acknowledgements acknowledgement
      where acknowledgement.round_id = target_round_id
        and acknowledgement.rubric_id = active_rubric_id
        and acknowledgement.evaluator_id = actor
    ),
    'criterion', (
      select jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'description', criterion.description
      )
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
      order by criterion.position
      limit 1
    ),
    'rubricReady', active_rubric_id is not null and (
      select count(*) = 1
        and max(criterion.weight) = 100
        and bool_and(criterion.required)
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
    ),
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', application.id,
        'name', pnm.name,
        'scored', exists (
          select 1 from rush.evaluation_assignments assignment
          where assignment.round_id = target_round_id
            and assignment.application_id = application.id
            and assignment.evaluator_id = actor
            and (
              assignment.status in ('SUBMITTED', 'LOCKED')
              or exists (
                select 1 from rush.evaluations evaluation
                where evaluation.assignment_id = assignment.id
                  and evaluation.status in ('SUBMITTED', 'LOCKED')
              )
            )
        )
      ) order by pnm.name, application.id)
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      where participation.round_id = target_round_id
        and not exists (
          select 1 from rush.conflict_declarations conflict
          where conflict.application_id = application.id and conflict.declarer_id = actor
        )
    ), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'session', pair.session,
        'claimed', true,
        'submittedAt', claim.submitted_at,
        'members', members.items
      ) order by
        case when claim.submitted_at is null then 0 else 1 end,
        pair.session,
        pair.label
      )
      from rush.speed_dating_pairs pair
      join rush.speed_dating_pair_claims claim
        on claim.pair_id = pair.id and claim.evaluator_id = actor
      cross join lateral (
        select jsonb_agg(jsonb_build_object(
          'applicationId', member.application_id,
          'name', pnm.name,
          'position', member.position,
          'assignmentId', assignment.id,
          'assignmentStatus', assignment.status::text
        ) order by member.position) as items
        from rush.speed_dating_pair_members member
        join rush.applications application on application.id = member.application_id
        join rush.pnms pnm on pnm.id = application.pnm_id
        left join rush.evaluation_assignments assignment
          on assignment.round_id = member.round_id
         and assignment.application_id = member.application_id
         and assignment.evaluator_id = actor
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
        and pair.status = 'PUBLISHED'
        and not exists (
          select 1
          from rush.speed_dating_pair_members member
          join rush.conflict_declarations conflict
            on conflict.application_id = member.application_id and conflict.declarer_id = actor
          where member.pair_id = pair.id
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- Same submit as before; the group may hold two or three applicants and the
-- submission must cover all of them.
create or replace function rush.submit_speed_dating_pair(target_pair_id text, submitted_members jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
  round_row rush.rounds%rowtype;
  criterion_row rush.rubric_criteria%rowtype;
  entry jsonb;
  assignment_id text;
  submitted_ids jsonb := '[]'::jsonb;
  submission record;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_members) <> 'array'
     or jsonb_array_length(submitted_members) not between 2 and 3
     or (select count(distinct item->>'applicationId') from jsonb_array_elements(submitted_members) item)
        <> jsonb_array_length(submitted_members) then
    raise exception 'submit every applicant in the group' using errcode = '22023';
  end if;

  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id for update;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  if jsonb_array_length(submitted_members) <> (
    select count(*) from rush.speed_dating_pair_members member where member.pair_id = target_pair_id
  ) then
    raise exception 'submit every applicant in the group' using errcode = '22023';
  end if;
  select * into round_row from rush.rounds where id = pair_row.round_id for update;
  if pair_row.status <> 'PUBLISHED'
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'pair is not open for grading' using errcode = '55000';
  end if;
  if not exists (
    select 1 from rush.speed_dating_pair_claims claim
    where claim.pair_id = target_pair_id and claim.evaluator_id = actor and claim.submitted_at is null
  ) then raise exception 'claim the pair before submitting' using errcode = '55000'; end if;
  if not exists (
    select 1
    from rush.rubrics rubric
    join rush.round_calibration_acknowledgements acknowledgement
      on acknowledgement.round_id = pair_row.round_id
     and acknowledgement.rubric_id = rubric.id
     and acknowledgement.evaluator_id = actor
    where rubric.id = (select id from rush.rubrics where round_id = pair_row.round_id order by version desc limit 1)
  ) then raise exception 'calibration required' using errcode = '55000'; end if;
  if exists (
    select 1 from rush.speed_dating_pair_members member
    join rush.conflict_declarations conflict
      on conflict.application_id = member.application_id and conflict.declarer_id = actor
    where member.pair_id = target_pair_id
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;

  select criterion.* into criterion_row
  from rush.rubrics rubric
  join rush.rubric_criteria criterion on criterion.rubric_id = rubric.id
  where rubric.round_id = pair_row.round_id
    and rubric.id = (select id from rush.rubrics where round_id = pair_row.round_id order by version desc limit 1)
  order by criterion.position
  limit 1;
  if criterion_row.id is null
     or criterion_row.weight <> 100
     or not criterion_row.required
     or (select count(*) from rush.rubric_criteria where rubric_id = criterion_row.rubric_id) <> 1 then
    raise exception 'Speed Dating needs one required 100 percent criterion' using errcode = '55000';
  end if;

  if exists (
    select 1 from jsonb_array_elements(submitted_members) item
    where jsonb_typeof(item) <> 'object'
       or not exists (
         select 1 from rush.speed_dating_pair_members member
         where member.pair_id = target_pair_id and member.application_id = item->>'applicationId'
       )
       or coalesce(item->>'score', '') !~ '^[1-5]$'
       or char_length(coalesce(item->>'note', '')) > 2000
       or ((item->>'score') in ('1', '2', '5') and trim(coalesce(item->>'note', '')) = '')
  ) then raise exception 'invalid pair ratings' using errcode = '22023'; end if;

  for entry in select value from jsonb_array_elements(submitted_members)
  loop
    select assignment.id into assignment_id
    from rush.evaluation_assignments assignment
    where assignment.round_id = pair_row.round_id
      and assignment.application_id = entry->>'applicationId'
      and assignment.evaluator_id = actor
    for update;
    if assignment_id is null then raise exception 'pair assignment missing' using errcode = '55000'; end if;

    select * into submission from rush.submit_evaluation(
      assignment_id,
      jsonb_build_array(jsonb_build_object(
        'criterionId', criterion_row.id,
        'score', (entry->>'score')::integer,
        'note', coalesce(entry->>'note', '')
      )),
      null
    );
    submitted_ids := submitted_ids || jsonb_build_array(submission.evaluation_id);
  end loop;

  update rush.speed_dating_pair_claims
  set submitted_at = now()
  where pair_id = target_pair_id and evaluator_id = actor;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'SPEED_DATING_PAIR_SUBMITTED', 'SpeedDatingPair', target_pair_id,
          jsonb_build_object('evaluationIds', submitted_ids));

  return jsonb_build_object('pairId', target_pair_id, 'submitted', true, 'evaluationIds', submitted_ids);
end;
$$;

-- Board setup shows who started each group and when it was submitted; the
-- wrong-pair report list is gone with the table.
create or replace function rush.speed_dating_pair_setup(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roundId', target_round_id,
    'roundStatus', round_row.status::text,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('applicationId', application.id, 'name', pnm.name) order by pnm.name, application.id)
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      where participation.round_id = target_round_id
    ), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'session', pair.session,
        'status', pair.status,
        'applicationIds', members.application_ids,
        'createdBy', pair.created_by,
        'evaluatorName', (select profile.display_name from rush.profiles profile where profile.id = pair.created_by),
        'submittedAt', (select max(claim.submitted_at) from rush.speed_dating_pair_claims claim where claim.pair_id = pair.id),
        'claimEvaluatorIds', coalesce((select jsonb_agg(claim.evaluator_id) from rush.speed_dating_pair_claims claim where claim.pair_id = pair.id), '[]'::jsonb)
      ) order by pair.session, pair.label)
      from rush.speed_dating_pairs pair
      cross join lateral (
        select jsonb_agg(member.application_id order by member.position) application_ids
        from rush.speed_dating_pair_members member
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function rush.start_speed_dating_group(text, text[], integer) from public, anon;
revoke all on function rush.discard_speed_dating_group(text) from public, anon;
revoke all on function rush.my_speed_dating_pairs(text) from public, anon;
revoke all on function rush.submit_speed_dating_pair(text, jsonb) from public, anon;
revoke all on function rush.speed_dating_pair_setup(text) from public, anon;
grant execute on function rush.start_speed_dating_group(text, text[], integer) to authenticated, service_role;
grant execute on function rush.discard_speed_dating_group(text) to authenticated, service_role;
grant execute on function rush.my_speed_dating_pairs(text) to authenticated, service_role;
grant execute on function rush.submit_speed_dating_pair(text, jsonb) to authenticated, service_role;
grant execute on function rush.speed_dating_pair_setup(text) to authenticated, service_role;
