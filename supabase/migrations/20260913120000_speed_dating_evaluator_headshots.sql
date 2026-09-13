-- Evaluators grading a Speed Dating pair need the face next to the name, and
-- until now only CANDIDATE_ACCESS opened a headshot. An evaluation_assignments
-- row for the application is the same evidence the applications_read_internal
-- policy accepts, so it opens the headshot too. The conflict recusal and the
-- null-path check still apply, and reads stay unaudited for the reason given
-- in 20260903120000_applicant_headshots.sql.
create or replace function rush.authorize_headshot_access(target_application_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  target_application rush.applications%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into target_application
  from rush.applications
  where id = target_application_id;

  if target_application.id is null then
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;
  if not rush.has_cycle_capability(target_application.cycle_id, 'CANDIDATE_ACCESS')
     and not exists (
       select 1 from rush.evaluation_assignments assignment
       where assignment.application_id = target_application.id and assignment.evaluator_id = actor
     ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if rush.actor_has_application_conflict(target_application.id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_application.headshot_storage_path is null then
    raise exception 'headshot not found' using errcode = 'P0002';
  end if;

  return target_application.headshot_storage_path;
end;
$$;
revoke all on function rush.authorize_headshot_access(text) from public, anon;
grant execute on function rush.authorize_headshot_access(text) to authenticated, service_role;

-- The Board round page needs to see open wrong-pair reports next to the pairs
-- they describe, so the setup payload now carries them. Pairs lock once the
-- round is active; the report is a prompt to confirm at the table, not a
-- rewrite. Same function otherwise.
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
        'status', pair.status,
        'applicationIds', members.application_ids
      ) order by pair.label)
      from rush.speed_dating_pairs pair
      cross join lateral (
        select jsonb_agg(member.application_id order by member.position) application_ids
        from rush.speed_dating_pair_members member
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pairId', pair.id,
        'pairLabel', pair.label,
        'evaluatorName', profile.display_name,
        'reportedAt', report.created_at
      ) order by report.created_at, pair.label)
      from rush.speed_dating_pair_reports report
      join rush.speed_dating_pairs pair on pair.id = report.pair_id
      join rush.profiles profile on profile.id = report.evaluator_id
      where pair.round_id = target_round_id and report.status = 'OPEN'
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function rush.speed_dating_pair_setup(text) from public, anon;
grant execute on function rush.speed_dating_pair_setup(text) to authenticated, service_role;

-- Every read of rush.rounds, rubrics and rubric_criteria by a plain MEMBER or
-- PANEL evaluator has been refused since 20260830090000: the participant
-- policies grant CANDIDATE_ACCESS (Board, Owner, Committee) or an applicant in
-- the cycle, and nothing else. /member/speed-dating therefore reported "no
-- round" and /member's inner join on rounds returned no assignments for the
-- people who grade. Rounds and rubrics carry no applicant data, so any active
-- member of the cycle may read them.
drop policy if exists rounds_read_cycle_member on rush.rounds;
create policy rounds_read_cycle_member on rush.rounds for select to authenticated
using (rush.has_cycle_role(cycle_id, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[]));

drop policy if exists rubrics_read_cycle_member on rush.rubrics;
create policy rubrics_read_cycle_member on rush.rubrics for select to authenticated
using (exists (
  select 1 from rush.rounds r
  where r.id = rubrics.round_id
    and rush.has_cycle_role(r.cycle_id, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[])
));

drop policy if exists rubric_criteria_read_cycle_member on rush.rubric_criteria;
create policy rubric_criteria_read_cycle_member on rush.rubric_criteria for select to authenticated
using (exists (
  select 1 from rush.rubrics ru
  join rush.rounds r on r.id = ru.round_id
  where ru.id = rubric_criteria.rubric_id
    and rush.has_cycle_role(r.cycle_id, array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[])
));
