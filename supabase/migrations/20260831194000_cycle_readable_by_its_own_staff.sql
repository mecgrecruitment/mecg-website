-- A member could not read the cycle they are a member of.
--
-- cycles_read_participant admitted only CANDIDATE_ACCESS (which is gated on the
-- cycle being active) or holding an application in the cycle. Nothing covered
-- "I am staff of this cycle". src/lib/auth.ts:35 routes users with
--   .from("memberships").select("role, rush_cycles!inner(status)")
-- so an unreadable cycle row silently drops the membership from an INNER JOIN,
-- and the member is routed to /apply as though they were an applicant.
--
-- Surfaced by `npm run verify:auth`, whose fixture cycle is status DRAFT. Real
-- staff on the live OPEN cycle are unaffected today, which is why nobody hit it,
-- but the misrouting is real for any cycle that is not yet active.
--
-- has_cycle_role is SECURITY DEFINER, so this adds no policy recursion: the
-- rush_cycles policy calls a definer helper rather than re-entering RLS.
drop policy if exists cycles_read_participant on rush.rush_cycles;
create policy cycles_read_participant on rush.rush_cycles
for select to authenticated
using (
  rush.has_cycle_capability(id, 'CANDIDATE_ACCESS')
  or rush.actor_has_application_in_cycle(id)
  or rush.has_cycle_role(id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
);
