-- Speed Dating now seats members in pairs or trios at numbered tables and
-- rotates every applicant group past every table. Each member present grades
-- every applicant they meet on their own, so a table is something a member
-- declares when they start a group, not something the Board assigns. The
-- Board reads the night back per applicant: mean stars, grader count, spread,
-- which tables saw them in each session, and the named notes.
alter table rush.speed_dating_pairs
  add column if not exists table_number integer null check (table_number between 1 and 99);

-- A group may hold one applicant now (a straggler routed to a spare table)
-- and carries the table the member declared. Same body otherwise. The old
-- three-argument overload goes first, or PostgREST cannot pick one.
drop function if exists rush.start_speed_dating_group(text, text[], integer);
create or replace function rush.start_speed_dating_group(
  target_round_id text,
  target_application_ids text[],
  target_session integer default 1,
  target_table integer default null
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
  if target_table is not null and target_table not between 1 and 99 then
    raise exception 'table must be between 1 and 99' using errcode = '22023';
  end if;
  if target_application_ids is null
     or coalesce(array_length(target_application_ids, 1), 0) not between 1 and 3
     or (
       select count(distinct item.application_id)
       from unnest(target_application_ids) item(application_id)
       where nullif(trim(item.application_id), '') is not null
     ) <> array_length(target_application_ids, 1) then
    raise exception 'a group needs one to three different applicants' using errcode = '22023';
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

  insert into rush.speed_dating_pairs (round_id, session, table_number, label, status, created_by, published_at)
  values (target_round_id, target_session, target_table, new_label, 'PUBLISHED', actor, now())
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
          jsonb_build_object('applicationIds', to_jsonb(target_application_ids), 'session', target_session, 'table', target_table));

  return jsonb_build_object('pairId', new_pair_id, 'label', new_label);
end;
$$;

-- The member queue carries each group's table and a scored-of-total count so
-- the grading page can show how far through the night the member is.
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
  applicant_items jsonb;
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

  applicant_items := coalesce((
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
  ), '[]'::jsonb);

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
    'applicants', applicant_items,
    'progress', jsonb_build_object(
      'scored', (
        select count(*) from jsonb_array_elements(applicant_items) item
        where (item->>'scored')::boolean
      ),
      'total', jsonb_array_length(applicant_items)
    ),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'session', pair.session,
        'tableNumber', pair.table_number,
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

