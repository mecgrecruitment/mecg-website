-- Control for the harness: the rewritten decisions_read_owner_or_panel with
-- its conflict guard removed. The harness must report a difference against
-- "new" (a panelist who declared a conflict would see that decision).
drop policy if exists decisions_read_owner_or_panel on rush.decisions;
create policy decisions_read_owner_or_panel on rush.decisions
for select to authenticated
using (
  (status = 'RELEASED'::rush.decision_status and application_id in (select rush.actor_owned_application_ids()))
  or cycle_id in (select rush.actor_cycles_with_role(array['PANEL', 'OWNER']::rush.member_role[]))
);
