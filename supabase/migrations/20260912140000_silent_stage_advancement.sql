-- Advancing applicants to Speed Dating used to enqueue a SPEED_DATING_INVITATION
-- email to each of them, and the confirm panel never said so. The board wants
-- stage moves to be silent toward applicants; it announces rounds on its own
-- schedule. Same function otherwise: participations, evaluator assignments,
-- evaluator assignment emails, audit rows and the all-or-nothing cohort rule
-- are unchanged. Delivered rows in the outbox are untouched.

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
  evaluator uuid;
  selected_count integer;
  existing_count integer;
  missing_count integer;
  created_assignments integer := 0;
  created_participations integer := 0;
  status_updates integer := 0;
  inserted_participation_id text;
  assignment_ids jsonb := '[]'::jsonb;
  assignment_id text;
  participation_id text;
  enqueued_notifications integer := 0;
  app_notification_count integer;
  evaluator_notification_count integer;
  required_evaluators constant integer := 2;
  max_open_assignments constant integer := 12;
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
  if cycle_row.status <> 'IN_PROCESS' then
    raise exception 'cycle must be in process' using errcode = '55000';
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
    if application_row.status not in ('ELIGIBLE','INVITED','IN_PROCESS') then
      raise exception 'application % is not eligible for Speed Dating', application_row.id using errcode = '55000';
    end if;
    if exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = application_row.id and c.declarer_id = actor
    ) then
      raise exception 'operator has a conflict with application %', application_row.id using errcode = '42501';
    end if;
    if not rush.is_speed_dating_screening_ready(application_row.id) then
      raise exception 'application % needs three locked committee screening reviews in the latest frozen batch', application_row.id using errcode = '55000';
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
    if exists (
      select 1
      from rush.evaluation_assignments ea
      where ea.round_id = speed_round.id
        and ea.application_id = application_row.id
        and ea.status not in ('RECUSED','MISSED')
        and (
          exists (
            select 1 from rush.conflict_declarations c
            where c.application_id = application_row.id and c.declarer_id = ea.evaluator_id
          )
          or not exists (
            select 1
            from rush.memberships m
            join rush.profiles p on p.id = m.user_id and p.active
            where m.cycle_id = target_cycle_id
              and m.user_id = ea.evaluator_id
              and m.active
              and m.role in ('MEMBER','BOARD','PANEL','OWNER')
          )
          or exists (
            select 1 from rush.memberships committee
            where committee.cycle_id = target_cycle_id
              and committee.user_id = ea.evaluator_id
              and committee.active
              and committee.role = 'RECRUITMENT_COMMITTEE'
          )
        )
    ) then
      raise exception 'application % has an ineligible existing Speed Dating evaluator', application_row.id using errcode = '55000';
    end if;

    select count(*) into existing_count
    from rush.evaluation_assignments ea
    where ea.round_id = speed_round.id
      and ea.application_id = application_row.id
      and ea.status not in ('RECUSED','MISSED');
    if existing_count > required_evaluators then
      raise exception 'application % already has more than two Speed Dating evaluators', application_row.id using errcode = '55000';
    end if;
    missing_count := required_evaluators - existing_count;

    for assignment_number in 1..missing_count loop
      select candidate.user_id into evaluator
      from (
        select distinct m.user_id
        from rush.memberships m
        join rush.profiles p on p.id = m.user_id and p.active
        where m.cycle_id = target_cycle_id
          and m.active
          and m.role in ('MEMBER','BOARD','PANEL','OWNER')
          and not exists (
            select 1 from rush.memberships committee
            where committee.cycle_id = target_cycle_id
              and committee.user_id = m.user_id
              and committee.active
              and committee.role = 'RECRUITMENT_COMMITTEE'
          )
      ) candidate
      where not exists (
          select 1 from rush.conflict_declarations c
          where c.application_id = application_row.id and c.declarer_id = candidate.user_id
        )
        and not exists (
          select 1 from rush.evaluation_assignments ea
          where ea.round_id = speed_round.id
            and ea.application_id = application_row.id
            and ea.evaluator_id = candidate.user_id
        )
        and (
          select count(*)
          from rush.evaluation_assignments load
          join rush.rounds load_round on load_round.id = load.round_id
          where load.evaluator_id = candidate.user_id
            and load_round.cycle_id = target_cycle_id
            and load.status in ('ASSIGNED','IN_PROGRESS')
        ) < max_open_assignments
      order by (
        select count(*)
        from rush.evaluation_assignments load
        join rush.rounds load_round on load_round.id = load.round_id
        where load.evaluator_id = candidate.user_id
          and load_round.cycle_id = target_cycle_id
          and load.status in ('ASSIGNED','IN_PROGRESS')
      ), candidate.user_id
      limit 1;

      if evaluator is null then
        raise exception 'application % cannot be staffed with two conflict-free evaluators under capacity', application_row.id using errcode = '55000';
      end if;
      insert into rush.evaluation_assignments(round_id, application_id, evaluator_id)
      values(speed_round.id, application_row.id, evaluator)
      returning id into assignment_id;
      created_assignments := created_assignments + 1;
      assignment_ids := assignment_ids || jsonb_build_array(assignment_id);
      insert into rush.audit_events(actor_id, cycle_id, action, resource, resource_id, metadata)
      values (
        actor,
        target_cycle_id,
        'EVALUATOR_ASSIGNED_AUTOMATICALLY',
        'EvaluationAssignment',
        assignment_id,
        jsonb_build_object(
          'applicationId', application_row.id,
          'roundId', speed_round.id,
          'evaluatorId', evaluator,
          'strategy', 'least_open_assignments'
        )
      );
    end loop;

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
        'strategy', 'least_open_assignments',
        'maxOpenAssignments', max_open_assignments,
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
          'screeningReadinessGate', 'LATEST_FROZEN_BATCH_THREE_LOCKED_COMMITTEE_REVIEWS',
          'requiredEvaluators', required_evaluators,
          'notificationDelivery', 'durable outbox plus in-app evaluator assignment fallback'
        )
      );
    end if;

    -- No applicant email here: the board moves applicants between stages
    -- quietly and tells them itself when it is ready. Evaluators still get
    -- their assignment email below.
    app_notification_count := 0;

    insert into rush.notification_outbox(
      cycle_id, application_id, evaluation_assignment_id, recipient,
      template_key, template_version, idempotency_key
    )
    select
      target_cycle_id, application_row.id, ea.id, profile.primary_email,
      'EVALUATION_ASSIGNED', 1, 'evaluation-assigned:' || ea.id
    from rush.evaluation_assignments ea
    join rush.profiles profile on profile.id = ea.evaluator_id
    where ea.round_id = speed_round.id
      and ea.application_id = application_row.id
      and ea.status not in ('RECUSED','MISSED')
      and profile.active
      and profile.primary_email is not null
    on conflict (evaluation_assignment_id, template_key, template_version) do nothing;
    get diagnostics evaluator_notification_count = row_count;
    enqueued_notifications := enqueued_notifications + app_notification_count + evaluator_notification_count;

    if application_row.status = 'ELIGIBLE' then
      update rush.applications set status = 'INVITED', updated_at = now()
      where id = application_row.id;
      status_updates := status_updates + 1;
    end if;
  end loop;

  if created_participations > 0 or created_assignments > 0 or status_updates > 0 or enqueued_notifications > 0 then
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
