# Opportunity rollup (board pipeline rollup)

Built November 18, 2026. Route: `/admin/opportunities` (board). Migration: `supabase/migrations/20261118110000_pipeline_rollup.sql`. Named "Opportunities" because `/admin` already has a recruitment "pipeline".

## What works

- For one cycle, the board sees how many member pipeline records (the private member tool at `/member/tools/pipeline`) sit in each stage, split by type (Client, Sponsor):
  - a summary: total opportunities, Client, Sponsor, past due
  - a table with a row for each stage (Research, Qualified, Conversation, Proposal, Agreed, Dormant, Closed) and columns for Client, Sponsor, Total and Past due
- **Past due**: the record's next-action date is before today in Detroit time. A Closed record is never past due. A record with no next-action date is never past due. A date due today isn't past due yet.
- A record whose stage or type is no longer offered counts in the total only, and the page says how many there are. Saves validate both fields, so there should be none. A stored date that isn't valid doesn't break the rollup; that record just isn't counted as past due.
- A board member who is **already a pipeline reviewer** for the cycle also sees a list of the past-due records: title, stage, type, due date and owner, with a link to the pipeline. Reviewers can already open every pipeline record, so this shows them nothing new.
- Read-only. No writes, no table, no audit events.

## Access

| Who | Counts | Past-due titles |
|---|---|---|
| Active BOARD or OWNER member of the cycle (active profile) | That cycle | Only if they also hold pipeline reviewer access for that cycle |
| Board or owner of a different cycle only | No | No |
| Members (including record owners), panel, recruitment committee | No | No |

- Access is only through the actor-checked `SECURITY DEFINER` RPC `rush.pipeline_rollup(cycle)`. The page also checks `MANAGE_CYCLE` (Board or Owner of the cycle) before calling it.
- Without reviewer access the response holds counts only: no record ids, titles, owners, problems, links, contacts or dates. The page parser also refuses any response that carries extra fields, or a title list for a non-reviewer, and shows "could not be loaded" instead.
- Reviewer access is the existing member-tools grant (`rush.member_tool_reviewers`, kind `pipeline`) that a cycle Owner gives on the pipeline page. Owner or board rank alone never shows titles, so the member-tools rule still holds: board rank alone never unlocks private member-tool records. An evidence or lab grant doesn't count, and nor does a pipeline grant in another cycle. Revoking a grant removes the titles on the next load.
- Reads aren't audited. `member_tool_workspace` reads aren't audited either.

## Rollout

1. Apply the migration to a designated staging database through the normal migration process, then to production before or with the app deploy. Until the RPC exists, `/admin/opportunities` shows "Opportunity counts could not be loaded". Nothing else changes.
2. Staging acceptance:
   - Member A adds pipeline records in a few stages, one with a past next-action date and one Closed with a past date.
   - As a board member of the cycle, open Opportunities. Check the counts and that only the open past-date record is past due. Confirm that no titles appear.
   - Have the cycle Owner grant that board member pipeline reviewer access. Reload and confirm the past-due list. Revoke it and confirm the list disappears.
   - As a member, and as board of another cycle only, confirm `/admin/opportunities` is refused.
3. Nothing is seeded.
4. Rollback: roll back the application. Dropping the function has no data impact.

## Owner decisions (defaults in place)

- Small counts can still hint at a deal. For example, "1 Sponsor in Agreed" is a count, not a name. The spec allows counts. If that's too revealing, a minimum cell size could hide counts below 3.
- Only Closed records are excluded from past due. Dormant records with a past date still count. Exclude Dormant too?
- "Today" is Detroit time, the same as the rest of the site.
- Who should hold pipeline reviewer access. No grants are made by this change.

## Verification

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/opportunities/model.test.ts src/components/pipeline-rollup.test.ts src/lib/workspace-navigation.test.ts src/lib/workspace-cycle-url.test.ts`
- `npm run verify:pipeline-rollup` loads the member-tools bootstrap, the member-tools migration and this migration into a disposable, network-isolated PostgreSQL 17 container. It covers:
  - the access matrix above, including an owner without a grant, another cycle's board, members who own records, panel-only, an inactive profile, a revoked membership, no actor and anonymous callers
  - no title, problem, link or record id anywhere in a board-only payload, and exactly the expected keys
  - counts per stage and type, a full 14-cell grid in form order, and an empty cycle
  - past due: past open records count; today, Closed, undated, future, unclassified and invalid-date records don't
  - the reviewer list: overdue records only, ordered by date, with only the listed fields. It isn't unlocked by an evidence grant or another cycle's grant, and revocation removes it.
  - other kinds and other cycles excluded; direct table access denied

  Two deliberate mutations made it fail: giving every board member the reviewer list, and counting Closed records as past due. It doesn't replay the full migration history or prove hosted Clerk/PostgREST integration.
- UI preview (`PREVIEW_PIPELINE_REVIEWER=1` shows the reviewer view) at 1440 and 390: no horizontal overflow, no page errors.
