# MECG Website

The website and recruitment system for the Michigan Economics Consulting Group. It is one Next.js app serving three zones: the public marketing site, an applicant portal where candidates apply and check in, and an internal portal where members run recruitment (scoring, hash sessions, decisions, audit log). Everything behind the marketing site is backed by Supabase — Postgres, Auth, and Storage.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Supabase — Postgres + Auth + Storage |
| Validation | Zod |
| Marketing visuals | GSAP, Three.js (`@react-three/fiber` + `drei`), Lenis smooth scroll |

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

The Google OAuth vars can be left blank locally; the "Continue with Google" button is the only thing that needs them.

`supabase/seed.sql` creates local test logins (password `password123`), including `committee.test@umich.edu` (recruitment committee) and `member.test@umich.edu` (general member), plus placeholder board accounts.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:reset` | Drop + re-apply all migrations and the seed |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local DB |

## Architecture

```
app/                      <- the live App Router tree (repo root, NOT src/app)
  (external)/             <- public marketing site (about, team, services, recruitment, ...)
  apply/                  <- applicant portal (dashboard, application, checkin) — self-signup
  internal/               <- internal portal (applicants, scoring, hash, decisions, audit) — members only
  auth/                   <- login, signup, verify, forgot/reset, OAuth callback
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

The schema lives in `supabase/migrations/` as ordered SQL files — 11 of them, applied in filename order. Never edit an applied migration; add a new one (`supabase migration new <name>`).

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
| `NEXT_PUBLIC_SITE_URL` | The production origin, e.g. `https://mecg.org` — auth emails and OAuth redirects are built from this |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Optional; enables "Continue with Google" |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Optional |

In the Supabase dashboard, add the production origin to **Auth → URL Configuration** (Site URL + redirect allow-list) so it matches `NEXT_PUBLIC_SITE_URL` — otherwise magic links and OAuth callbacks bounce. Locally that list lives in `supabase/config.toml` (`site_url` / `additional_redirect_urls`).

> **The app 500s on every route if the Supabase env vars are missing.** `proxy.ts` builds a Supabase client on every request, so a deploy with an empty `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` fails at the door — not just on the pages that read the DB. Set the env vars **before** the first deploy.

## Production go-live

**Do this before a single person signs up in production.** It is not optional and it cannot be done later without manual cleanup.

Signup is open: anyone can create an account. What that account *becomes* is decided by `public.invite_allowlist` (see `fn_handle_new_auth_user` in `supabase/migrations/20260610000010_demo_convergence.sql`):

- email **matches** an unconsumed allowlist row ⇒ a `members` row is created with that row's `role`
- **no match** ⇒ no `members` row at all ⇒ the user is an *applicant*

Approving anything (membership requests included) requires `is_board()`, which reads the `members` table. So on a **fresh prod database** `members` is empty ⇒ nobody is board ⇒ nobody can approve anyone ⇒ every person who signs up is a permanently unapprovable applicant. Seeding the allowlist is the **only** bootstrap out of that. Today it only happens in `supabase/seed.sql`, which is local-dev-only ("Never apply to a hosted project") and whose board emails are explicit placeholders.

### 1. Insert the real board roster

Run this **once**, in the Supabase SQL editor, against the production project. Replace every address with the real one — the roster is deliberately **not** committed to git, so it lives here as placeholders only.

```sql
insert into public.invite_allowlist (email, role, notes) values
  ('replace-me@umich.edu',   'board', 'President'),
  -- … one row per board member
  ('replace-me-2@umich.edu', 'board', 'VP Recruitment');
```

### 2. Have the board sign up, then verify

Once they've each created an account at `/auth/signup`:

```sql
select email, role from public.members;
```

Every board member must appear with `role = 'board'`. If someone is missing, or shows up as anything else, stop and fix it before opening signup to applicants.

> **The trap:** the allowlist is only consulted **at signup**, and the matched row is consumed. If someone signs up *before* they're allowlisted, they get **no `members` row** — and inserting them into the allowlist afterwards will **not** retroactively fix them, because the trigger already ran. They must be allowlisted first and then sign up (delete the stray user in Supabase → Auth → Users and have them re-register).

### 3. Environment

- Set **every** var in `.env.example` in the Vercel project (see [Deployment](#deployment)).
- `NEXT_PUBLIC_SITE_URL` must be the production origin — auth emails and OAuth redirects are built from it.
- Add that same origin to the Supabase **Auth → URL Configuration** redirect allow-list.

## Gotchas

- **It's `proxy.ts`, not `middleware.ts`.** Next 16 renamed the middleware file convention. Same idea, new name — searching for `middleware.ts` at the root will find nothing.
- **The app dir is `app/` at the repo root**, not `src/app/`. `src/` holds `lib/` and `components/` only.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS.** It must never get a `NEXT_PUBLIC_` prefix and must never be imported into a Client Component.
- **New table ⇒ new RLS policies.** See above. There's no "we'll add it later" here.
- **Roles come from the `members` table, not the JWT.** Don't read a role claim off the session.
- **Run `npm run db:types` after every schema change**, or TypeScript will be quietly lying to you.
- **Next 16 has breaking changes** vs. what you may know (and vs. what an LLM may confidently tell you). The docs for the installed version ship in `node_modules/next/dist/docs/` — read those.
