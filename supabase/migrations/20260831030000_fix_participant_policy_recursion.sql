-- The live migration ledger includes 20260830090000, but that migration was edited after it was
-- applied. Production therefore retained the original inline applications/pnms subqueries in
-- these participant policies. Evaluating one of those subqueries re-enters applications RLS and
-- raises PostgreSQL 42P17 (infinite recursion). Use the existing postgres-owned security-definer
-- helper so applicant ownership is checked without evaluating applications RLS again.

drop policy if exists cycles_read_participant on rush.rush_cycles;
create policy cycles_read_participant on rush.rush_cycles for select to authenticated
using (
  rush.has_cycle_capability(id, 'CANDIDATE_ACCESS')
  or rush.actor_has_application_in_cycle(id)
);
drop policy if exists rounds_read_cycle_participant on rush.rounds;
create policy rounds_read_cycle_participant on rush.rounds for select to authenticated
using (
  rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')
  or rush.actor_has_application_in_cycle(cycle_id)
);
drop policy if exists rubrics_read_cycle_participant on rush.rubrics;
create policy rubrics_read_cycle_participant on rush.rubrics for select to authenticated
using (
  exists (
    select 1
    from rush.rounds r
    where r.id = rubrics.round_id
      and (
        rush.has_cycle_capability(r.cycle_id, 'CANDIDATE_ACCESS')
        or rush.actor_has_application_in_cycle(r.cycle_id)
      )
  )
);
drop policy if exists rubric_criteria_read_cycle_participant on rush.rubric_criteria;
create policy rubric_criteria_read_cycle_participant on rush.rubric_criteria for select to authenticated
using (
  exists (
    select 1
    from rush.rubrics ru
    join rush.rounds r on r.id = ru.round_id
    where ru.id = rubric_criteria.rubric_id
      and (
        rush.has_cycle_capability(r.cycle_id, 'CANDIDATE_ACCESS')
        or rush.actor_has_application_in_cycle(r.cycle_id)
      )
  )
);
drop policy if exists events_read_participant on rush.events;
create policy events_read_participant on rush.events for select to authenticated
using (
  rush.has_cycle_capability(cycle_id, 'EVENTS')
  or rush.actor_has_application_in_cycle(cycle_id)
);
