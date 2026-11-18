# Engagement tracker

Built November 18, 2026. Routes: `/admin/projects` (board), `/member/projects` (project leads). Migration: `supabase/migrations/20261118030000_engagement_tracker.sql`.

## What works

- Each project in `rush.projects` gets a delivery record:
  - status: Scoping, Active, Final or Closed
  - milestones with due and done dates
  - risks and blockers, each Open or Resolved
  - last client contact date and a note
  - the lead's weekly health flag (On track, At risk, Off track) with a note and when it was set
- The board view starts with a summary: projects by status, at risk or off track, health not set this week, open blockers, overdue milestones. Each project card shows the lead, next milestone, open blockers and health. "Edit delivery" opens the forms.
- A health flag older than seven days, or never set, is marked "over a week old" and counted in the summary. Milestone dates use the Detroit calendar day.
- Moving a project to Closed stamps `closed_at` once; reopening clears it. The board or the lead may close a project (feature 2, client close-out, keys off this).
- Changing the lead clears the previous lead's health flag; the new lead starts unset.
- The health flag is a single-writer stamp by the lead and does not take or bump the delivery revision, so recording health never invalidates an open delivery edit.
- Delivery saves use optimistic revisions. A stale edit is refused with "Delivery record changed. Reload before saving." and the form keeps its values.

## Access

| Who | Read | Edit delivery | Set health | Assign lead |
|---|---|---|---|---|
| Active BOARD or OWNER member (any cycle, like the existing project RPCs) | All projects | Yes | No | Yes |
| Project lead (assigned by the board, still staffed on the project, active) | Own project only | Own project | Own project | No |
| Other members, staffed or not | Nothing | No | No | No |

- Only the lead sets the weekly health flag ("lead-set"). The board can't overwrite it. A board member who is also the lead can set it.
- A lead must be staffed on the project. If staffing later removes them, they lose access at once. The board card then shows "no longer staffed, reassign".
- No table grants or policies. All access goes through actor-checked `SECURITY DEFINER` RPCs: `engagement_tracker`, `save_project_delivery`, `set_project_health`, `set_project_lead`, and `engagement_leads_any`, the nav hint that shows "Projects I lead" only to current leads.
- Audit events (`PROJECT_DELIVERY_SAVED`, `PROJECT_HEALTH_SET`, `PROJECT_LEAD_SET`) record status, health level, revision, milestone count, open-blocker count and the lead ID. Free-text notes are never copied into audit metadata.
- Delivery records are board operating data, not private member-tool records. The member-tools rule that board rank alone never unlocks those records still holds; the owner's spec for this feature is "Board sees all".
- Delivery notes are internal. Nothing here reaches the public `/work` pages. `public_projects()` is unchanged.

## Rollout

1. Apply the migration to a designated staging database through the normal migration process. Then apply it to production before or with the app deploy. Until the RPC exists, both pages show "Delivery tracking is unavailable" and the nav link stays hidden. The existing project editor keeps working.
2. Staging acceptance:
   - Board staffs a project and assigns a staffed member as lead.
   - The lead opens `/member/projects`, edits milestones, risks and contact, and records health.
   - A second staffer and an unstaffed member see nothing.
   - The board can't set health. A stale edit conflicts.
   - Remove the lead from staffing and confirm their access ends.
3. No data is seeded. Projects start as Scoping with no lead.
4. Rollback: roll back the application. Don't drop `rush.project_delivery`, because delivery history lives there.

## Verification

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/engagement/model.test.ts src/app/api/projects/delivery/route.test.ts src/lib/workspace-navigation.test.ts src/components/workspace-nav.test.ts`
- `npm run verify:engagement-tracker` runs the migration in a disposable, network-isolated PostgreSQL 17 container with minimal identity, membership and project fixtures. It covers:
  - the access matrix above
  - direct table denial
  - stale-revision refusal
  - closed_at stamping, health cleared on lead change, duplicate item ids refused
  - validation (unknown keys, injected health or lead, bad dates and statuses, empty milestones, bad risk kinds)
  - lead-only health
  - lead loss on unstaffing
  - deactivated board denial
  - anonymous denial
  - audit metadata without note text

  It doesn't replay the full migration history or prove hosted Clerk/PostgREST integration.
- The workspace preview fixtures include three fictional engagements for visual review of `/admin/projects` and `/member/projects`.
