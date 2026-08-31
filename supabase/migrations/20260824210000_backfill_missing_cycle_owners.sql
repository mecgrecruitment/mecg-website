-- rush.grant_membership requires the caller to already hold an active
-- OWNER membership on the cycle, so a cycle created by direct insert
-- (bypassing rush.create_cycle, e.g. 20260824190000_bootstrap_fall_2026_cycle.sql)
-- can end up with no one able to grant roles in-app. Promote the earliest
-- active BOARD member to OWNER for any cycle currently missing one.
insert into rush.memberships (user_id, cycle_id, role, active)
select distinct on (m.cycle_id) m.user_id, m.cycle_id, 'OWNER'::rush.member_role, true
from rush.memberships m
where m.role = 'BOARD'
  and m.active
  and not exists (
    select 1 from rush.memberships o
    where o.cycle_id = m.cycle_id and o.role = 'OWNER' and o.active
  )
order by m.cycle_id, m.created_at asc
on conflict (user_id, cycle_id, role) do update set active = true, revoked_at = null;
