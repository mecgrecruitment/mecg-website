-- Group Case grading without the Board assigning judges one at a time. The
-- Speed Dating night worked because every member saw one roster and rated
-- whoever was in front of them; Group Case borrows the shape. Moving an
-- applicant into GROUP_CASE enrolls them in the round, any member adds the
-- applicants at their table to their own queue, and the existing observation
-- board and finish queue do the grading. Board roles also see each
-- applicant's Speed Dating score on the roster.

-- Body copied from 20260913150000 with one addition: an application that
-- enters GROUP_CASE is enrolled in the cycle's Group Case round on the spot,
-- so the self-service roster below has someone to show.
create or replace function rush.set_application_status(target_application_id text,next_status rush.application_status)
returns void language plpgsql security definer set search_path='' as $$
declare app_row rush.applications%rowtype; case_round_id text; case_rubric_id text;
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
  if next_status='GROUP_CASE' and next_status<>app_row.status then
    select id into case_round_id from rush.rounds where cycle_id=app_row.cycle_id and kind='GROUP_CASE' order by created_at desc limit 1;
    select id into case_rubric_id from rush.rubrics where round_id=case_round_id order by version desc limit 1;
    if case_round_id is null or case_rubric_id is null then raise exception 'Group Case round or rubric missing' using errcode='55000'; end if;
    insert into rush.round_participations (round_id,application_id,rubric_id,required_evaluators,assignment_policy,advanced_by)
    values (case_round_id,app_row.id,case_rubric_id,2,jsonb_build_object('version',1,'strategy','self_service'),rush.actor_id())
    on conflict (round_id,application_id) do nothing;
  end if;
  if next_status<>app_row.status then
    insert into rush.audit_events (actor_id,cycle_id,action,resource,resource_id,metadata)
    values (rush.actor_id(),app_row.cycle_id,'APPLICATION_STATUS_CHANGED','Application',target_application_id,jsonb_build_object('from',app_row.status,'to',next_status));
  end if;
end; $$;

revoke all on function rush.set_application_status(text,rush.application_status) from public,anon;
grant execute on function rush.set_application_status(text,rush.application_status) to authenticated,service_role;

-- Anyone already sitting in GROUP_CASE moved there before this enrollment
-- existed. Enroll them once, credited to the cycle's first owner. Idempotent.
insert into rush.round_participations (round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by)
select case_round.id, application.id, case_rubric.id, 2,
       jsonb_build_object('version', 1, 'strategy', 'self_service'),
       cycle_owner.user_id
from rush.applications application
join lateral (
  select id from rush.rounds
  where cycle_id = application.cycle_id and kind = 'GROUP_CASE'
  order by created_at desc limit 1
) case_round on true
join lateral (
  select id from rush.rubrics
  where round_id = case_round.id
  order by version desc limit 1
) case_rubric on true
join lateral (
  select user_id from rush.memberships
  where cycle_id = application.cycle_id and role = 'OWNER' and active
  order by created_at limit 1
) cycle_owner on true
where application.status = 'GROUP_CASE'
on conflict (round_id, application_id) do nothing;

-- Body copied from 20260821150000 (auth.uid() became rush.actor_id() in
-- 20260902170000). Advancement into Speed Dating already accepts an OPEN
-- cycle (20260913150000 line 76); rounds must be able to open and freeze on
-- the same cycle, so PUBLISHED -> ACTIVE and ACTIVE -> FROZEN accept OPEN too.
create or replace function rush.set_round_status(target_round_id text, next_status rush.round_status)
returns void language plpgsql security definer set search_path='' as $$
declare current_row rush.rounds%rowtype; cycle_status rush.cycle_status;
begin
  select * into current_row from rush.rounds where id=target_round_id for update;
  if current_row.id is null or not rush.has_cycle_role(current_row.cycle_id,array['BOARD','OWNER']::rush.member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into cycle_status from rush.rush_cycles where id=current_row.cycle_id;
  if current_row.status=next_status then return; end if;
  if not ((current_row.status='DRAFT' and next_status='PUBLISHED') or (current_row.status='PUBLISHED' and next_status='ACTIVE' and cycle_status in ('OPEN','IN_PROCESS')) or (current_row.status='ACTIVE' and next_status='FROZEN' and cycle_status in ('OPEN','IN_PROCESS','DECISION_LOCK')) or (current_row.status='FROZEN' and next_status='FINALIZED') or (current_row.status='FINALIZED' and next_status='ARCHIVED')) then raise exception 'invalid round transition' using errcode='55000'; end if;
  update rush.rounds set status=next_status where id=target_round_id;
  if next_status='FROZEN' then update rush.evaluations e set status='LOCKED' from rush.evaluation_assignments a where e.assignment_id=a.id and a.round_id=target_round_id and e.status='SUBMITTED'; update rush.evaluation_assignments set status='LOCKED' where round_id=target_round_id and status='SUBMITTED'; end if;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata) values(rush.actor_id(),current_row.cycle_id,'ROUND_STATUS_CHANGED','Round',target_round_id,jsonb_build_object('from',current_row.status,'to',next_status));
