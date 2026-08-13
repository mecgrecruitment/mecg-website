# Member Signup Board Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allowlisted signups create a pending `membership_requests` row instead of an instant `members` grant — every path to member access requires an explicit board approval click. Recruit/applicant signup is unaffected.

**Architecture:** One SQL migration changes `fn_handle_new_auth_user()`'s allowlist-match branch from `insert into members` to `insert into membership_requests (..., status='pending')`. Because the board approval queue, `/auth/request-access` status page, and `approveMembership()`/`denyMembership()` are already generic over `membership_requests` rows regardless of origin, no other backend code changes. `supabase/seed.sql` currently *relies* on the old auto-grant behavior to seed board/test member accounts (confirmed while researching this plan — its own comment says so, and `supabase/tests/rls_phase0.sql` reads `public.members` rows for those exact seeded emails) — it must be updated in the same change or local dev and the RLS smoke tests break. Finally, `/apply/dashboard` gets a small additive banner surfacing pending/approved/denied status for a signed-in user, since allowlisted signups now land there instead of skipping straight to `/internal`.

**Tech Stack:** Next.js (App Router, Server Actions), Supabase (Postgres + Auth), plain SQL migrations (no ORM), no JS test framework installed — SQL is tested via raw `psql` smoke scripts under `supabase/tests/` (the repo's existing convention, see `supabase/tests/rls_phase0.sql`); UI changes are verified via `next build` (typecheck) and manual browser check (no vitest/RTL in this repo — do not add one for this change).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-member-signup-board-approval-design.md` — authoritative for behavior.
- Recruit/applicant signup (`/apply/*`, `candidates` table) must not change — no approval gate there.
- No changes to `request_membership()` RPC, `approveMembership()`/`denyMembership()`, `/auth/request-access` page, or RLS policies — all already generic over `membership_requests` rows.
- Local Supabase stack must already be running (`supabase start`) to run any of the manual verification steps below.
- Match existing SQL style: lowercase keywords, comment banners (`-- ── N. ... ──`), `security definer` + `set search_path = public` on functions that need it (copy exactly from the function being replaced).

---

### Task 1: Migration — allowlist match creates a pending request, not an instant grant

**Files:**
- Create: `supabase/migrations/20260610000012_member_signup_requires_approval.sql`
- Create: `supabase/tests/member_signup_approval.sql`

**Interfaces:**
- Consumes: existing `public.invite_allowlist` (columns: `email`, `role public.member_role`, `expires_at`, `consumed_at`), existing `public.membership_requests` (columns: `user_id`, `email`, `full_name`, `requested_role public.member_role`, `status public.membership_request_status`), existing `public.member_role` and `public.membership_request_status` enums.
- Produces: replaces `public.fn_handle_new_auth_user()` (same name/signature, `AFTER INSERT ON auth.users FOR EACH ROW` trigger already wired up by migration 5 — this task does not touch the trigger declaration, only `create or replace function`). Later tasks (2, 3) depend on this new behavior existing.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260610000012_member_signup_requires_approval.sql`:

```sql
-- Phase 0 · Migration 12: member signups require explicit board approval.
-- An invite_allowlist match no longer auto-grants a `members` row on signup;
-- it now creates a pending `membership_requests` row, reviewed through the
-- existing board approval queue (approveMembership()/denyMembership() in
-- app/internal/members/actions.ts, surfaced at /internal/members and
-- /auth/request-access). Recruit/applicant signup (no allowlist match) is
-- unaffected — they stay member-less exactly as before.

create or replace function public.fn_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow public.invite_allowlist%rowtype;
begin
  select * into v_allow
    from public.invite_allowlist ia
   where lower(ia.email) = lower(new.email)
     and ia.consumed_at is null
     and (ia.expires_at is null or ia.expires_at > now())
   limit 1;

  -- No allowlist row ⇒ this is an applicant, not a member. Leave them
  -- member-less; current_member_role() returns NULL ⇒ applicant routing.
  if found then
    insert into public.membership_requests (user_id, email, full_name, requested_role, status)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
      ),
      v_allow.role,
      'pending'
    );

    update public.invite_allowlist
       set consumed_at = now()
     where id = v_allow.id;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 2: Apply the migration to the running local stack**

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/20260610000012_member_signup_requires_approval.sql`
Expected: `CREATE FUNCTION` (no errors). This only replaces the function on whatever local DB is currently running — it does not touch existing rows.

- [ ] **Step 3: Write the failing-then-passing smoke test**

Create `supabase/tests/member_signup_approval.sql`:

```sql
-- Smoke test: an invite_allowlist match creates a pending membership_requests
-- row, not an instant members row. Run against the LOCAL stack only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/member_signup_approval.sql
-- Everything runs inside one transaction and rolls back. Prints PASS on success;
-- any failure aborts with an exception (ON_ERROR_STOP).

