# Production launch checklist

Go-live gate for opening member access. Derived from README **Production go-live**, MEMORY / ROADMAP hard stops, and SEC-* contracts in `docs/PRD.md`.

**Owners:** Owner = club decision-maker (roster, domain, hard-stop approvals). Eng = whoever operates Vercel + Supabase.

**Hard stops (do not bypass in-session without explicit Owner confirmation):**

| Hard stop | Why |
| --- | --- |
| `supabase db push` / apply migrations to **remote** | One-way door on prod data |
| Wire a real **applicant confirmation email** provider | External send = hard stop (OQ-11 / ROADMAP) |
| First production **deploy** with public member access | Needs this checklist green |

---

## Pre-flight (local / reversible)

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| P1 | `.env.example` lists every key used in prod | — | Eng | — | ☐ |
| P2 | `npm run check:env` passes locally (required keys + Turnstile pair rule) | — | Eng | `.env.local` filled from `supabase status` | ☐ |
| P3 | Confirm `SUPABASE_SERVICE_ROLE_KEY` has **no** `NEXT_PUBLIC_` twin and `createAdminClient` is server-only | — | Eng | — | ☐ |
| P4 | Confirm resume uploads use service-role path only (no anon storage INSERT policies) | — | Eng | migration `20260610000008_storage.sql` applied on target DB | ☐ |

---

## 1. Hosted Supabase + schema

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| S1 | Hosted Supabase project exists (prod) | Owner | Eng | Project billing / org access | ☐ |
| S2 | All local migrations applied to **remote** (explicit Owner go-ahead; **not** this checklist’s job to run push) | Owner | Eng | **HARD STOP** — Owner confirmation before `db push` | ☐ |
| S3 | Storage buckets `resumes` + `member-photos` exist; anon has **no** storage write policies | — | Eng | S2 | ☐ |
| S4 | RLS smoke expectations still hold (anon denied on base tables) | — | Eng | S2 | ☐ |

---

## 2. Vercel environment variables

Set **Production** (and Preview only if you intentionally allow preview auth) to match `.env.example`:

| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Hosted project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Publishable only |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server-only.** Never `NEXT_PUBLIC_*`. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Exact production origin, e.g. `https://www.mecgmichigan.com` (no trailing slash preferred; code strips it) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Pair | Enable **with** secret, or leave **both** empty |
| `TURNSTILE_SECRET_KEY` | Pair | Enable **with** site key, or leave **both** empty |

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| E1 | All required vars set in Vercel Production | — | Eng | S1 keys available | ☐ |
| E2 | Turnstile: both keys set (recommended for prod / SEC-23) **or** both unset; smoke signup **and** `/apply` submit with widget | Owner (Cloudflare) | Eng | Turnstile widget allows production hostname | ☐ |
| E3 | No service-role key in any `NEXT_PUBLIC_*` var or client bundle (`admin.ts` uses `import "server-only"`) | — | Eng | E1 | ☐ |
| E4 | Redeploy after env change | — | Eng | E1–E3 | ☐ |

---

## 3. Auth URL allow-list (auth brick if wrong)

Auth emails use `NEXT_PUBLIC_SITE_URL` + `/auth/callback` (signup, resend, password reset). If Site URL / redirect allow-list ≠ that origin, confirmation and reset links bounce.

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| A1 | Supabase **Auth → URL Configuration → Site URL** = `NEXT_PUBLIC_SITE_URL` | — | Eng | Final production hostname | ☐ |
| A2 | Redirect allow-list includes `{SITE_URL}` and `{SITE_URL}/**` (and `/auth/callback` paths) | — | Eng | A1 | ☐ |
| A3 | Custom domain DNS + Vercel domain attached | Owner | Eng | Registrar access | ☐ |
| A4 | Smoke: signup → email link → `/auth/callback` session exchange | — | Eng | A1–A3, E1 | ☐ |
| A5 | Smoke: forgot-password → reset link → `/auth/reset` | — | Eng | A4 | ☐ |

**Preview deploys:** if `NEXT_PUBLIC_SITE_URL` is production-only, preview hosts are fine for public pages but auth email redirects will target production. Do **not** leave `NEXT_PUBLIC_SITE_URL` unset in prod (fallback host derivation can miss the allow-list).

---

## 4. Membership approval model

Signup does **not** auto-grant `members` access:

- Allowlist match → pending `membership_requests` with allowlist role
- No match → no member / request row (applicant until `/auth/request-access`)

Approvals need an existing board member → **first-board bootstrap** required on a fresh DB.

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| M1 | Real board roster inserted into `invite_allowlist` (SQL in README; placeholders only in git) | Owner | Eng | Real `@umich.edu` list from club | ☐ |
| M2 | First board member signs up + confirms email | Owner | — | A4, M1 | ☐ |
| M3 | Bootstrap SQL run once in SQL editor (README §2) | Owner present | Eng | M2 | ☐ |
| M4 | Verify exactly one active board row; approve remaining via `/internal/members` | Owner | Eng | M3 | ☐ |
| M5 | Confirm grant-by-email / approve / deny still work post-migration | — | Eng | S2, M4 | ☐ |

---

## 5. Storage / anon writes

| # | Item | Owner | Eng | Blocked on | Done |
| --- | --- | --- | --- | --- | --- |
| W1 | `/apply` resume upload uses `createAdminClient()` only | — | Eng | Code review of `app/apply/application/actions.ts` | ☐ |
| W2 | No anon INSERT/UPDATE/DELETE on `storage.objects` for `resumes` | — | Eng | S3 | ☐ |
| W3 | Spot-check: browser with anon key cannot upload to `resumes` | — | Eng | W2 | ☐ |

---

## 6. Documented gaps (do not invent)

| Gap | Status | Owner | Eng | Notes |
| --- | --- | --- | --- | --- |
| Applicant confirmation email (post-submit) | **Blocked** | Owner | — | External send = hard stop. Success UI must not claim an email was sent until a provider is approved (PRD OQ-11 / EX-65). |
| Board decision “mailto” drafts (`/internal/emails`) | OK as-is | — | Eng | Opens mail client; not a provider integration. |
| Remote schema apply | **Blocked** until Owner says go | Owner | Eng | Do not run `supabase db push` from agents/checklists without confirmation. |

---

## Auth brick / exposure flags (quick reference)

| Risk | Symptom | Fix |
| --- | --- | --- |
| Site URL ≠ allow-list | Confirm / reset links error or land wrong host | Align Supabase Auth URLs with `NEXT_PUBLIC_SITE_URL` |
| Missing `NEXT_PUBLIC_SITE_URL` in Vercel | Redirects derived from request host; may not be allow-listed | Set explicit production origin before launch |
| Half Turnstile config | Signup + apply always “Verification failed” | Set both keys or remove both |
| Service role in client | Full RLS bypass in browser | Never prefix `NEXT_PUBLIC_`; only import `admin.ts` from server modules |
| Migrations not on remote | Signup triggers / membership model diverge from local | Apply migrations only after Owner hard-stop approval |

---

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Owner | | | Hard stops acknowledged |
| Eng | | | Env + Auth URL + bootstrap verified |