end; $$;

revoke all on function rush.set_round_status(text,rush.round_status) from public,anon;
grant execute on function rush.set_round_status(text,rush.round_status) to authenticated,service_role;

-- A member adds the applicants at their table to their own queue. Rerunning
-- with the same ids is a no-op; an applicant the member declared a conflict
-- on is skipped rather than refused, since a table is added as a batch.
create or replace function rush.open_group_case_assignments(
  target_round_id text,
  target_application_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  created_count integer := 0;
  skipped_count integer := 0;
  inserted record;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id for share;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'not a Group Case round' using errcode = '55000';
  end if;
  if round_row.status <> 'ACTIVE' then
    raise exception 'round is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application_ids is null
     or array_length(target_application_ids, 1) is null
     or array_length(target_application_ids, 1) > 50
     or (select count(distinct item) from unnest(target_application_ids) as inputs(item))
        <> array_length(target_application_ids, 1)
  then
    raise exception 'pick between 1 and 50 applicants' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(target_application_ids) as inputs(item)
    where not exists (
      select 1
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      where participation.round_id = target_round_id
        and participation.application_id = inputs.item
        and application.status not in ('DRAFT', 'WITHDRAWN')
    )
  ) then
    raise exception 'applicant is not in this round' using errcode = '22023';
  end if;

  select count(*) into skipped_count
  from unnest(target_application_ids) as inputs(item)
  where exists (
    select 1 from rush.conflict_declarations conflict
    where conflict.declarer_id = actor and conflict.application_id = inputs.item
  );

  for inserted in
    insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
    select target_round_id, inputs.item, actor
    from unnest(target_application_ids) as inputs(item)
    where not exists (
      select 1 from rush.conflict_declarations conflict
      where conflict.declarer_id = actor and conflict.application_id = inputs.item
    )
    on conflict (round_id, application_id, evaluator_id) do nothing
    returning id, application_id
  loop
    created_count := created_count + 1;
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
    values (actor, round_row.cycle_id, 'GROUP_CASE_SELF_ASSIGNED', 'Application', inserted.application_id,
            jsonb_build_object('roundId', target_round_id, 'assignmentId', inserted.id));
  end loop;

  return jsonb_build_object(
    'assignmentIds', coalesce((
      select jsonb_agg(assignment.id order by assignment.id)
      from rush.evaluation_assignments assignment
      where assignment.round_id = target_round_id
        and assignment.evaluator_id = actor
        and assignment.application_id = any(target_application_ids)
    ), '[]'::jsonb),
    'created', created_count,
    'skippedConflicts', skipped_count
  );
end;
$$;

-- The member's roster for the night: everyone enrolled, grouped by case
-- group, with the member's own assignment state on each. Board roles also
-- see the Speed Dating adjusted score; speed_dating_results raises for
-- everyone else, so it is only called once the role is known.
create or replace function rush.group_case_roster(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  can_see_speed_dating boolean;
  sd_round_id text;
  sd_scores jsonb := '{}'::jsonb;
  group_items jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'not a Group Case round' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  can_see_speed_dating := rush.has_cycle_role(round_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]);
  if can_see_speed_dating then
    select id into sd_round_id
    from rush.rounds
    where cycle_id = round_row.cycle_id and kind = 'SPEED_DATING'
    order by created_at desc
    limit 1;
    if sd_round_id is not null then
      select coalesce(jsonb_object_agg(
        item->>'applicationId',
        jsonb_build_object('adjusted', item->'adjusted', 'mean', item->'mean', 'count', item->'count')
      ), '{}'::jsonb) into sd_scores
      from jsonb_array_elements(rush.speed_dating_results(sd_round_id)->'applicants') item;
    end if;
  end if;

  group_items := coalesce((
    select jsonb_agg(jsonb_build_object(
      'groupId', grouped.group_id,
      'groupName', grouped.group_name,
      'applicants', grouped.applicants
    ) order by grouped.group_id is null, grouped.group_name, grouped.group_id)
    from (
      select
        case_group.id group_id,
        coalesce(case_group.name, 'Not in a group') group_name,
        jsonb_agg(jsonb_build_object(
          'applicationId', application.id,
          'name', pnm.name,
          'assignmentId', mine.id,
          'assignmentStatus', mine.status::text,
          'speedDating', case when can_see_speed_dating then sd_scores->application.id end
        ) order by pnm.name, application.id) applicants
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      left join rush.case_group_members membership
        on membership.application_id = application.id
      left join rush.case_groups case_group
        on case_group.id = membership.group_id
       and case_group.cycle_id = round_row.cycle_id
      left join rush.evaluation_assignments mine
        on mine.round_id = target_round_id
       and mine.application_id = application.id
       and mine.evaluator_id = actor
      where participation.round_id = target_round_id
        and application.status not in ('DRAFT', 'WITHDRAWN')
        and not exists (
          select 1 from rush.conflict_declarations conflict
          where conflict.application_id = application.id and conflict.declarer_id = actor
        )
      group by case_group.id, case_group.name
    ) grouped
  ), '[]'::jsonb);

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'canSeeSpeedDating', can_see_speed_dating,
    'groups', group_items
  );
