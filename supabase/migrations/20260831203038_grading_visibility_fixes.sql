-- Review follow-up for member event grading: two silent-empty-result gaps.
-- 1. PANEL had no rush.events select policy, so the hash/deliberation pages'
--    event_impressions -> events!inner join dropped every impression row for
--    exactly the HASH_PANEL_ACCESS audience.
-- 2. rush.checkins was readable only by the pnm owner and BOARD/OWNER, so a
--    RECRUITMENT_COMMITTEE admin saw an empty live attendance dashboard.
-- Both get a cycle-staff read policy alongside the existing ones.

create policy events_read_cycle_staff on rush.events
for select to authenticated
using (
  rush.has_cycle_role(
    cycle_id,
    array['BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  )
);

create policy checkins_read_cycle_staff on rush.checkins
for select to authenticated
using (
  rush.has_cycle_role(
    rush.event_cycle_id(event_id),
    array['BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  )
);;
