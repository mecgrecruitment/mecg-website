-- Calibration is an acknowledgement of the active rubric, not a score and not
-- an automatic adjustment. A new rubric version requires a new acknowledgement.

create table rush.round_calibration_acknowledgements (
  round_id text not null references rush.rounds(id) on delete cascade,
  rubric_id text not null references rush.rubrics(id) on delete cascade,
  evaluator_id uuid not null references rush.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (round_id, rubric_id, evaluator_id)
);

create index round_calibration_acknowledgements_evaluator_idx
  on rush.round_calibration_acknowledgements(evaluator_id, acknowledged_at desc);

alter table rush.round_calibration_acknowledgements enable row level security;
alter table rush.round_calibration_acknowledgements force row level security;
revoke all on table rush.round_calibration_acknowledgements from public, anon, authenticated;
grant all on table rush.round_calibration_acknowledgements to service_role;

create or replace function rush.my_round_calibrations(target_cycle_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := rush.actor_id();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'roundId', assigned.round_id,
      'rubricId', assigned.rubric_id,
      'acknowledgedAt', acknowledgement.acknowledged_at
    ) order by assigned.round_name)
    from (
      select distinct r.id round_id, r.name round_name, active_rubric.id rubric_id
      from rush.evaluation_assignments assignment
      join rush.rounds r on r.id = assignment.round_id and r.cycle_id = target_cycle_id
      join lateral (
        select rubric.id from rush.rubrics rubric
        where rubric.round_id = r.id order by rubric.version desc limit 1
      ) active_rubric on true
      where assignment.evaluator_id = actor
        and assignment.status in ('ASSIGNED','IN_PROGRESS')
    ) assigned
    left join rush.round_calibration_acknowledgements acknowledgement
      on acknowledgement.round_id = assigned.round_id
     and acknowledgement.rubric_id = assigned.rubric_id
     and acknowledgement.evaluator_id = actor
  ), '[]'::jsonb);
end;
$$;

create or replace function rush.round_calibration_detail(target_round_id text)
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
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (
    select 1 from rush.evaluation_assignments assignment
    where assignment.round_id = target_round_id
      and assignment.evaluator_id = actor
      and assignment.status in ('ASSIGNED','IN_PROGRESS')
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
  active_rubric_id text;
  acknowledged timestamptz;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select cycle_id into target_cycle_id
  from rush.rounds
  where id = target_round_id and status in ('PUBLISHED','ACTIVE')
  for share;
  if target_cycle_id is null then raise exception 'calibration unavailable' using errcode = '55000'; end if;
  if not exists (
    select 1 from rush.evaluation_assignments assignment
    where assignment.round_id = target_round_id
      and assignment.evaluator_id = actor
      and assignment.status in ('ASSIGNED','IN_PROGRESS')
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

create or replace function rush.require_round_calibration_before_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('SUBMITTED','LOCKED') and not exists (
    select 1
    from rush.evaluation_assignments assignment
    join rush.round_calibration_acknowledgements acknowledgement
      on acknowledgement.round_id = assignment.round_id
     and acknowledgement.rubric_id = new.rubric_id
     and acknowledgement.evaluator_id = new.evaluator_id
    where assignment.id = new.assignment_id
      and assignment.evaluator_id = new.evaluator_id
  ) then
    raise exception 'review and acknowledge the active rubric calibration before submitting' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger evaluations_require_round_calibration
before insert on rush.evaluations
for each row execute function rush.require_round_calibration_before_evaluation();

-- Keep the transactional workflow verifier representative of production. Its
-- synthetic evaluators acknowledge this exact rubric through the public RPC;
-- the verifier's sentinel exception rolls these rows back with the fixture.
-- Patch the current definition instead of copying it so later repair clauses
-- (including the guarded application fixture claim) remain intact.
do $migration$
declare
  function_definition text;
  owner_submission text := 'perform * from rush.submit_evaluation(owner_assignment,ratings,''Owner evidence'');';
  panel_submission text := 'perform * from rush.submit_evaluation(panel_assignment,ratings,''Panel evidence'');';
begin
  select pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure)
  into function_definition;

  if position(owner_submission in function_definition) = 0
    or position(panel_submission in function_definition) = 0
  then
    raise exception 'could not add calibration acknowledgement to workflow verifier';
  end if;

  function_definition := replace(
    function_definition,
    owner_submission,
    'perform rush.acknowledge_round_calibration(round_id,rubric_id);' || chr(10) || '  ' || owner_submission
  );
  function_definition := replace(
    function_definition,
    panel_submission,
    'perform rush.acknowledge_round_calibration(round_id,rubric_id);' || chr(10) || '  ' || panel_submission
  );
  execute function_definition;
end;
$migration$;

revoke all on function rush.my_round_calibrations(text), rush.round_calibration_detail(text),
  rush.acknowledge_round_calibration(text,text) from public, anon;
grant execute on function rush.my_round_calibrations(text), rush.round_calibration_detail(text),
  rush.acknowledge_round_calibration(text,text) to authenticated, service_role;
revoke all on function rush.require_round_calibration_before_evaluation() from public, anon, authenticated;
