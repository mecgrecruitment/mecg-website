-- Form Group Case teams in one click: every applicant enrolled in the
-- cycle's published Group Case round who is not yet in a case group gets
-- dealt at random into ceil(n / group_size) new teams, so sizes differ by
-- at most one. Teams are lettered (Team A, Team B, ...) continuing after
-- the cycle's existing groups because the member roster sorts groups by
-- name as text and 'Team 10' would sort before 'Team 2'. Re-running only
-- places whoever is still unplaced; manual assign_case_group still works.

create or replace function rush.form_case_groups(target_cycle_id text, group_size integer default 3)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_round_id text;
  applicant_ids text[];
  group_ids text[] := '{}';
  new_group_id text;
  existing_count integer;
  unplaced_count integer;
  group_count integer;
  n integer;
begin
  if not rush.has_cycle_capability(target_cycle_id, 'CASE_GROUPS') then raise exception 'forbidden' using errcode = '42501'; end if;
  if group_size is null or group_size < 2 or group_size > 10 then raise exception 'group size must be 2 to 10' using errcode = '22023'; end if;

  select id into case_round_id from rush.rounds
  where cycle_id = target_cycle_id and kind = 'GROUP_CASE' and status in ('PUBLISHED', 'ACTIVE')
  order by created_at desc limit 1;
  if case_round_id is null then raise exception 'no Group Case round is published' using errcode = '55000'; end if;

  select array_agg(participation.application_id) into applicant_ids
  from rush.round_participations participation
  join rush.applications application on application.id = participation.application_id
  where participation.round_id = case_round_id
    and application.status not in ('DRAFT', 'WITHDRAWN')
    and not exists (
      select 1 from rush.case_group_members member
      join rush.case_groups existing on existing.id = member.group_id
      where existing.cycle_id = target_cycle_id and member.application_id = participation.application_id
    );
  unplaced_count := coalesce(cardinality(applicant_ids), 0);
  if unplaced_count = 0 then return 0; end if;

  select count(*) into existing_count from rush.case_groups where cycle_id = target_cycle_id;
  group_count := ceil(unplaced_count::numeric / group_size);
  for i in 1..group_count loop
    n := existing_count + i;
    insert into rush.case_groups (cycle_id, name, prompt)
    values (target_cycle_id, 'Team ' || case when n <= 26 then chr(64 + n) else n::text end, '')
    returning id into new_group_id;
    group_ids := group_ids || new_group_id;
  end loop;

  insert into rush.case_group_members (group_id, application_id)
  select group_ids[ntile(group_count) over (order by random())], application_id
  from unnest(applicant_ids) as application_id;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (rush.actor_id(), target_cycle_id, 'CASE_GROUPS_FORMED', 'RushCycle', target_cycle_id,
    jsonb_build_object('groups', group_count, 'applicants', unplaced_count, 'groupSize', group_size));
  return group_count;
end;
$$;
revoke all on function rush.form_case_groups(text, integer) from public, anon;
grant execute on function rush.form_case_groups(text, integer) to authenticated, service_role;
