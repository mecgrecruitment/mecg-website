# Staffing planner

Built November 18, 2026. Routes: `/member/staffing` (members enter availability) and `/admin/staffing` (board reads the plan). API: `POST /api/member/staffing`. Migration: `supabase/migrations/20261118090000_staffing_planner.sql`.

## What works

- **Members** enter, once per cycle and editable any time:
  - hours a week for client work (whole number, 0–40; 0 means not this cycle)
  - skills (comma-separated, up to 12, each up to 40 characters; trimmed, and repeats that differ only in case are dropped)
  - up to 3 ranked project choices from the project list
  - optional notes for the board (up to 500 characters)

  The form says that only the member and the board of the cycle see it.
- **Board** (`/admin/staffing`) sees every member of the cycle with:
  - hours, skills, notes and ranked choices, or "Not submitted"
  - the projects they are staffed on now (`rush.project_members`)
  - a load label: Open to staff (hours, no project), Staffed, Staffed, no hours (0 hours but on a project), No hours this cycle, Not submitted
  - a summary (members, submitted, total hours, open to staff), a "most wanted projects" list (how many want each project, how many are staffed on it) and a skill filter (`?skill=`, case-insensitive, matches part of a skill)
  - Order: open first, then staffed, then no hours, then not submitted. Within each group, fewer current projects first, then more hours, then name.
- Assignment itself is unchanged. The plan links to `/admin/projects`, where the board still sets `project_members`.
- Saves use an optimistic revision. A save from a stale tab is refused with "Your availability changed in another tab. Reload before saving."

## Access

| Who | Own availability | Board plan |
|---|---|---|
| Active member of the cycle, any role except PANEL alone (active profile) | Read and write, that cycle | No |
| Active BOARD or OWNER of the cycle | Read and write their own | That cycle |
| Board or owner of a different cycle only | Only in their own cycle | No |
| Panel-only, inactive profile, revoked membership, signed out | No | No |

- No table grants or policies on `rush.staffing_availability`. Access is only through the actor-checked `SECURITY DEFINER` RPCs `my_staffing_availability(cycle)`, `save_my_staffing_availability(...)` and `staffing_plan(cycle)`. The board cannot write a member's availability.
- The page and route also check first: `/admin/staffing` needs `MANAGE_CYCLE` (Board or Owner of the cycle); the API route refuses anyone without a non-panel active membership in the cycle.
- Saves write a `STAFFING_AVAILABILITY_SAVED` audit event with the revision only. Skills, choices and notes are not copied into audit metadata. Reading the plan isn't audited.
- This isn't a member-tool record and reads none, so the rule that board rank alone never unlocks private member-tool records still holds.

## Rollout

1. Apply the migration to a designated staging database through the normal migration process, then to production before or with the app deploy. Until the RPCs exist, both pages say the data could not be loaded. Nothing else is affected.
2. Staging acceptance:
   - As a member, save availability, reload, change it and save again. Save from a second, stale tab and confirm the conflict message.
   - As a board member of the cycle, open Staffing and check the member's hours, skills, choices and current projects. Try the skill filter.
   - As a member, and as board of another cycle only, confirm `/admin/staffing` is refused.
3. No data is seeded. Members start as "Not submitted". Telling members to fill it in is the board's call; this feature sends nothing.
4. Rollback: roll back the application. Dropping `rush.staffing_availability` loses only the entered availability.

## Owner decisions

- **"Per semester" is per cycle.** Availability is stored per workspace cycle (the cycle switcher). If a cycle doesn't match a semester, the board should say which it wants.
- Who counts as a member: any active non-panel-only membership, so Board, Owner and recruitment committee members can enter availability too.
- Current load counts every project a member is staffed on, because projects are org-wide here. Counting only active projects needs the engagement tracker's status (PR #18).
- Preferences are project choices plus free-text notes. There are no hours per project, so load is a project count, not committed hours.

## Verification

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/staffing/model.test.ts src/app/api/member/staffing/route.test.ts src/components/staffing-plan.test.ts src/lib/workspace-navigation.test.ts src/lib/workspace-cycle-url.test.ts`
- `npm run verify:staffing-planner` runs the migration in a disposable, network-isolated PostgreSQL 17 container with minimal fixtures. It covers:
  - the access matrix above, including another cycle's owner, panel-only, inactive, revoked and anonymous callers
  - direct table and helper denial
  - validation: hours, skill count, length, blanks and type, project count, repeats and unknown projects, notes length
  - skill clean-up, a stale first save from a second tab, a wrong revision, and per-cycle separation
  - the board's member set, project staff counts, output keys, and audit metadata that carries the revision only
  - a deleted project dropping out of the plan

  It doesn't replay the full migration history or prove hosted Clerk/PostgREST integration.
