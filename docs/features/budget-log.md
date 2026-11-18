# Budget and reimbursement log

Members ask the board for money, and the board records what it decided and when the money was paid. It is an approval log only. The site never moves money, stores no bank or card details and sends no messages.

- `/member/budget` (member nav: "Budget requests"): send a request and follow your own.
- `/admin/budget` (board nav: "Budget"): every request, totals, approve or deny, record payment.

## What works

- A member sends one of two kinds of request: **Pay me back** (a reimbursement; the date they paid is required) or **Approve before I buy** (a purchase approved in advance; the date is optional). Each request has a title, budget area (Events, Recruitment, Client work, Marketing, Operations, Other), amount in USD ($0.01 to $10,000.00, stored as whole cents), an optional https receipt link and optional notes.
- The requester edits a request in full while it waits for a decision. After approval they can only add or change the receipt link, because a purchase approved in advance gets its receipt afterwards. They can withdraw a request while it waits or after approval until it is paid.
- The board sees every request: those waiting first, then approved and not paid, then paid, denied and withdrawn. It also sees totals (waiting, approved and not paid, paid) and can filter by status.
- A board member approves (optional note) or denies (a reason is required; the member sees it) a waiting request, and records an approved request as paid with the date and an optional note on how it was paid ("Club Venmo, check 1042").
- **Nobody acts on their own request.** A board member's own request has to be approved and recorded as paid by another board member or an owner.
- Nothing is deleted. Denied, paid and withdrawn requests stay closed. A withdrawn request keeps its approval details if it had any.

## Access

- Data lives in `rush.budget_requests` with RLS forced, no policies and no table grants.
- Access goes only through SECURITY DEFINER functions that check the caller on every call:
  - `rush.my_budget_requests()` and `rush.save_budget_request(target_id, expected_revision, payload)`: any active member with an active profile, in any cycle and any role except PANEL alone. A member only ever reads or edits their own requests. Someone else's request id returns "not found", so ids cannot be probed.
  - `rush.budget_request_log()`: active BOARD or OWNER only.
  - `rush.act_on_budget_request(target_id, expected_revision, action, payload)`: `WITHDRAW` for the requester; `APPROVE`, `DENY` and `MARK_PAID` for board or owner, refused on the caller's own request.
- The log is org-wide, like Projects and the decision log, because club money is not a recruitment-cycle record. Pages use the selected cycle only to keep the workspace navigation in context.
- The API routes live under `/api/member/budget` and `/api/member/budget/actions`, which the proxy already protects. They repeat the role checks and validate input before the database call.
- Writes carry an optimistic revision. A stale save gets a 409 and asks the user to reload. Saving an unchanged form creates no new revision.
- Every write adds a row to `rush.audit_events` (resource `BudgetRequest`; actions `BUDGET_REQUEST_SUBMITTED`, `_UPDATED`, `_WITHDRAWN`, `_APPROVED`, `_DENIED`, `_PAID`). The metadata holds the kind, budget area, amount, status, paid date, revision and the names of changed fields. It never holds the title, notes, receipt link, decision note or payment note. These events have no `cycle_id`, so the cycle-scoped Activity page does not list them.
- Receipt links are stored as typed. The log does not change who can open the linked file.

## Rollout

1. Review and merge the PR.
2. Apply `supabase/migrations/20261118190000_budget_requests.sql` to staging. Check that a member can send, edit and withdraw a request; that a board member can approve, deny and record payment for someone else's request but not their own; and that a panel-only account sees the explanation and gets a 403 from `POST /api/member/budget`.
3. Apply the migration to production. Until it is applied, both pages show "unavailable" and no data.
4. Tell members where to send requests (the board decides who sends that message).

## Verification

- `npm run verify:budget-log`: applies the migration to a disposable PostgreSQL 17 container (no network) and checks access by role, own-request isolation, the no-self-approval rule, every status step and refusal, validation, revisions, the no-op save and that audit metadata contains no request text.
- Unit tests: `src/lib/budget/model.test.ts` (dollar parsing, form and response parsing, totals, board order, allowed steps, and that the kind, area and status lists match the migration), `src/app/api/member/budget/route.test.ts` and `src/app/api/member/budget/actions/route.test.ts` (auth, validation before the database, RPC arguments, error mapping), and `src/components/budget-requests.test.ts` (rendered states for member and board).
- Not verified: hosted Clerk and PostgREST, staging acceptance.

## Owner decisions (defaults chosen)

- Who can send requests: every active member except panel-only accounts (same rule as staffing availability). Should it be narrower, for example board and project leads only?
- No self-approval and no self-recorded payment. With a single active board member, that person's own requests cannot move. Is that the right rule, or should owners be exempt?
- The same board member may both approve a request and record it paid. Only the requester is excluded. Should approver and payer be different people?
- A receipt link is optional at every step: a reimbursement can be approved and recorded paid without one, and once paid the request is closed, so a receipt can't be added afterwards. Should recording payment on a reimbursement require a receipt?
- The $10,000 cap per request, the six budget areas and USD only. Changing any of them needs a migration.
- The board sees every request in full, including notes and the receipt link. This is deliberately the opposite of the member-tools default, where board rank alone unlocks nothing private: deciding on club money needs the details. Totals are all-time; there is no per-term budget or spending limit.
- Dates are not checked against today or against each other, so a mistyped future date, or a paid date before the approval, is accepted.
- Access is org-wide: an active membership in any cycle counts. The board page still needs a workspace cycle for its navigation, like the other board pages.
- A denied request cannot be reopened; the member sends a new one.
- There is no retention or deletion.
