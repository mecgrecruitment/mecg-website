-- Reinstates 20260831194000, which was reverted by 20260831195000.
--
-- The original intent stands: src/lib/auth.ts:35 routes users with
--   .from("memberships").select("role, rush_cycles!inner(status)")
-- so a member who cannot read their own cycle row has the membership dropped by
-- the INNER JOIN and is routed to /apply as though they were an applicant.
--
-- The first attempt 500'd /member because making the row readable pushed RLS
-- evaluation onward into the applications/conflict_declarations loop. That loop
-- is fixed in 20260831196000, so the widening is safe now. Verified by reading
-- applications as a real BOARD member after applying.
drop policy if exists cycles_read_participant on rush.rush_cycles;
create policy cycles_read_participant on rush.rush_cycles
for select to authenticated
using (
  rush.has_cycle_capability(id, 'CANDIDATE_ACCESS')
  or rush.actor_has_application_in_cycle(id)
  or rush.has_cycle_role(id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
);
