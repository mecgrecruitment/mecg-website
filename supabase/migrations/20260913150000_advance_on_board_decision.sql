-- Advancement refused the current cohort three ways. It required the cycle to
-- be IN_PROCESS, but the first Speed Dating cohort is advanced while
-- applications are still arriving and the cycle is still OPEN. It required
-- three locked committee screening reviews per applicant, but the board's move
-- to ELIGIBLE is the pass decision now, produced by the reader-adjusted
-- ranking and by hand, and thirty of the sixty-five passed applicants have
-- fewer than three locked reviews; one of them in the selection refused the
-- whole batch. And it broke evaluator ties by user id, so every early
-- applicant landed on the same two members. Ties now break at random; the
-- least-open-assignments order and the capacity cap are unchanged, as is
-- everything else in the body.
--
-- set_application_status gains the mirror guard: a hand move to INVITED now
-- requires a Speed Dating participation row, so the status and the round
-- enrollment cannot drift apart. The UI routes that move through
-- advance_to_speed_dating.

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
      ), random()
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
          'screeningReadinessGate', 'BOARD_PASS_DECISION',
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

    if application_row.status in ('SUBMITTED','ELIGIBLE') then
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

revoke all on function rush.advance_to_speed_dating(text, text[]) from public, anon;
grant execute on function rush.advance_to_speed_dating(text, text[]) to authenticated, service_role;

create or replace function rush.set_application_status(target_application_id text,next_status rush.application_status)
returns void language plpgsql security definer set search_path='' as $$
declare app_row rush.applications%rowtype;
begin
  select a.* into app_row from rush.applications a where a.id=target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode='P0002'; end if;
  if not rush.has_cycle_capability(app_row.cycle_id,'APPLICANT_OPERATIONS') then raise exception 'forbidden' using errcode='42501'; end if;
  if exists (select 1 from rush.conflict_declarations c where c.application_id=app_row.id and c.declarer_id=rush.actor_id()) then raise exception 'conflict recusal' using errcode='42501'; end if;
  if next_status in ('OFFERED','WAITLISTED','REJECTED','WITHDRAWN') then raise exception 'decision and withdrawal outcomes cannot be set manually' using errcode='55000'; end if;
  if next_status<>app_row.status and not (
    (app_row.status='DRAFT' and next_status='SUBMITTED') or
    (app_row.status='SUBMITTED' and next_status in ('NEEDS_INFO','ELIGIBLE')) or
    (app_row.status='NEEDS_INFO' and next_status in ('SUBMITTED','ELIGIBLE')) or
    (app_row.status='ELIGIBLE' and next_status='INVITED') or
    (app_row.status='INVITED' and next_status='GROUP_CASE') or
    (app_row.status='GROUP_CASE' and next_status='IN_PROCESS') or
    (app_row.status='IN_PROCESS' and next_status='FINAL_REVIEW')
  ) then raise exception 'invalid application transition' using errcode='55000'; end if;
  if next_status='INVITED' and not exists (
    select 1 from rush.round_participations rp
    where rp.application_id=app_row.id
      and rp.round_id=(select id from rush.rounds where cycle_id=app_row.cycle_id and kind='SPEED_DATING')
  ) then raise exception 'move to Speed Dating through advancement so the applicant is enrolled and staffed' using errcode='55000'; end if;
  update rush.applications a set status=next_status where a.id=target_application_id;
  if next_status<>app_row.status then
    insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
    values (rush.actor_id(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
  end if;
end; $$;

revoke all on function rush.set_application_status(text,rush.application_status) from public,anon;
grant execute on function rush.set_application_status(text,rush.application_status) to authenticated,service_role;

-- Body copied from 20260912120000 except for the pass branch. A stage hash
-- that passes someone into Speed Dating must enroll and staff them, and
-- advance_to_speed_dating already owns that. It also means the Speed Dating
-- round must be published before the Application hash is applied, which is
-- the right order.
create or replace function rush.apply_stage_hash_result(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  app_row rush.applications%rowtype;
  cycle_row rush.rush_cycles%rowtype;
  open_stage text;
  rule record;
  yes_votes int;
  no_votes int;
  unsure_votes int;
  total_cast int;
  next_status rush.application_status;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into app_row from rush.applications where id = target_application_id for update;
  if app_row.id is null then raise exception 'application missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(app_row.cycle_id, array['BOARD', 'OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into cycle_row from rush.rush_cycles where id = app_row.cycle_id;
  open_stage := rush.current_hash_stage(cycle_row.id);
  if open_stage is null or open_stage = 'FINAL' then
    raise exception 'no stage vote is open' using errcode = '55000';
  end if;
  select * into rule from rush.hash_stage_rule(open_stage);
  if not (app_row.status = any(rule.ballot_statuses)) then
    raise exception 'application is not on this ballot' using errcode = '55000';
  end if;
  if exists (
    select 1 from rush.conflict_declarations cd
    where cd.application_id = app_row.id and cd.declarer_id = actor
  ) then
    raise exception 'conflict declared for this applicant' using errcode = '42501';
  end if;

  select
    count(*) filter (where v.vote = 'YES')::int,
    count(*) filter (where v.vote = 'NO')::int,
    count(*) filter (where v.vote = 'UNSURE')::int,
    count(*)::int
  into yes_votes, no_votes, unsure_votes, total_cast
  from rush.hash_votes v
  where v.application_id = app_row.id and v.stage = open_stage;
  if total_cast < cycle_row.hash_quorum then
    raise exception 'not enough votes yet' using errcode = '55000';
  end if;

  next_status := case when yes_votes > no_votes then rule.pass_status else 'REJECTED'::rush.application_status end;
  if next_status = 'INVITED' then
    -- Speed Dating enrollment and evaluator staffing live in one place.
    perform rush.advance_to_speed_dating(app_row.cycle_id, array[app_row.id]);
  else
    update rush.applications a set status = next_status where a.id = app_row.id;
  end if;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'HASH_STAGE_RESULT_APPLIED', 'Application', app_row.id,
          jsonb_build_object(
            'stage', open_stage,
            'yesCount', yes_votes,
            'noCount', no_votes,
            'unsureCount', unsure_votes,
            'quorum', cycle_row.hash_quorum,
            'from', app_row.status,
            'to', next_status
          ));
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, app_row.cycle_id, 'APPLICATION_STATUS_CHANGED', 'Application', app_row.id,
          jsonb_build_object('from', app_row.status, 'to', next_status));
  return next_status::text;
end;
$$;

revoke all on function rush.apply_stage_hash_result(text) from public, anon;
grant execute on function rush.apply_stage_hash_result(text) to authenticated, service_role;