-- Evaluators create their own assignments the moment they start a group, so
-- pre-staffing two members per applicant at advancement was phantom work:
-- open forms nobody meant to fill, and assignment emails telling members
-- about applicants they might never meet. Advancement now only enrolls and
-- moves the status. Body copied from 20260913150000 with the evaluator
-- picking, the ineligible-evaluator check and the outbox insert removed;
-- newAssignments and notificationsEnqueued stay in the result as zero because
-- the UI reads them.
create or replace function rush.advance_to_speed_dating(
  target_cycle_id text,
  target_application_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  speed_round rush.rounds%rowtype;
  active_rubric_id text;
  application_rubric_id text;
  application_row rush.applications%rowtype;
  selected_count integer;
  created_assignments integer := 0;
  created_participations integer := 0;
  status_updates integer := 0;
  inserted_participation_id text;
  assignment_ids jsonb := '[]'::jsonb;
  participation_id text;
  enqueued_notifications integer := 0;
  required_evaluators constant integer := 2;
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if coalesce(array_length(target_application_ids, 1), 0) = 0
     or array_length(target_application_ids, 1) > 200
     or exists (select 1 from unnest(target_application_ids) as inputs(item) where nullif(trim(item), '') is null)
     or (select count(distinct item) from unnest(target_application_ids) as inputs(item))
        <> array_length(target_application_ids, 1)
  then
    raise exception 'provide between 1 and 200 distinct application ids' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_cycle_id || ':SPEED_DATING', 0)
  );
  select * into cycle_row
  from rush.rush_cycles
  where id = target_cycle_id
  for update;
  if cycle_row.id is null then
    raise exception 'cycle missing' using errcode = 'P0002';
  end if;
  if cycle_row.status not in ('OPEN','IN_PROCESS') then
    raise exception 'cycle must be open or in process' using errcode = '55000';
  end if;

  select * into speed_round
  from rush.rounds
  where cycle_id = target_cycle_id and kind = 'SPEED_DATING'
  for update;
  if speed_round.id is null then
    raise exception 'Speed Dating round missing' using errcode = 'P0002';
  end if;
  if speed_round.status not in ('PUBLISHED','ACTIVE') then
    raise exception 'Speed Dating must be published before advancement' using errcode = '55000';
  end if;

  select id into active_rubric_id
  from rush.rubrics
  where round_id = speed_round.id
  order by version desc
  limit 1
  for update;
  if active_rubric_id is null
     or not exists (select 1 from rush.rubric_criteria where rubric_id = active_rubric_id)
  then
    raise exception 'Speed Dating rubric missing' using errcode = '55000';
  end if;
  if speed_round.status = 'PUBLISHED' then
    update rush.rubrics
    set frozen_at = coalesce(frozen_at, now())
    where id = active_rubric_id;
  end if;

  perform 1
  from rush.applications a
  where a.cycle_id = target_cycle_id
    and a.id = any(target_application_ids)
  order by a.id
  for update;
  get diagnostics selected_count = row_count;
  if selected_count <> array_length(target_application_ids, 1) then
    raise exception 'application missing or belongs to another cycle' using errcode = 'P0002';
  end if;
  if speed_round.status = 'ACTIVE' and exists (
    select 1
    from unnest(target_application_ids) as selected(application_id)
    where not exists (
      select 1 from rush.round_participations rp
      where rp.round_id = speed_round.id and rp.application_id = selected.application_id
    )
  ) then
    raise exception 'new applicants cannot be advanced after Speed Dating grading opens' using errcode = '55000';
  end if;

  for application_row in
    select a.*
    from rush.applications a
    where a.cycle_id = target_cycle_id and a.id = any(target_application_ids)
    order by a.id
  loop
    if application_row.status not in ('SUBMITTED','ELIGIBLE','INVITED','IN_PROCESS') then
      raise exception 'application % is not eligible for Speed Dating', application_row.id using errcode = '55000';
    end if;
    if exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = application_row.id and c.declarer_id = actor
    ) then
      raise exception 'operator has a conflict with application %', application_row.id using errcode = '42501';
    end if;

    select rp.id, rp.rubric_id
    into participation_id, application_rubric_id
    from rush.round_participations rp
    where rp.round_id = speed_round.id and rp.application_id = application_row.id;
    if participation_id is null then
      application_rubric_id := active_rubric_id;
    elsif not exists (
      select 1 from rush.rubrics rubric
      where rubric.id = application_rubric_id and rubric.round_id = speed_round.id
    ) then
      raise exception 'application % has an invalid Speed Dating rubric snapshot', application_row.id using errcode = '55000';
    end if;

    inserted_participation_id := null;
    insert into rush.round_participations(
      round_id, application_id, rubric_id, required_evaluators,
      assignment_policy, advanced_by
    ) values (
      speed_round.id,
      application_row.id,
      application_rubric_id,
      required_evaluators,
      jsonb_build_object(
        'version', 1,
        'strategy', 'self_service',
        'excludeConflicts', true,
        'excludeRecruitmentCommittee', true
      ),
      actor
    )
    on conflict (round_id, application_id) do nothing
    returning id into inserted_participation_id;
    if inserted_participation_id is not null then
      participation_id := inserted_participation_id;
    end if;
    if participation_id is null then
      select id into participation_id from rush.round_participations
      where round_id = speed_round.id and application_id = application_row.id;
    end if;
    if inserted_participation_id is not null then
      created_participations := created_participations + 1;
      insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
      values (
        actor,
        target_cycle_id,
        'ADVANCED_TO_SPEED_DATING',
        'RoundParticipation',
        inserted_participation_id,
        jsonb_build_object(
          'applicationId', application_row.id,
          'roundId', speed_round.id,
          'rubricId', application_rubric_id,
          'screeningReadinessGate', 'BOARD_PASS_DECISION'
        )
      );
    end if;

    if application_row.status in ('SUBMITTED','ELIGIBLE') then
      update rush.applications set status = 'INVITED', updated_at = now()
      where id = application_row.id;
      status_updates := status_updates + 1;
    end if;
  end loop;

  if created_participations > 0 or status_updates > 0 then
    insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
    values (
      actor,
      target_cycle_id,
      'SPEED_DATING_ADVANCEMENT_COMPLETED',
      'Round',
      speed_round.id,
      jsonb_build_object(
        'selectedApplications', array_length(target_application_ids, 1),
        'newParticipations', created_participations,
        'newAssignments', created_assignments,
        'applicationStatusUpdates', status_updates,
        'notificationsEnqueued', enqueued_notifications,
        'requiredEvaluatorsPerApplication', required_evaluators
      )
    );
  end if;

  return jsonb_build_object(
    'roundId', speed_round.id,
    'rubricId', active_rubric_id,
    'selectedApplications', array_length(target_application_ids, 1),
    'newParticipations', created_participations,
    'newAssignments', created_assignments,
    'assignmentIds', assignment_ids,
    'notificationsEnqueued', enqueued_notifications
  );
