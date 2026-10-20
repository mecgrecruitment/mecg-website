-- Preserve one-to-three applicant groups, independent evaluators, calibration,
-- session/table constraints and repeat-score checks. A participation row can
-- outlive withdrawal; it is insufficient evidence of current eligibility.
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
  -- Coordinate with withdrawal/status updates until this group's atomic
  -- membership and assignments have committed. Lock in a stable order.
  perform 1 from rush.applications
  where id = any(target_application_ids) order by id for share;
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
        and application.status not in ('DRAFT', 'WITHDRAWN')
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
revoke all on function rush.start_speed_dating_group(text,text[],integer,integer) from public, anon;
grant execute on function rush.start_speed_dating_group(text,text[],integer,integer) to authenticated, service_role;
