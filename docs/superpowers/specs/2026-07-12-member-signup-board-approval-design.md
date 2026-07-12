# Member signup requires board approval; recruit signup stays self-serve

## Problem

`fn_handle_new_auth_user()` (the `auth.users` insert trigger) currently grants
instant, unapproved access when a new signup's email matches a live
`invite_allowlist` row: it inserts straight into `public.members` and the
account has full member/committee/board privileges the moment they verify
their email. No board member ever clicks anything.

Recruit (applicant) signup has no such gate today and should keep none —
anyone can sign up and land in the `/apply/*` flow to submit a rush
application.

Goal: every path to member access requires an explicit board approval,
including allowlisted signups. Recruit signup is unaffected.

## Current building blocks (unchanged, reused as-is)

- `public.membership_requests` — `pending` / `approved` / `denied`, unique
  per `user_id`.
- `request_membership()` RPC — self-serve "request access" after signup
  (`/auth/request-access`), already produces a `pending` row.
- `approveMembership()` / `denyMembership()` in
  `app/internal/members/actions.ts` — board-only (`requireBoard()`), reads a
  `membership_requests` row by id, inserts the `members` row on approve.
  Already generic over how the row was created.
- `/auth/request-access` (`app/auth/request-access/page.tsx`) — shows the
  signed-in user's own `membership_requests` status (`STATUS_COPY` map).
  Already generic over how the row was created.
- `login()` in `app/auth/actions.ts` — redirects to `/internal` if
  `current_member_role()` is non-null, else `/apply/dashboard`. Unaffected.

Because the review queue, approve/deny actions, and status page are already
generic over `membership_requests` rows regardless of origin, this change is
scoped to how the row gets created — not to any of the above.

## Change 1 — trigger: pending request instead of instant grant

File: `supabase/migrations/<new>_member_signup_requires_approval.sql`,
`create or replace function public.fn_handle_new_auth_user()`.

Current allowlist-match branch:

```sql
if found then
  insert into public.members (user_id, email, full_name, role)
  values (new.id, new.email, coalesce(...), v_allow.role);

  update public.invite_allowlist set consumed_at = now() where id = v_allow.id;
end if;
```

New behavior:

```sql
if found then
  insert into public.membership_requests (user_id, email, full_name, requested_role, status)
  values (new.id, new.email, coalesce(...), v_allow.role, 'pending');

  update public.invite_allowlist set consumed_at = now() where id = v_allow.id;
end if;
```

- `full_name` coalesce logic is unchanged (from `raw_user_meta_data` or
  derived from the email local-part).
- `invite_allowlist.role` is already typed `public.member_role`, same as
  `membership_requests.requested_role` — no clamping needed, it's a
  board-authored value, not user input.
- The allowlist row is still consumed at signup time (one signup = one
  consumption), regardless of the board's eventual decision. A denied or
  expired case is handled the same way a manual request would be: the user
  can be re-invited, or use `/auth/request-access` directly.
- No allowlist match: branch is unchanged — user stays member-less
  (recruit/applicant path via `/apply/*`).
- `membership_requests.user_id` is `unique`; a brand-new `auth.users` row
  can't already have one, so this is a plain insert, not an upsert.

## Change 2 — surface pending status on the applicant dashboard

File: `app/apply/dashboard/page.tsx`.

Previously an allowlisted signup skipped this page entirely (redirected
straight to `/internal`). Now they land here like any recruit, with an
invisible `pending` `membership_requests` row. Add a small status banner,
above the existing dashboard sections, when a `membership_requests` row
exists for the current user:

- Query `membership_requests` by `user_id` (same shape as
  `/auth/request-access`'s query).
- If a row exists, render a banner using the same `pending` / `approved` /
  `denied` copy as `STATUS_COPY` in `app/auth/request-access/page.tsx`, with
  a link to `/auth/request-access` for the full status view and (once
  denied) the ability to submit a fresh request.
- If no row exists, dashboard renders exactly as it does today — this is
  purely additive.

## Out of scope

- Recruit/applicant signup (`/apply/*`, `candidates` table) — already
  self-serve, no approval step, unaffected by this change.
- `request_membership()` RPC, `approveMembership()`/`denyMembership()`,
  `/auth/request-access` page, RLS policies on `membership_requests` or
  `members` — all already generic, no code changes needed.
- Any new "recruiter" role/table — clarified during brainstorming that
  "recruiter" meant "recruit" (rush applicant), which already has its own
  self-serve flow.

## Testing

- Migration: seed an `invite_allowlist` row, sign up with that email,
  assert a `membership_requests` row is created with `status = 'pending'`
  and the allowlist row's `consumed_at` is set, and assert **no** `members`
  row is created until a board member approves via
  `approveMembership()`.
- `/apply/dashboard`: render with a pending `membership_requests` row
  present vs. absent, assert the banner shows/hides correctly.
