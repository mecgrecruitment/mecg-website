create or replace function rush.board_can_view_resume(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.applications a
    where a.resume_storage_path = target_path
      and (
        rush.has_cycle_role(a.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
        or (
          rush.has_cycle_capability(a.cycle_id, 'CANDIDATE_ACCESS')
          and not rush.is_active_screening_reviewer(a.cycle_id)
        )
      )
      and not rush.actor_has_application_conflict(a.id)
  );
$$;
revoke all on function rush.board_can_view_resume(text) from public,anon;
grant execute on function rush.board_can_view_resume(text) to authenticated;
