# Client close-out and feedback

Built November 18, 2026, on top of the engagement tracker (PR #18). Routes: the close-out panel on `/admin/projects` (board), `/feedback/<token>` (client, no sign-in), drafts in `/member/tools/evidence` (project lead). Migration: `supabase/migrations/20261118060000_client_closeout_feedback.sql`.

## What works

- A Closed project with a lead shows a **Client close-out** panel to the board. "Create feedback link" returns a one-time link. The board member copies it and sends it to the client themselves. **Nothing is emailed or sent by the site.**
- The link is shown once. Only a SHA-256 digest of its 256-bit token is stored. It works once and expires after 30 days. "Replace link" makes a new one and the old one stops working. "Cancel link" turns it off.
- The client form asks for:
  - satisfaction from 1 to 5
  - whether they would work with MECG again (Yes, Maybe or No)
  - an optional comment
  - optional permission to quote the comment and/or show their logo. If either is given, they must say where and how ("scope"), and can say how to credit them.
- When the client submits:
  - The link is used up.
  - The board panel shows the answers.
  - A **draft evidence entry** (`member_tool_records`, kind `evidence`) is created. The project lead owns it, in the cycle the board was working in when it made the link. It starts **Pending** verification and **Restricted** sharing. It holds the project title, a result line with the client's feedback, and the requested sharing scope.
- On submit, the database re-checks what the link was issued under. The project must still be Closed, and the draft goes to the **current** lead, who must still be an active member of that cycle. If the project was reopened or the lead left, the client sees "This feedback link is no longer active" and the link is **not** used up. Re-closing the project or assigning a new lead makes it work again.
- The draft lacks the required evidence fields (problem, approach, deliverable link, measurement). The evidence page labels it "Draft" and lists what's missing. The lead completes it with the normal form, which still requires every field.
- An evidence reviewer can't review a draft. The page hides the review form. The database also refuses to verify or clear a draft until the content is complete. `review_member_tool` is redefined with that one extra check, and its body is otherwise copied from the member-tools migration. A draft can still be marked Withdrawn.

## Access

| Who | Close-out panel | Create, replace or cancel link | Draft evidence |
|---|---|---|---|
| Active BOARD or OWNER member (any cycle, as in the engagement tracker) | Read all | Only in a cycle where they are BOARD or OWNER | No access from board rank alone |
| Project lead | No | No | Owns it (normal evidence rules) |
| Explicit evidence reviewer for that cycle | No | No | Reads it; can only review once it is complete |
| Anyone holding the token | Sees the project title and client label only | No | No |

- Making a link requires: the project is **Closed**, it has a lead, and that lead is an active MEMBER, BOARD, PANEL or OWNER in the chosen cycle. This means the draft lands where the lead can see it. Once feedback has been received, no new link can be made.
- The board panel shows the client's answers, including the comment (see "Defaults" below). The copy in the evidence library follows member-tools rules (owner and explicit reviewers only).
- No table grants or policies. All access goes through `SECURITY DEFINER` RPCs:
  - Board, actor-checked: `client_closeout_overview`, `create_client_feedback_link`, `revoke_client_feedback_link`.
  - Token-checked, callable by `anon`: `client_feedback_form`, `submit_client_feedback`.
- `/api/feedback/<token>` rate-limits by IP (the default 5 per 5 minutes bucket, `client-feedback:`). The RPCs are also reachable directly through PostgREST with the anon key. There, the token's 256 bits of entropy are the protection.
- The feedback page sets `noindex` and `referrer: no-referrer`. `/feedback` is disallowed in `robots.txt`.
- Audit events `CLIENT_FEEDBACK_LINK_CREATED`, `CLIENT_FEEDBACK_LINK_REVOKED` and `CLIENT_FEEDBACK_SUBMITTED` (actor null) record IDs, the lead, expiry and permission flags. The comment, scope and credit text are never copied into audit metadata.

## Defaults the owner may want to change

- **Board visibility:** every board member sees the client's full answers in the panel, including the comment, credit and scope. The spec didn't say either way. The narrower option is to show the board only the rating, the rehire answer and the permission flags. If you choose that, the comment would live only in the lead's evidence draft.
- **Questions:** satisfaction is on a 1 to 5 scale. Would-rehire is Yes, Maybe or No. The comment is optional, but it is required if quote permission is given. Both permissions default to off.
- The link lasts 30 days. This is set in `create_client_feedback_link`.
- One response per project. A reopened and re-closed project keeps its first response.
- The draft goes to the cycle the board member has selected on `/admin/projects`.

## Rollout

1. Merge and roll out the engagement tracker (PR #18) first. This migration depends on `rush.project_delivery` and the `engagement_is_board()` function.
2. Apply `20261118060000_client_closeout_feedback.sql` to a designated staging database through the normal migration process, then to production before or with the app deploy. Until it exists, the board panel shows "Client close-out is unavailable" and `/feedback/...` shows "temporarily unavailable".
3. Staging acceptance:
   - Close a staffed project with a lead and create a link.
   - Open it signed out in a private window and submit with a quote permission.
   - Confirm the link is now refused, the panel shows the answers, and the lead sees a Draft in Project evidence.
   - Confirm an evidence reviewer can't verify it until the lead completes it, and a board account without reviewer access can't see it.
   - Replace and cancel a second project's link and confirm the old links fail.
4. Don't send real client links until the board agrees who sends them and what the message says. The site never sends them.
5. Rollback: roll back the application. Don't drop `rush.client_feedback`, because responses live there. The `review_member_tool` redefinition is backward compatible: it only refuses non-Pending reviews of incomplete records, which the previous UI couldn't create.

## Verification

- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/engagement/closeout.test.ts src/lib/member-tools/model.test.ts src/app/api/projects/closeout/route.test.ts 'src/app/api/feedback/[token]/route.test.ts' src/proxy.test.ts src/app/seo-routes.test.ts src/app/api/unauthenticated-rejection.test.ts`
- `npm run verify:client-closeout` applies the member-tools, engagement-tracker and close-out migrations in a disposable, network-isolated PostgreSQL 17 container with minimal fixtures. It covers:
  - direct table denial
  - the preconditions (Closed, lead, lead in cycle, board in cycle)
  - non-board and anonymous denial for link management
  - digest-only storage, replacement and revocation of links, and expiry
  - the anon form with the right and wrong tokens
  - answer validation and one-time use
  - the draft's owner, cycle, kind, Pending/Restricted state and content
  - the board unable to read the draft
  - review refused until the draft is complete
  - audit metadata without the comment, scope or credit text
  - deactivated board denial

  It doesn't replay the full migration history or prove hosted Clerk/PostgREST integration.
- The workspace preview fixtures include one Closed project with no request and one with received feedback.
