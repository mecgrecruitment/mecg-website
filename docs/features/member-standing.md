# Member standing

Built November 18, 2026. Route: `/admin/standing` (board). Thresholds: `/admin/settings#member-standing`. Migration: `supabase/migrations/20261118070000_member_standing.sql`.

## What works

- A read-only rollup, per cycle, of each active member:
  - events attended out of events held this cycle, with the percentage (`rush.member_checkins`)
  - projects staffed (`rush.project_members`)
  - onboarding items done out of total (`rush.member_onboarding_items`)
  - a standing of Active or At risk, with the reasons (Low attendance, Not staffed, Onboarding open)
- A summary line counts active members, at-risk members and each reason. At-risk members are listed first, then by name.
- Thresholds are per cycle and set in Cycle settings:

  | Threshold | Default | Range | Off |
  |---|---|---|---|
  | Minimum attendance, % of held events | 50 | 0–100 | 0 |
  | Minimum projects staffed | 1 | 0–10 | 0 |
  | Onboarding must be complete | Yes | Yes/No | No |

  The defaults are owner-adjustable starting points, not a club policy. The page says when the defaults are still in use. They live in two places that must agree: the column defaults in the migration and `DEFAULT_THRESHOLDS` in `src/lib/standing/model.ts`.
- Definitions:
  - **Members**: active profiles with an active membership in the cycle, in any role except PANEL alone (panelists can be outside judges). Board and Owner members are included.
  - **Events held**: the cycle's Published or Closed events that have already started. Draft, cancelled and future events don't count. Before any event is held, attendance is not judged.
  - **Attendance at the threshold passes** (2 of 4 at 50% is active). The exact ratio is compared, so 49.6% doesn't round up to 50%.
  - **Projects**: every project the member is staffed on. Projects are org-wide in this schema, so this isn't limited to the cycle.
  - **Onboarding**: the checklist from the member's most recently accepted offer. Members with no checklist (for example, they joined before onboarding was tracked) show "Not tracked" and are never flagged for it.
- Threshold saves use an optimistic revision. A stale save is refused with "Thresholds changed. Reload before saving."

## Access

| Who | Read standing | Edit thresholds |
|---|---|---|
| Active BOARD or OWNER member of the cycle (active profile) | That cycle | That cycle |
| Board or owner of a different cycle only | No | No |
| Members, panel, recruitment committee | No | No |

- No table grants or policies on `rush.member_standing_settings`. Access is only through the actor-checked `SECURITY DEFINER` RPCs `member_standing(cycle)` and `save_member_standing_thresholds(...)`. The page and the API route also check `MANAGE_CYCLE` (Board or Owner of the cycle) before calling them.
- The rollup returns counts only. No event names, check-in times, project titles or onboarding owners leave the database. It reads no member-tool records, so the member-tools rule that board rank alone never unlocks private records still holds.
- Threshold saves write a `MEMBER_STANDING_THRESHOLDS_SET` audit event with the new values and revision. Reading the rollup isn't audited; it is the same data the board already sees in check-in, staffing and onboarding screens.

## Rollout

1. Apply the migration to a designated staging database through the normal migration process, then to production before or with the app deploy. Until the RPC exists, `/admin/standing` shows "Member standing could not be loaded" and the thresholds form says they can't be changed. Nothing else is affected.
2. Staging acceptance:
   - As a board member of the cycle, open Member standing. Check the counts against a member you know (check-ins, staffing, onboarding).
   - Save new thresholds in Cycle settings and confirm the flags change. Save again from a stale tab and confirm the conflict.
   - As a member, and as board of another cycle only, confirm `/admin/standing` is refused.
3. No data is seeded. Each cycle uses the defaults until the board saves thresholds.
4. Rollback: roll back the application. Dropping `rush.member_standing_settings` loses only saved thresholds.

## Owner decisions

- The default thresholds above (50% attendance, 1 project, onboarding complete).
- Whether Board and Owner members belong in the rollup (included now) and whether PANEL-only members should be (excluded now).
- Whether project participation should count only projects active this semester. That needs the engagement tracker's status (PR #18); today every staffed project counts.

## Verification

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/standing/model.test.ts src/app/api/admin/standing/route.test.ts src/components/member-standing.test.ts src/lib/workspace-navigation.test.ts src/lib/workspace-cycle-url.test.ts`
- `npm run verify:member-standing` runs the migration in a disposable, network-isolated PostgreSQL 17 container with minimal fixtures. It covers:
  - the access matrix above, including another cycle's owner, panel-only, inactive and anonymous callers
  - direct table and helper denial
  - the member set (panel-only, inactive profiles and revoked memberships excluded)
  - events held (draft, cancelled, future and other-cycle events excluded)
  - onboarding from the latest accepted offer, declined offers ignored, untracked as null
  - counts-only output keys
  - threshold validation, stale-revision refusal, per-cycle isolation and audit metadata

  It doesn't replay the full migration history or prove hosted Clerk/PostgREST integration.
