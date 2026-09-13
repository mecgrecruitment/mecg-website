-- At Speed Dating every member present meets every applicant face to face, so
-- the face is not a secret from them. The search list on /member/speed-dating
-- shows a headshot before a member has any evaluation_assignments row, and
-- until now that read was refused. Any active MEMBER, BOARD, PANEL or OWNER of
-- the application's cycle may now open the headshot as long as the applicant
-- is in a published or active Speed Dating round; the participation check
-- keeps it scoped to applicants actually in the round. The conflict recusal
-- still applies after it, so a conflicted member still gets nothing.
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
     )
     and not (
       rush.has_cycle_role(target_application.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
       and exists (
         select 1
         from rush.round_participations participation
         join rush.rounds round on round.id = participation.round_id
         where participation.application_id = target_application.id
           and round.kind = 'SPEED_DATING'
           and round.status in ('PUBLISHED','ACTIVE')
       )
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
