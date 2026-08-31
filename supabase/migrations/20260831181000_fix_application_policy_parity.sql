-- The originally deployed 20260830100000 migration predates the helper-based
-- applications policy now present in the repository copy. Reapply that policy
-- in a forward migration so linked databases and clean local replays converge.
drop policy if exists applications_read_internal on rush.applications;
create policy applications_read_internal on rush.applications
for select to authenticated
using (
  not rush.actor_has_application_conflict(applications.id)
  and (
    rush.has_cycle_role(cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
    or (
      rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')
      and not rush.is_active_screening_reviewer(cycle_id)
    )
    or (
      rush.actor_is_assigned_evaluator(applications.id)
      and not rush.is_active_screening_reviewer(cycle_id)
    )
  )
);