\set ON_ERROR_STOP on

begin;

insert into public.invite_allowlist (email, role, notes)
values ('pending-test@umich.edu', 'recruitment_committee', 'signup-approval smoke test');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pending-test@umich.edu',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Pending Tester'),
  now(),
  now(),
  '', '', '', '', '', '', '', ''
);

select set_config('test.new_uid', (select id::text from auth.users where email = 'pending-test@umich.edu'), false);

do $$
declare
  n_members  int;
  n_requests int;
  v_status   public.membership_request_status;
  v_consumed timestamptz;
begin
  select count(*) into n_members from public.members
   where user_id = current_setting('test.new_uid')::uuid;
  if n_members <> 0 then
    raise exception 'FAIL: allowlist match granted an instant members row';
  end if;

  select count(*), min(status) into n_requests, v_status from public.membership_requests
   where user_id = current_setting('test.new_uid')::uuid;
  if n_requests <> 1 or v_status <> 'pending' then
    raise exception 'FAIL: expected exactly one pending membership_requests row, got % (status %)', n_requests, v_status;
  end if;

  select consumed_at into v_consumed from public.invite_allowlist
   where email = 'pending-test@umich.edu';
  if v_consumed is null then
    raise exception 'FAIL: invite_allowlist row was not consumed';
  end if;

  raise notice 'PASS: allowlist match created a pending membership_requests row and consumed the invite';
end $$;

rollback;
```

- [ ] **Step 4: Run the smoke test and verify it passes**

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/member_signup_approval.sql`
Expected: `NOTICE:  PASS: allowlist match created a pending membership_requests row and consumed the invite`, then `ROLLBACK` — no `FAIL` exception, no `ERROR`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260610000012_member_signup_requires_approval.sql supabase/tests/member_signup_approval.sql
git commit -m "feat(auth): allowlist signup creates a pending membership request, not an instant member grant"
```

---

### Task 2: Fix seed.sql — seeded/test accounts must still end up as members

**Files:**
- Modify: `supabase/seed.sql:24-26` (comment), `supabase/seed.sql:79-84` (insert block)

**Interfaces:**
- Consumes: Task 1's new trigger behavior (seeded accounts now get a *pending* `membership_requests` row from the trigger instead of a `members` row — this task grants `members` directly instead, bypassing the trigger's new pending-request side effect, matching how this file already bypasses normal signup for `auth.users`/`auth.identities`).
- Produces: nothing new consumed by later tasks; this task's only consumer is `supabase/tests/rls_phase0.sql`, which is unmodified and must still pass.

- [ ] **Step 1: Update the now-stale comment**

In `supabase/seed.sql`, find (around line 23-26):

```sql
-- ── 2. Auth users (password: password123) ────────────────────────────────────
-- Direct GoTrue-shaped inserts; the signup-gate trigger passes because the
-- allowlist exists, and the AFTER INSERT trigger creates public.members rows
-- with the allowlist role and consumes each allowlist entry.
-- Token columns are empty strings, not NULL — GoTrue scans crash on NULLs.
```

Replace with:

```sql
-- ── 2. Auth users (password: password123) ────────────────────────────────────
-- Direct GoTrue-shaped inserts; the signup-gate trigger passes because the
-- allowlist exists. The AFTER INSERT trigger now creates a *pending*
-- membership_requests row per allowlist match (board approval required —
-- see migration 12) and consumes each allowlist entry; section 3 below
-- grants these seeded accounts member access directly instead, since seed
-- data represents already-approved members, not a pending queue.
-- Token columns are empty strings, not NULL — GoTrue scans crash on NULLs.
```

- [ ] **Step 2: Grant seeded accounts member access directly, replacing the old auto-grant**

In `supabase/seed.sql`, find (around line 81-84):

```sql
-- ── 3. Board members are already public on the site ─────────────────────────
update public.members
   set is_public = true
 where role = 'board';
```

Replace with:

```sql
-- ── 3. Grant seeded/test accounts member access directly ────────────────────
-- Local seed data already bypasses normal signup (direct auth.users insert
-- above); do the same for member grant instead of relying on the signup
-- trigger, which now only creates a pending membership_requests row (see
-- migration 12). These accounts represent already-approved members, so grant
-- membership directly and drop the trigger's pending rows for them.
insert into public.members (user_id, email, full_name, role)
select au.id, au.email, au.raw_user_meta_data ->> 'full_name', ia.role
from auth.users au
join public.invite_allowlist ia on lower(ia.email) = lower(au.email);

