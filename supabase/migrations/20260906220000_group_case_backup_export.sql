-- Produce the identity and rubric contract for an offline Group Case scoring
-- sheet. Rating cells stay blank: this endpoint is a pre-event emergency
-- backup, not a way to disclose drafts or submitted scores.

create or replace function rush.export_group_case_backup(
  target_cycle_id text,
  target_round_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  cycle_name text;
  active_rubric_id text;
  active_rubric_version integer;
  file_id uuid := gen_random_uuid();
  result jsonb;
begin
  if actor is null or not rush.has_cycle_role(
    target_cycle_id,
    array['BOARD', 'OWNER']::rush.member_role[]
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into round_row
  from rush.rounds
  where id = target_round_id and cycle_id = target_cycle_id;
  if round_row.id is null then
    raise exception 'round missing' using errcode = 'P0002';
  end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'round must be Group Case' using errcode = '22023';
  end if;
  if round_row.status not in ('PUBLISHED', 'ACTIVE') then
    raise exception 'Group Case backup is available only while the round is published or active' using errcode = '55000';
  end if;

  select cycle.name into cycle_name
  from rush.rush_cycles cycle
  where cycle.id = target_cycle_id;

  select rubric.id, rubric.version
  into active_rubric_id, active_rubric_version
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;
  if active_rubric_id is null then
    raise exception 'rubric missing' using errcode = 'P0002';
  end if;

  with candidate_applications as (
    select member.application_id
    from rush.case_group_members member
    join rush.case_groups case_group on case_group.id = member.group_id
    where case_group.cycle_id = target_cycle_id
    union
    select participation.application_id
    from rush.round_participations participation
    where participation.round_id = target_round_id
    union
    select assignment.application_id
    from rush.evaluation_assignments assignment
    where assignment.round_id = target_round_id
  ), backup_rows as (
    select
      case_group.id as group_id,
      case_group.name as group_name,
      assignment.id as assignment_id,
      assignment.evaluator_id,
      evaluator.display_name as evaluator_name,
      application.id as application_id,
      applicant.name as applicant_name,
      coalesce(assignment.status::text, 'UNASSIGNED') as status
    from candidate_applications candidate
    join rush.applications application
      on application.id = candidate.application_id
     and application.cycle_id = target_cycle_id
    join rush.pnms applicant on applicant.id = application.pnm_id
    left join rush.case_group_members member on member.application_id = application.id
    left join rush.case_groups case_group
      on case_group.id = member.group_id
     and case_group.cycle_id = target_cycle_id
    left join rush.evaluation_assignments assignment
      on assignment.round_id = target_round_id
     and assignment.application_id = application.id
    left join rush.profiles evaluator on evaluator.id = assignment.evaluator_id
  )
  select jsonb_build_object(
    'fileId', file_id::text,
    'cycleId', target_cycle_id,
    'cycleName', cycle_name,
    'roundId', target_round_id,
    'roundName', round_row.name,
    'rubricVersion', active_rubric_version,
    'exportedAt', now(),
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', criterion.id,
        'key', criterion.key,
        'name', criterion.name,
        'weight', criterion.weight,
        'required', criterion.required,
        'position', criterion.position
      ) order by criterion.position)
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
    ), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'groupId', row.group_id,
        'groupName', coalesce(row.group_name, 'Unassigned group'),
        'assignmentId', row.assignment_id,
        'evaluatorId', row.evaluator_id,
        'evaluatorName', coalesce(row.evaluator_name, 'Unassigned judge'),
        'applicationId', row.application_id,
        'applicantName', row.applicant_name,
        'status', row.status
      ) order by row.group_name nulls first, row.applicant_name, row.evaluator_name nulls first)
      from backup_rows row
    ), '[]'::jsonb)
  ) into result;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    actor,
    target_cycle_id,
    'GROUP_CASE_BACKUP_EXPORTED',
    'Round',
    target_round_id,
    jsonb_build_object(
      'fileId', file_id,
      'format', 'CSV',
      'rubricVersion', active_rubric_version,
      'rowCount', jsonb_array_length(result->'rows')
    )
  );

  return result;
end;
$$;

revoke all on function rush.export_group_case_backup(text, text) from public, anon;
grant execute on function rush.export_group_case_backup(text, text) to authenticated, service_role;