end;
$$;

-- Nobody holds a Speed Dating assignment before they start their first group,
-- and starting a group requires calibration, so the assignment prerequisite
-- locked every member out of the calibration page. For a Speed Dating round
-- any grading role on the cycle may read and acknowledge the rubric; other
-- rounds keep the assignment requirement. Bodies from 20260902340000
-- otherwise. The evaluations trigger checks the acknowledgement through the
-- assignment that exists by then, so it stays as it is.
create or replace function rush.round_calibration_detail(target_round_id text)
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
  if not exists (
    select 1 from rush.evaluation_assignments assignment
    where assignment.round_id = target_round_id
      and assignment.evaluator_id = actor
      and assignment.status in ('ASSIGNED','IN_PROGRESS')
  ) and not coalesce(
    round_row.kind = 'SPEED_DATING'
    and rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]),
    false
  ) then raise exception 'round assignment missing' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'roundId', round.id,
    'roundName', round.name,
    'roundStatus', round.status,
    'rubricId', rubric.id,
    'rubricVersion', rubric.version,
    'acknowledgedAt', acknowledgement.acknowledged_at,
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'description', criterion.description,
        'weight', criterion.weight,
        'required', criterion.required
      ) order by criterion.position)
      from rush.rubric_criteria criterion where criterion.rubric_id = rubric.id
    ), '[]'::jsonb)
  ) into result
  from rush.rounds round
  join lateral (
    select active.* from rush.rubrics active
    where active.round_id = round.id order by active.version desc limit 1
  ) rubric on true
  left join rush.round_calibration_acknowledgements acknowledgement
    on acknowledgement.round_id = round.id
   and acknowledgement.rubric_id = rubric.id
   and acknowledgement.evaluator_id = actor
  where round.id = target_round_id and round.status in ('PUBLISHED','ACTIVE');
  if result is null then raise exception 'calibration unavailable' using errcode = '55000'; end if;
  return result;
end;
$$;