delete from public.membership_requests mr
using public.invite_allowlist ia
where lower(mr.email) = lower(ia.email);

-- Board members are already public on the site.
update public.members
   set is_public = true
 where role = 'board';
```

- [ ] **Step 3: Reset the local database and verify seeding succeeds**

Run: `npm run db:reset`
Expected: completes without error, ending with the standard `supabase db reset` success output (seed script runs to completion, including the later sections that join on `public.members` for `board01.test@umich.edu`, e.g. `recruitment_cycles`, `application_questions`, `candidates` — these would silently no-op or fail if the members grant above didn't work, so a clean full-success run is the signal here).

- [ ] **Step 4: Run the existing RLS smoke test and verify it still passes**

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_phase0.sql`
Expected: prints its `PASS` lines through to the end, no `FAIL` exception, no `ERROR` (this file reads `public.members` for `board01.test@umich.edu`, `committee.test@umich.edu`, `member.test@umich.edu` — proving the seeded accounts are still real members, not stuck pending).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "fix(seed): grant seeded/test accounts member access directly, not via the now-pending signup trigger"
```

---

### Task 3: Surface membership-request status on the applicant dashboard

**Files:**
- Modify: `app/apply/dashboard/page.tsx:1-38` (imports + top of component + locked-view return), `app/apply/dashboard/page.tsx:83-85` (main-view return)

**Interfaces:**
- Consumes: `requireApplicant()` from `@/lib/auth` (already imported; returns `{ id, email, fullName }` — `id` is the `auth.users`/`membership_requests.user_id` value), `createClient()` from `@/lib/supabase/server` (already imported).
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Query the user's membership_requests row and build the banner**

In `app/apply/dashboard/page.tsx`, find (lines 30-36):

```tsx
  const applicant = await requireApplicant();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: appRows } = await supabase.rpc("my_application");
  const application = Array.isArray(appRows) ? appRows[0] : null;
```

Replace with:

```tsx
  const applicant = await requireApplicant();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: appRows } = await supabase.rpc("my_application");
  const application = Array.isArray(appRows) ? appRows[0] : null;

  const { data: membershipRequest } = await supabase
    .from("membership_requests")
    .select("status")
    .eq("user_id", applicant.id)
    .maybeSingle();

  const MEMBERSHIP_STATUS_COPY: Record<string, string> = {
    pending: "Your board membership request is pending review. We'll email you once it's decided.",
    approved: "Your board membership request was approved — log out and back in to enter the member portal.",
    denied: "Your board membership request wasn't approved.",
  };

  const membershipBanner = membershipRequest ? (
    <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-white/80">
      {MEMBERSHIP_STATUS_COPY[membershipRequest.status]}{" "}
      <a href="/auth/request-access" className="underline hover:text-white">
        View request status.
      </a>
    </div>
  ) : null;
```

- [ ] **Step 2: Render the banner in the locked ("Thank you") view**

In `app/apply/dashboard/page.tsx`, find (lines 38-41):

```tsx
  if (application) {
    return (
      <div className="grid gap-8">
        <div className="mb-6">
```

Replace with:

```tsx
  if (application) {
    return (
      <div className="grid gap-8">
        {membershipBanner}
        <div className="mb-6">
```

- [ ] **Step 3: Render the banner in the main dashboard view**

In `app/apply/dashboard/page.tsx`, find (lines 83-86):

```tsx
  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
```

Replace with:

```tsx
  return (
    <div className="grid gap-8">
      {membershipBanner}
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `app/apply/dashboard/page.tsx`.

- [ ] **Step 5: Manual verification**

With the local stack running (`npm run dev` + `supabase start`, DB already reset from Task 2):
1. Sign up a fresh account (`/auth/signup`) with an email you've added to `invite_allowlist` locally (e.g. `insert into public.invite_allowlist (email, role) values ('manual-check@umich.edu', 'recruitment_committee');` via psql, then confirm the account's email — local Supabase auto-confirms or use the Inbucket/mail trap at `http://127.0.0.1:54324`).
2. Log in as that account. Expect: redirected to `/apply/dashboard` (not `/internal`), with the orange "Your board membership request is pending review..." banner visible above the dashboard content.
3. Click "View request status." — lands on `/auth/request-access` showing the same pending status (existing page, unmodified).
4. Log in as a seeded board account (`board01.test@umich.edu` / `password123`) at `/internal/members`, approve the pending request for `manual-check@umich.edu`.
5. Log out, log back in as `manual-check@umich.edu`. Expect: redirected to `/internal` (now a real member), dashboard banner no longer applicable.

- [ ] **Step 6: Commit**

```bash
git add app/apply/dashboard/page.tsx
git commit -m "feat(apply): show membership-request status banner on the applicant dashboard"
```
