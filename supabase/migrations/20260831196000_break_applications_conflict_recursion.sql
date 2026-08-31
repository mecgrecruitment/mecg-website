-- Board and panel members cannot read rush.applications at all. Any read raises
--   ERROR 42P17 infinite recursion detected in policy for relation "applications"
-- so /admin, /member and the applicant dossier 500 for staff. Reproduced against
-- the live database as a real BOARD member, with no local changes in play.
--
-- The loop is mutual, and both halves are inline subqueries that re-enter RLS:
--   applications_read_internal  -> EXISTS (SELECT ... FROM rush.conflict_declarations ...)
--   conflicts_read_own_or_manager -> EXISTS (SELECT ... FROM rush.applications ...)
-- Each policy's subquery triggers the other policy, forever.
--
-- The repository copies of these policies were already rewritten to route
-- through SECURITY DEFINER helpers, which is the correct shape, but the deployed
-- database never received that rewrite: rush.actor_is_assigned_evaluator does not
-- exist in the database at all, even though 20260830090000 and 20260830100000
-- both define it and both are recorded as applied. The migration files were
-- edited after they were applied, so the ledger says converged and the schema is
-- not. That drift is the real root cause and is worth a separate look.
--
-- This migration makes the deployed schema match the intended shape. Semantics
-- are preserved exactly; only the evaluation path changes, from re-entrant
-- subqueries to definer helpers that bypass RLS and therefore terminate.

-- Missing entirely from the database. Definer, so reading evaluation_assignments
-- from inside a policy cannot re-enter that table's own RLS.
create or replace function rush.actor_is_assigned_evaluator(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.evaluation_assignments ea
    where ea.application_id = target_application_id and ea.evaluator_id = auth.uid()
  );
$$;

revoke all on function rush.actor_is_assigned_evaluator(text) from public;
grant execute on function rush.actor_is_assigned_evaluator(text) to authenticated, service_role;

-- The other half of the loop. conflict_declarations must be able to ask "does
-- the actor manage this application's cycle" without reading rush.applications
-- through RLS.
create or replace function rush.actor_manages_application_cycle(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rush.applications a
    where a.id = target_application_id
      and rush.has_cycle_role(a.cycle_id, array['BOARD','OWNER']::rush.member_role[])
  );
$$;

revoke all on function rush.actor_manages_application_cycle(text) from public;
grant execute on function rush.actor_manages_application_cycle(text) to authenticated, service_role;

-- Same three branches and the same conflict exclusion as the deployed policy,
-- with the inline conflict_declarations subquery replaced by its definer helper.
-- The blind-screening exclusions are carried over unchanged.
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

-- Same two branches as before, with the inline applications subquery replaced.
drop policy if exists conflicts_read_own_or_manager on rush.conflict_declarations;
create policy conflicts_read_own_or_manager on rush.conflict_declarations
for select to authenticated
using (
  declarer_id = auth.uid()
  or rush.actor_manages_application_cycle(conflict_declarations.application_id)
);
