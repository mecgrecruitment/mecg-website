# MECG Website

The website and recruitment system for the Michigan Economics Consulting Group. It is one Next.js app serving three zones: the public marketing site, an applicant portal where candidates apply and check in, and an internal portal where members run recruitment (scoring, hash sessions, decisions, audit log). Everything behind the marketing site is backed by Supabase — Postgres, Auth, and Storage.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Supabase — Postgres + Auth + Storage |
| Validation | Zod |
| Marketing visuals | Native Web Animations API, Three.js (`@react-three/fiber` + `drei`) |

## Prerequisites

- **Node.js ≥ 20.9** (Next 16's minimum; 22 LTS is fine)
- **Supabase CLI** — `brew install supabase/tap/supabase`
- **Docker** running — the local Supabase stack (Postgres, Auth, Storage) runs in containers

## Local setup

```bash
git clone <this repo> && cd mecg-website
npm install

# Boots local Postgres + Auth + Storage and applies all migrations + seed data.
supabase start

# Fill in the keys that `supabase start` just printed (re-print anytime with `supabase status`):
#   API URL     -> NEXT_PUBLIC_SUPABASE_URL
#   anon key    -> NEXT_PUBLIC_SUPABASE_ANON_KEY
#   service_role-> SUPABASE_SERVICE_ROLE_KEY
cp .env.example .env.local

npm run dev
```

Open http://127.0.0.1:3000. (Use `127.0.0.1`, not `localhost` — it's what `NEXT_PUBLIC_SITE_URL` and the Supabase redirect allow-list default to.)

`supabase/seed.sql` creates synthetic local test logins (password `password123`), including `board01.test@umich.edu` (board), `committee.test@umich.edu` (recruitment committee), and `member.test@umich.edu` (general member).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting files |
| `npm run audit` | Run lint, typecheck, and a production build once |
| `npm run audit:loop` | Repeat the audit every 30 seconds (`AUDIT_INTERVAL_SECONDS=60 npm run audit:loop` to change the interval) |
| `npm run test:e2e` | Build and run Playwright smoke tests locally |
| `E2E_BASE_URL=https://example.com npm run test:e2e:live` | Run the same smoke tests against a deployment |
| `npm run db:reset` | Drop + re-apply all migrations and the seed |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local DB |

## Architecture

```
app/                      <- the live App Router tree (repo root, NOT src/app)
  (external)/             <- public marketing site (about, team, services, recruitment, ...)
  apply/                  <- applicant portal (dashboard, application, checkin) — self-signup
  internal/               <- internal portal (applicants, scoring, hash, decisions, audit) — members only
  auth/                   <- login, signup, verify, forgot/reset, email callback
  portal/                 <- public "which portal?" chooser
proxy.ts                  <- Next 16's middleware; refreshes the session, guards protected routes
src/lib/                  <- auth helpers, Supabase clients, generated DB types, static content
src/components/
supabase/migrations/      <- ordered SQL migrations (the schema source of truth)
```

### Auth

Three layers, in order:

1. **`proxy.ts`** (root) — runs on every non-API request. Calls `updateSession()` in `src/lib/supabase/middleware.ts`, which refreshes the Supabase auth cookies and redirects signed-out users away from the protected prefixes (`/internal`, `/apply/dashboard`, `/apply/application`, `/apply/checkin`) to `/auth/login`.
2. **Role gates** — `requireMember()`, `requireCommittee()`, `requireBoard()` in `src/lib/auth.ts`, called at the top of internal pages/actions. Roles (`board` / `recruitment_committee` / `general_member`) are read from the caller's row in the **`members` table**, never from the JWT. `requireApplicant()` is the applicant-side equivalent (authenticated user with *no* `members` row).
3. **Postgres RLS — this is the actual security boundary.** Layers 1 and 2 only decide routing and rendering; a bug there is a UX bug, a bug in RLS is a breach. All 25 tables have RLS enabled, with policies in `supabase/migrations/20260610000007_rls.sql`.

> **When you add a table, you MUST add RLS policies for it.** A table with RLS enabled and no policy denies everything; a table without RLS is readable by anyone with the anon key.

Supabase clients: `src/lib/supabase/server.ts` (Server Components / Actions), `client.ts` (browser), `middleware.ts` (proxy), `admin.ts` (service-role — bypasses RLS, server-only, use sparingly).

## Database

The schema lives in `supabase/migrations/` as ordered SQL files, applied in filename order. Never edit an applied migration; add a new one (`supabase migration new <name>`).

```bash
npm run db:reset   # wipe local DB, re-run every migration, re-seed
npm run db:types   # regenerate src/lib/database.types.ts (run after any schema change)
```

Storage buckets (`resumes`, `member-photos`) are created in `20260610000008_storage.sql` and are RLS-governed too.

## Deployment

Deployed on Vercel. Set these in the Vercel project's environment variables (same set as `.env.example`, pointed at the hosted Supabase project):

| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never expose. |
| `NEXT_PUBLIC_SITE_URL` | The production origin, e.g. `https://mecg.org` — auth email redirects are built from this |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional Cloudflare Turnstile widget key; enable together with the secret key |
| `TURNSTILE_SECRET_KEY` | **Server-only.** Optional Turnstile verification key; enable together with the site key |

In the Supabase dashboard, add the production origin to **Auth → URL Configuration** (Site URL + redirect allow-list) so it matches `NEXT_PUBLIC_SITE_URL` — otherwise confirmation and password-reset links bounce. Locally that list lives in `supabase/config.toml` (`site_url` / `additional_redirect_urls`).

> **Authentication requires the Supabase environment variables.** Public pages degrade to signed-out mode when they are absent, but login and authenticated data cannot work. Set the variables **before** the first deploy.

## Production go-live

**Do this before opening member access in production.**

Signup is open: anyone can create an account. The current approval migration intentionally does not grant member access at signup:

- email **matches** an unconsumed allowlist row ⇒ a pending `membership_requests` row is created with that row's requested role;
- **no match** ⇒ no member or membership-request row is created, so the user remains an applicant unless they request access later.

Approving requests requires an existing board member. A fresh production database therefore needs one explicit first-board bootstrap in the SQL editor; after that, the first board member approves every other request through `/internal/members`.

### 1. Insert the real board roster

Run this **once**, in the Supabase SQL editor, against the production project. Replace every address with the real one — the roster is deliberately **not** committed to git, so it lives here as placeholders only.

```sql
insert into public.invite_allowlist (email, role, notes) values
  ('replace-me@umich.edu',   'board', 'President'),
  -- … one row per board member
  ('replace-me-2@umich.edu', 'board', 'VP Recruitment');
```

### 2. Bootstrap the first board member

Have the first board member create and confirm their account at `/auth/signup`. Then run this transaction in the Supabase SQL editor, replacing the address with that exact account email:

```sql
begin;

insert into public.members (user_id, email, full_name, role)
select user_id, email, full_name, 'board'::public.member_role
from public.membership_requests
where lower(email) = lower('replace-me@umich.edu')
  and requested_role = 'board'
  and status = 'pending';

update public.membership_requests
set status = 'approved',
    reviewed_by = (select id from public.members where lower(email) = lower('replace-me@umich.edu')),
    reviewed_at = now()
where lower(email) = lower('replace-me@umich.edu')
  and status = 'pending';

commit;
```

Verify that exactly one active board member now exists:

```sql
select email, role from public.members where deleted_at is null;
```

Log in as that account and approve the remaining board/member requests at `/internal/members`.

> **Allowlist timing:** the allowlist is consulted at signup. Someone who signs up first can still submit a request at `/auth/request-access`, but it will use the role they select there rather than a later allowlist entry. Review the requested role carefully before approval.

### 3. Environment

- Set **every** var in `.env.example` in the Vercel project (see [Deployment](#deployment)).
- `NEXT_PUBLIC_SITE_URL` must be the production origin — auth email redirects are built from it.
- Add that same origin to the Supabase **Auth → URL Configuration** redirect allow-list.

## Gotchas

- **It's `proxy.ts`, not `middleware.ts`.** Next 16 renamed the middleware file convention. Same idea, new name — searching for `middleware.ts` at the root will find nothing.
- **The app dir is `app/` at the repo root**, not `src/app/`. `src/` holds `lib/` and `components/` only.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS.** It must never get a `NEXT_PUBLIC_` prefix and must never be imported into a Client Component.
- **New table ⇒ new RLS policies.** See above. There's no "we'll add it later" here.
- **Roles come from the `members` table, not the JWT.** Don't read a role claim off the session.
- **Run `npm run db:types` after every schema change**, or TypeScript will be quietly lying to you.
- **Next 16 has breaking changes** vs. what you may know (and vs. what an LLM may confidently tell you). The docs for the installed version ship in `node_modules/next/dist/docs/` — read those.