end;
$$;

-- Body copied from 20260901184000 with auth.uid() replaced by
-- rush.actor_id(). The round read is `for share` now: every submit in a
-- round was serialising on the single rounds row; `for share` still blocks a
-- concurrent freeze without queueing graders behind each other.
create or replace function rush.submit_evaluation(target_assignment_id text, submitted_ratings jsonb, submitted_evidence text default null)
returns table (evaluation_id text, score numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  assignment_row rush.evaluation_assignments%rowtype;
  round_row rush.rounds%rowtype;
  v_rubric_id text;
  expected_count integer;
  received_count integer;
  minimum_observed integer;
  observed_count integer;
  total_weight numeric;
  observed_weight numeric;
  weighted_score numeric;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_ratings) <> 'array' then raise exception 'ratings must be an array' using errcode = '22023'; end if;
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null or assignment_row.evaluator_id <> actor then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = assignment_row.round_id for share;
  if assignment_row.status <> 'ASSIGNED' or round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'assignment closed' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'role revoked' using errcode = '42501';
  end if;
  if exists (select 1 from rush.conflict_declarations where application_id = assignment_row.application_id and declarer_id = actor) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;
  if exists (select 1 from rush.evaluations where assignment_id = target_assignment_id and status in ('SUBMITTED','LOCKED')) then
    raise exception 'already submitted' using errcode = '23505';
  end if;
  select id, minimum_observed_criteria into v_rubric_id, minimum_observed
  from rush.rubrics where round_id = round_row.id order by version desc limit 1;
  if v_rubric_id is null then raise exception 'rubric missing' using errcode = '55000'; end if;

  with input as (
    select x->>'criterionId' criterion_id
    from jsonb_array_elements(submitted_ratings) x
  )
  select count(*), count(distinct criterion_id) into received_count, expected_count from input;
  select count(*) into expected_count from rush.rubric_criteria where rubric_id = v_rubric_id;
  if received_count <> expected_count or exists (
    select 1 from jsonb_array_elements(submitted_ratings) x
    where not exists (select 1 from rush.rubric_criteria c where c.rubric_id = v_rubric_id and c.id = x->>'criterionId')
  ) or (select count(distinct x->>'criterionId') from jsonb_array_elements(submitted_ratings) x) <> expected_count then
    raise exception 'every criterion must appear exactly once' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where x->'score' <> 'null'::jsonb and ((x->>'score') !~ '^[1-5]$')) then
    raise exception 'scores must be 1 through 5 or null' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where (x->>'score') in ('1','2','5') and trim(coalesce(x->>'note','')) = '') then
    raise exception 'extreme scores require notes' using errcode = '22023';
  end if;
  with input as (
    select x->>'criterionId' criterion_id, nullif(x->>'score','')::integer score_value
    from jsonb_array_elements(submitted_ratings) x
  )
  select sum(c.weight),
    sum(c.weight) filter (where i.score_value is not null),
    count(*) filter (where i.score_value is not null),
    100 * sum(c.weight * ((i.score_value - 1)::numeric / 4)) filter (where i.score_value is not null)
      / nullif(sum(c.weight) filter (where i.score_value is not null), 0)
  into total_weight, observed_weight, observed_count, weighted_score
  from rush.rubric_criteria c join input i on i.criterion_id = c.id where c.rubric_id = v_rubric_id;
  if observed_count < minimum_observed or observed_weight / total_weight < 0.75 or exists (
    select 1 from rush.rubric_criteria c join jsonb_array_elements(submitted_ratings) x on x->>'criterionId' = c.id
    where c.rubric_id = v_rubric_id and c.required and coalesce(x->'score', 'null'::jsonb) = 'null'::jsonb
  ) then raise exception 'required criteria or observation coverage missing' using errcode = '22023'; end if;

  insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, status, evidence, submitted_at)
  values (target_assignment_id, actor, v_rubric_id, 'SUBMITTED', left(nullif(trim(submitted_evidence),''), 4000), now())
  returning id into evaluation_id;
  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  select evaluation_id, x->>'criterionId', nullif(x->>'score','')::integer, left(nullif(trim(x->>'note'),''), 2000)
  from jsonb_array_elements(submitted_ratings) x;
  update rush.evaluation_assignments set status = 'SUBMITTED' where id = target_assignment_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, round_row.cycle_id, 'EVALUATION_SUBMITTED', 'Evaluation', evaluation_id);
  score := weighted_score;
  return next;
end;
$$;

revoke all on function rush.open_group_case_assignments(text, text[]) from public, anon;
revoke all on function rush.group_case_roster(text) from public, anon;
revoke all on function rush.submit_evaluation(text, jsonb, text) from public, anon;
grant execute on function rush.open_group_case_assignments(text, text[]) to authenticated, service_role;
grant execute on function rush.group_case_roster(text) to authenticated, service_role;
grant execute on function rush.submit_evaluation(text, jsonb, text) to authenticated, service_role;
