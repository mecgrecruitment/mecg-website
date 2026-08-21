drop policy assignments_read_evaluator_or_manager on rush.evaluation_assignments;
create policy assignments_read_evaluator_or_manager on rush.evaluation_assignments for select to authenticated
using (
  evaluator_id = auth.uid()
  or exists (
    select 1 from rush.rounds r where r.id = evaluation_assignments.round_id
    and rush.has_cycle_role(r.cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[])
  )
);
