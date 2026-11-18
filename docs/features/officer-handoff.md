# Officer handoff

`/admin/handoffs` (nav: "Officer handoffs", in the admin tools after Projects) gives each officer change a checklist, from the outgoing officer to the incoming one.

## What works

- Start a handoff: role (for example Treasurer), outgoing officer, incoming officer (can be chosen later), an optional hand-over-by date and notes.
- A new handoff starts with a suggested checklist in three groups: Accounts, Access to reassign and Open items. Every line can be edited, removed or added to (up to 40).
- Tick items as they are done. Each tick records who ticked it and when. Unticking clears both.
- Status is In progress, Complete or Cancelled. Complete needs an incoming officer and every item ticked, and records the completion time. Reopening clears it.
- Each handoff shows, live, the elevated roles (Owner, Board, Panel, Recruitment committee, by cycle) and member-tool reviewer grants that the outgoing officer still holds and the incoming officer already holds. That is how the board checks that Owner and reviewer grants really moved.
- In-progress handoffs are listed first, soonest due first. Finished ones follow, newest first, with their form behind an Edit disclosure.
- There is no delete. A handoff that will not happen is set to Cancelled.

## Access

- Data lives in `rush.officer_handoffs` and `rush.officer_handoff_items`, with RLS forced, no policies and no table grants.
- Reads and writes go only through `rush.officer_handoffs()` and `rush.save_officer_handoff(target_id, expected_revision, payload)`. Both are SECURITY DEFINER functions that check that the caller is an active BOARD or OWNER member (in any cycle) with an active profile. Members, Recruitment Committee and panel-only members get nothing, including the officers named on a handoff if they are not board.
- Handoffs are org-wide, like Projects and the decision log. The page uses the selected cycle only to keep the workspace navigation in context.
- An officer must be an active profile with at least one active membership. An officer who has left since stays on the handoff that already names them, but cannot be newly chosen.
- The access list reads `rush.memberships` and `rush.member_tool_reviewers` only. It never reads `rush.member_tool_records`, so board rank still unlocks no private member-tool record. This page does not change roles or grants. The Owner still does that in Settings and with the Owner controls in each member tool.
- Writes carry an optimistic revision for the whole handoff. A stale save, or an item removed by someone else, gets a 409 and asks the user to reload. Saving an unchanged form creates no new revision.
- Every create and edit writes `rush.audit_events` (`OFFICER_HANDOFF_CREATED`, `OFFICER_HANDOFF_UPDATED`, resource `OfficerHandoff`). The metadata holds the status, the two officers' profile ids, the due date, item and ticked counts, the revision and the names of changed fields. It never holds the role title, notes, item labels or item notes. These events have no `cycle_id`, so the cycle-scoped Activity page does not list them.
- The form says not to store passwords or recovery codes. The database cannot enforce that.

## Rollout

1. Review and merge the PR.
2. Apply `supabase/migrations/20261118150000_officer_handoff.sql` to staging. It depends on `20261112120000_member_operations_tools.sql` (for `rush.member_tool_reviewers`). Check that a board account can start a handoff, tick items and complete it, that the access list matches Settings, and that a member account is redirected away from `/admin/handoffs` and gets a 403 from `POST /api/board/handoffs`.
3. Apply the migration to production. Until it is applied, the page shows "Officer handoffs are unavailable" and shows no data.

## Verification

- `npm run verify:officer-handoff`: applies the member-tools migration and this migration to a disposable PostgreSQL 17 container (no network) and checks access by role, the people list, validation, item order and tick tracking, completion rules, revisions and the no-op save, departed officers, that the access list never includes member-tool records, and that audit metadata holds no content.
- Unit tests: `src/lib/officer-handoff/model.test.ts` (form and response parsing, status and kind lists match the migration, the starter checklist), `src/app/api/board/handoffs/route.test.ts` (auth, validation before the database, RPC arguments, error mapping) and `src/components/officer-handoffs.test.ts` (rendered states).
- Not verified: hosted Clerk and PostgREST, staging acceptance.

## Owner decisions (defaults chosen)

- Only active board members and owners can see or edit handoffs. Should the incoming officer, who may still be a plain member, be able to see and tick their own handoff?
- Any board member edits any handoff, including ticking items for someone else. Ticks are attributed to whoever saved them.
- The board sees which member-tool reviewer grants each officer holds (tool and cycle only). Until now only the cycle Owner saw this list. Is that acceptable?
- The starter checklist is the list in `starterItems` in `src/lib/officer-handoff/model.ts`. Role-specific templates (for example a Treasurer list) are not built.
- There is no delete and no automatic retention.
- A Complete handoff can only be saved while every item stays ticked. To add or untick an item, reopen it first; completing it again records a new completion time.
- A lost response on "Start handoff" can lead to a duplicate if the user retries without reloading (the form says to reload first). There is no idempotency key, the same as the decision log.
- The incoming officer is not notified. Who tells them, and how, stays with the board.