create or replace function rush.acknowledge_round_calibration(
  target_round_id text,
  target_rubric_id text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_cycle_id text;
  round_kind text;
  active_rubric_id text;
  acknowledged timestamptz;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select cycle_id, kind::text into target_cycle_id, round_kind
  from rush.rounds
  where id = target_round_id and status in ('PUBLISHED','ACTIVE')
  for share;
  if target_cycle_id is null then raise exception 'calibration unavailable' using errcode = '55000'; end if;
  if not exists (
    select 1 from rush.evaluation_assignments assignment
    where assignment.round_id = target_round_id
      and assignment.evaluator_id = actor
      and assignment.status in ('ASSIGNED','IN_PROGRESS')
  ) and not (
    round_kind = 'SPEED_DATING'
    and rush.has_cycle_role(target_cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
  ) then raise exception 'round assignment missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[]) then
    raise exception 'role revoked' using errcode = '42501';
  end if;
  select id into active_rubric_id from rush.rubrics
  where round_id = target_round_id order by version desc limit 1;
  if active_rubric_id is null or active_rubric_id <> target_rubric_id then
    raise exception 'rubric changed; review the active version' using errcode = '55000';
  end if;
  insert into rush.round_calibration_acknowledgements(round_id, rubric_id, evaluator_id)
  values(target_round_id, target_rubric_id, actor)
  on conflict (round_id, rubric_id, evaluator_id) do update
    set acknowledged_at = round_calibration_acknowledgements.acknowledged_at
  returning acknowledged_at into acknowledged;
  if not exists (
    select 1 from rush.audit_events event
    where event.actor_id = actor
      and event.action = 'ROUND_CALIBRATION_ACKNOWLEDGED'
      and event.resource = 'Rubric'
      and event.resource_id = target_rubric_id
  ) then
    insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
    values(actor, target_cycle_id, 'ROUND_CALIBRATION_ACKNOWLEDGED', 'Rubric', target_rubric_id,
      jsonb_build_object('roundId', target_round_id, 'advisoryOnly', true, 'automaticScoreAdjustment', false));
  end if;
  return acknowledged;
end;
$$;

-- The Board's read of the night. A score is the latest submitted evaluation
-- on the evaluator's assignment; its session and table come from the group
-- that evaluator started and submitted with the applicant in it. Groups from
-- before tables existed report null for both.
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
      rating.score,
      rating.note,
      grp.session,
      grp.table_number
    from rush.round_participations participation
    join rush.evaluation_assignments assignment
      on assignment.round_id = participation.round_id
     and assignment.application_id = participation.application_id
    join rush.profiles profile on profile.id = assignment.evaluator_id
    join lateral (
      select evaluation.id, evaluation.submitted_at
      from rush.evaluations evaluation
      where evaluation.assignment_id = assignment.id
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
    left join lateral (
      select pair.session, pair.table_number
      from rush.speed_dating_pair_members member
      join rush.speed_dating_pairs pair on pair.id = member.pair_id and pair.round_id = target_round_id
      join rush.speed_dating_pair_claims claim
        on claim.pair_id = pair.id
       and claim.evaluator_id = assignment.evaluator_id
       and claim.submitted_at is not null
      where member.application_id = participation.application_id
      order by claim.submitted_at desc
      limit 1
    ) grp on true
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
    'tables', coalesce((
      select jsonb_object_agg(per_session.session::text, per_session.tables)
      from (
        select pair.session, jsonb_agg(distinct pair.table_number order by pair.table_number) tables
        from rush.speed_dating_pairs pair
        where pair.round_id = target_round_id and pair.table_number is not null
        group by pair.session
      ) per_session
    ), '{}'::jsonb),
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', applicant.id,
        'name', applicant.name,
        'status', applicant.status,
        'mean', stats.mean,
        'count', stats.grader_count,
        'stddev', stats.stddev,
        'tablesVisited', coalesce((
          select jsonb_object_agg(visited.session::text, visited.tables)
          from (
            select s.session, jsonb_agg(distinct s.table_number order by s.table_number) tables
            from scored s
            where s.application_id = applicant.id and s.session is not null and s.table_number is not null
            group by s.session
          ) visited
        ), '{}'::jsonb),
        'perTable', coalesce((
          select jsonb_agg(jsonb_build_object(
            'session', per_table.session,
            'table', per_table.table_number,
            'mean', per_table.mean,
            'count', per_table.grader_count
          ) order by per_table.session, per_table.table_number)
          from (
            select s.session, s.table_number, round(avg(s.score), 2) mean, count(*)::integer grader_count
            from scored s
            where s.application_id = applicant.id and s.session is not null and s.table_number is not null
            group by s.session, s.table_number
          ) per_table
        ), '[]'::jsonb),
        'scores', coalesce((
          select jsonb_agg(jsonb_build_object(
            'evaluatorName', s.evaluator_name,
            'evaluatorId', s.evaluator_id,
            'session', s.session,
            'table', s.table_number,
            'score', s.score,
            'note', coalesce(s.note, ''),
            'submittedAt', s.submitted_at
          ) order by s.session, s.table_number, s.evaluator_name)
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

revoke all on function rush.start_speed_dating_group(text, text[], integer, integer) from public, anon;
revoke all on function rush.my_speed_dating_pairs(text) from public, anon;
revoke all on function rush.advance_to_speed_dating(text, text[]) from public, anon;
revoke all on function rush.round_calibration_detail(text) from public, anon;
revoke all on function rush.acknowledge_round_calibration(text, text) from public, anon;
revoke all on function rush.speed_dating_results(text) from public, anon;
grant execute on function rush.start_speed_dating_group(text, text[], integer, integer) to authenticated, service_role;
grant execute on function rush.my_speed_dating_pairs(text) to authenticated, service_role;
grant execute on function rush.advance_to_speed_dating(text, text[]) to authenticated, service_role;
grant execute on function rush.round_calibration_detail(text) to authenticated, service_role;
grant execute on function rush.acknowledge_round_calibration(text, text) to authenticated, service_role;
grant execute on function rush.speed_dating_results(text) to authenticated, service_role;

-- Groups may now hold a single applicant, so pair submission accepts 1..3
-- members. Body otherwise identical to 20260913140000.
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
     or jsonb_array_length(submitted_members) not between 1 and 3
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

revoke all on function rush.submit_speed_dating_pair(text, jsonb) from public, anon;
grant execute on function rush.submit_speed_dating_pair(text, jsonb) to authenticated, service_role;
