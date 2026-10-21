-- Control for the harness: the rewritten applications_read_internal with its
-- conflict guard removed. The harness must report a difference against "new".
drop policy if exists applications_read_internal on rush.applications;
create policy applications_read_internal on rush.applications
for select to authenticated
using (
  cycle_id in (select rush.actor_cycles_with_role(array['BOARD', 'PANEL', 'OWNER']::rush.member_role[]))
  or (cycle_id in (select rush.actor_cycles_with_capability('CANDIDATE_ACCESS')) and not coalesce(cycle_id in (select rush.actor_active_screening_reviewer_cycles()), false))
  or (id in (select rush.actor_assigned_application_ids()) and not coalesce(cycle_id in (select rush.actor_active_screening_reviewer_cycles()), false))
);
