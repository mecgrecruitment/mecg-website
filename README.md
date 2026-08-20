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
- **npm** (this repo uses `package-lock.json` — do not switch to Bun/pnpm/yarn)
- **Supabase CLI** — `brew install supabase/tap/supabase`
- **Docker** running — the local Supabase stack (Postgres, Auth, Storage) runs in containers

## 10-minute setup

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
# Edit .env.local — paste the three keys above. Keep SITE_URL as http://127.0.0.1:3000.

npm run check:env   # fails loudly on missing keys or localhost vs 127.0.0.1 mistakes
npm run seed:users  # prints every synthetic login
npm run dev
```

Open **http://127.0.0.1:3000** — not `http://localhost:3000`.

### Why `127.0.0.1`, not `localhost`

`NEXT_PUBLIC_SITE_URL` and the Supabase redirect allow-list in `supabase/config.toml` default to `127.0.0.1`. Mixing `localhost` and `127.0.0.1` breaks auth email redirects and cookie host matching. `npm run check:env` rejects `localhost` URLs on purpose.

### Seed users (password `password123` for all)

Created by `supabase start` / `npm run db:reset` via `supabase/seed.sql`. Print anytime with `npm run seed:users`.

| Email | Role |
| --- | --- |
| `board01.test@umich.edu` … `board10.test@umich.edu` | board |
| `committee.test@umich.edu` | recruitment_committee |
| `member.test@umich.edu` | general_member |

Typical smoke: log in as `board01.test@umich.edu` → `/internal`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run check:env` | Verify required keys (`.env.local`, or process env when `CI=true` / `CHECK_ENV_MODE=process`) |
| `npm run seed:users` | Print synthetic seed logins + role-smoke checklist |
| `npm run dev` | Dev server (runs `check:env` first) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting files |
| `npm run verify` | `check:env` + lint + typecheck + build (daily confidence loop) |
| `npm run audit` | Sensitive scan + lint + typecheck + build once |
| `npm run audit:loop` | Repeat the audit every 30 seconds (`AUDIT_INTERVAL_SECONDS=60 …`) |
| `npm run audit:sensitive` | Scan for leaked keys / personal emails |
| `npm run test:e2e` | Build with `E2E_LOCAL_HTTP=1` and run Playwright against `127.0.0.1:3210` |
| `npm run test:e2e:live` | Playwright against `E2E_BASE_URL` (no local server) |
| `npm run test:role-smoke` | curl signed-out redirects for protected prefixes (app must be running) |
| `npm run db:reset` | Drop + re-apply all migrations and the seed |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local DB |
| `npm run db:test` | Run every `supabase/tests/*.sql` against local Supabase |
| `npm run test:rls` | Run `supabase/tests/rls_phase0.sql` only |

### Database smoke tests (RLS + integrity)

SQL files under `supabase/tests/` are transactional and roll back. They need a **seeded** local Postgres (host `psql` is optional — the runner uses `psql` inside the `supabase_db_*` container because the files use `\set` meta-commands that `supabase db query` rejects):

```bash
supabase db start       # enough for SQL smokes; or full: supabase start
npm run db:reset        # if you need a clean re-seed
npm run db:test         # all SQL smokes
npm run test:rls        # Phase 0 RLS only
```

Or one file: `bash scripts/run-db-tests.sh member_signup_approval.sql`.

### Role smoke

1. **Signed-out redirects** (no login): with `npm run dev` up, `npm run test:role-smoke`.
2. **Logged-in roles** (manual / Playwright later): `npm run seed:users`, then log in as board / committee / member and hit `/internal`.

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
supabase/tests/           <- SQL smoke tests (RLS, signup approval, write integrity, privileges)
```

### Auth

Three layers, in order:

1. **`proxy.ts`** (root) — runs on every non-API request. Calls `updateSession()` in `src/lib/supabase/middleware.ts`, which refreshes the Supabase auth cookies and redirects signed-out users away from the protected prefixes (`/internal`, `/apply/dashboard`, `/apply/application`, `/apply/checkin`) to `/auth/login?next=<path>`. Legacy entry URLs (`/portal`, `/member-login`, `/apply/create`) are redirect shims into `/auth/login` or `/auth/signup`, not separate auth systems.
2. **Role gates** — `requireMember()`, `requireCommittee()`, `requireBoard()` in `src/lib/auth.ts`, called at the top of internal pages/actions. Roles (`board` / `recruitment_committee` / `general_member`) are read from the caller's row in the **`members` table**, never from the JWT. `requireApplicant()` is the applicant-side equivalent (authenticated user with *no* `members` row). Signed-in non-members who hit `/internal` go to `/auth/request-access`, not a second login.
3. **Postgres RLS — this is the actual security boundary.** Layers 1 and 2 only decide routing and rendering; a bug there is a UX bug, a bug in RLS is a breach. All 25 tables have RLS enabled, with policies in `supabase/migrations/20260610000007_rls.sql`.

> **When you add a table, you MUST add RLS policies for it.** A table with RLS enabled and no policy denies everything; a table without RLS is readable by anyone with the anon key.

Supabase clients: `src/lib/supabase/server.ts` (Server Components / Actions), `client.ts` (browser), `middleware.ts` (proxy), `admin.ts` (service-role — bypasses RLS, server-only, use sparingly).

## Database

The schema lives in `supabase/migrations/` as ordered SQL files, applied in filename order. Never edit an applied migration; add a new one (`supabase migration new <name>`).

**Safe local schema loop** (after any migration or seed change — local only; never `db push` to production from this loop):

```bash
supabase start         # if the local stack is down
npm run db:reset       # wipe local DB, re-run every migration, re-seed
npm run db:types       # regenerate src/lib/database.types.ts from --local
npm run typecheck      # catch drift before you commit
npm run db:test        # optional: SQL smokes (RLS, privileges, intake reads)
```

Storage buckets (`resumes`, `member-photos`) are created in `20260610000008_storage.sql` and are RLS-governed too.

`/apply` intake: cycle + question prompts go through `get_open_apply_cycle` / `list_apply_questions` (authenticated SECURITY DEFINER). The service-role client is only used for resume Storage and `submit_application`.

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

CI runs lint, typecheck, and build on every PR. Optional Playwright against a deployment runs when the repo secret `E2E_BASE_URL` is set.

Production cutover steps (allowlist, first-board bootstrap, Turnstile, email gap): see `docs/LAUNCH-CHECKLIST.md`.

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
- **Hard stops (do not “just do it”):** push migrations to production Supabase without an explicit owner ask; invent Trek itinerary/content; send real outbound email from local/dev.

## Agent / maintainer notes

Read `MEMORY.md` at session start. Honor logged decisions. Open hard stops are also summarized there (prod DB push, trek content, outbound email). Prefer `npm run verify` before handing work back.
