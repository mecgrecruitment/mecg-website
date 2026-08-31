-- Reverts 20260831194000. Letting staff read their own cycle made a previously
-- unreachable row readable, which pushed RLS evaluation onward into
-- rush.applications and from there into conflict_declarations, surfacing a
-- latent policy loop:
--   ERROR 42P17 infinite recursion detected in policy for relation "conflict_declarations"
-- /member returned 500 for every member. Caught by `npm run verify:auth`.
--
-- The underlying misrouting (staff of a not-yet-active cycle route to /apply
-- because src/lib/auth.ts INNER JOINs rush_cycles) is real and still open, but
-- it cannot be fixed by widening this policy until the applications and
-- conflict_declarations policies are themselves recursion-free.
drop policy if exists cycles_read_participant on rush.rush_cycles;
create policy cycles_read_participant on rush.rush_cycles
for select to authenticated
using (
  rush.has_cycle_capability(id, 'CANDIDATE_ACCESS')
  or rush.actor_has_application_in_cycle(id)
);
