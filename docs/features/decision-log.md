# Board decision log

`/admin/decisions` (nav: Decisions, under the admin tools next to Projects) is a dated record of board decisions.

## What works

- Record a decision: date, a one-line title, category (Membership, Recruitment, Finance, Clients, Operations, Policy, Other), outcome (Approved, Rejected, Deferred, Noted without a vote, Withdrawn), an optional summary, the vote (for, against, abstained) or "no vote", and an optional https link to the minutes.
- The log lists entries newest first, with search over title and summary and filters for category and outcome.
- Each entry shows who recorded it and who last edited it, and when.
- Edit any entry. There is no delete: a wrong entry is corrected or set to Withdrawn, so the record keeps its history.

## Access

- Data lives in `rush.board_decisions`, with RLS forced, no policies and no table grants.
- Reads and writes go only through `rush.board_decision_log()` and `rush.save_board_decision(target_id, expected_revision, payload)`. Both are SECURITY DEFINER functions that check the caller is an active BOARD or OWNER member (in any cycle) with an active profile. Members, Recruitment Committee and panel-only members get nothing.
- The log is org-wide, like Projects, because a board decision is not a recruitment-cycle record. The page uses the selected cycle only to keep the workspace navigation in context.
- Writes carry an optimistic revision. A stale save gets a 409 and asks the user to reload. Saving an unchanged form creates no new revision.
- Every create and edit writes `rush.audit_events` (`BOARD_DECISION_RECORDED`, `BOARD_DECISION_UPDATED`, resource `BoardDecision`). The metadata holds the date, category, outcome, vote counts, whether there is a minutes link, the revision and the names of the changed fields. It never holds the title, summary or link. These events have no `cycle_id`, so the cycle-scoped Activity page does not list them. They can be read from the database.
- The minutes link is stored as typed. The log does not change who can open the linked document.

## Rollout

1. Review and merge the PR.
2. Apply `supabase/migrations/20261118130000_board_decision_log.sql` to staging. Check that a board account can record and edit an entry, and that a member account is redirected away from `/admin/decisions` and gets a 403 from `POST /api/board/decisions`.
3. Apply the migration to production. Until it is applied, the page shows "The decision log is unavailable" and shows no data.

## Verification

- `npm run verify:decision-log`: applies the migration to a disposable PostgreSQL 17 container (no network) and checks access by role, validation, revisions, the no-op save, ordering and that audit metadata leaks no content.
- Unit tests: `src/lib/decisions/model.test.ts` (form and response parsing, filters, and that category and outcome lists match the migration), `src/app/api/board/decisions/route.test.ts` (auth, validation before the database, RPC arguments, error mapping) and `src/components/decision-log.test.ts` (rendered states).
- Not verified: hosted Clerk and PostgREST, staging acceptance.

## Owner decisions (defaults chosen)

- Categories and outcomes are the lists above. Changing them needs a migration.
- Votes are recorded as counts, not by name.
- Every active board member and owner can edit every entry, including entries other people recorded. Edits are audited.
- There is no delete and no automatic retention.
- The date is not checked against today, so a mistyped future date is accepted. Should future dates be refused?
