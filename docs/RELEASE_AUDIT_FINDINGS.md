# Release audit findings

Date: 2026-08-31. Branch `main`, working tree (122 uncommitted paths), not HEAD.
Method: 9 passes across 5 parallel read-only agents, plus direct verification of every BLOCKER.

## Gate results

| gate | result |
|---|---|
| `npm run lint` | pass |
| `npx tsc --noEmit` | pass |
| `npm test` | pass, 25/25 |
| `npm run build` | pass, no `ignoreBuildErrors` in `next.config.ts`, TS ran inside the build |
| `npm run verify:auth` | **not run**: reads a `.env.local` that does not exist here and creates real users in the linked project |
| `npm run verify:workflow` | **not run**: same, and see B6: it is broken anyway |
| `npm run supabase:lint` | **not run**: needs a linked CLI session |

A green gate set is not evidence of a healthy pipeline here. B1, B2 and B6 are all invisible to it.

## BLOCKER

**B1. Every applicant's final score is `null` in any cycle that used blind screening.**
`src/lib/evaluation.js:48-52`. `combineRoundScores` filters `complete` on `round.weight > 0`, then
requires `complete.length === rounds.length`. `create_screening_batch` inserts the `APPLICATION_SCREEN`
round with `weight` 0 (`supabase/migrations/20260830090000_recruitment_committee_role.sql:196`), so the
filter always drops one round and the length check always fails.
Effect: `src/app/admin/hash/page.tsx:45` passes 3 rounds in, gets `null` for every applicant, the Hash
board's Combined column is blank, and the sort `(b.finalScore ?? -1) - (a.finalScore ?? -1)` degenerates
to no ordering. The panel deliberates on an unranked list.
Fix: compare against the weight-bearing rounds only: `const scored = rounds.filter(r => r.weight > 0)`.

**B2. No decision can ever be created in a cycle that used blind screening.**
`supabase/migrations/20260830100000_harden_applicant_workflow.sql:519`. `create_decision` raises
`insufficient evidence` (55000) if ANY round in the cycle has fewer than 2 `LOCKED` rows in
`evaluation_assignments ⋈ evaluations`. The `APPLICATION_SCREEN` round stores its evidence in
`rush.screening_reviews` and has zero evaluation assignments by construction.
Effect: board runs screening, freezes every round, reaches `DECISION_LOCK`, clicks Decide, and gets
`insufficient evidence` for every single applicant. The pipeline cannot terminate.
Fix: add `and r.weight > 0` (or `r.kind <> 'APPLICATION_SCREEN'`) to that `EXISTS`.

B1 and B2 together mean the decision stage is non-functional end to end for the exact flow you built
blind screening for. Fix these before anything else.

**B3. Conflict-of-interest recusal fails open.**
`src/app/admin/applications/[id]/page.tsx:67`. The `conflict_declarations` lookup destructures only
`data` and drops `error`, so a failed query is indistinguishable from "no conflict declared" and the
guard at `:68` is skipped. Ten lines up, `:57` does `if (error) throw error;`. This is an omission,
not a house style.
Effect: one transient error or RLS regression and a recused board member is shown the full dossier,
contact info and resume link.
Fix: destructure `error` and throw, or render the recused view on error.

**B4. `/api/auth/reset-password` accepts any authenticated session.**
`src/app/api/auth/reset-password/route.ts:12-14`. It calls `getUser()`, then `updateUser({password})`.
No check that the session came from a recovery link, no old-password check, no rate limit. Compare
`src/app/api/account/password/route.ts:19-26`, which deliberately re-verifies the current password.
This route is a bypass of that control.
Effect: anyone holding a victim's `sb-<ref>-auth-token` cookie (shared machine, leaked session) sends
one POST and owns the account permanently. Against an OWNER, that is every cycle.
Fix: enable Supabase Auth "Secure password change" (reauthentication), or require the session's `amr`
to contain `recovery` before `updateUser`.

**B5. A required rubric criterion can be left unscored.**
`supabase/migrations/20260821130000_member_functions.sql:56,63`. The required-criterion check tests
`x->'score' = 'null'::jsonb`, which evaluates to SQL NULL (not true) when the `score` key is absent
entirely, and the range check is guarded by `x ? 'score'`.
Effect: an evaluator POSTs a rating object with no `score` key for a required criterion, scores the
rest, clears the 0.75 coverage gate, and the evaluation is accepted with a NULL stored rating.
Fix: `coalesce(x->'score','null'::jsonb) = 'null'::jsonb`, and drop the `x ? 'score'` guard.

**B6. `npm run verify:workflow` is dead; the end-to-end rehearsal never runs.**
`supabase/migrations/20260831120000_resume_document_lifecycle.sql:424`. `submit_application_self_test`
calls `rush.submit_application` with 10 positional args, but the live signature takes 14
(`20260830100000:227-230`) and hard-rejects a null `class_year`, `major`, `uniqname`, `college`.
`rush.verify_full_workflow` calls it as step one, so the script dies on `invalid class year` (22023)
before exercising anything.
Effect: the gate you would rely on to catch B1/B2/B5 has been failing at line one.
Fix: pass the synthetic values the superseded `20260830100000:332` version used.

**B7. Event datetimes are parsed in the server's timezone, not the admin's.**
`src/app/api/admin/events/route.ts:13`. The route does `new Date(value)` on the raw `datetime-local`
strings sent by `src/app/admin/events/new/page.tsx:73-77`. An offset-less date-time parses as *local*
time; the server's local zone is UTC, the admin's is America/Detroit.
Effect: an admin enters 6:00 PM and gets an event stored at 2:00 PM ET. Worse, `slot-form.tsx:24` does
the conversion correctly in the browser, so `create_event_slot`'s `starts_at <= slot_starts_at` bound
check rejects correctly-entered evening slots as "slot outside event bounds".
Fix: send `new Date(date).toISOString()` from the client, matching what `slot-form.tsx:24` already does.

**B8. `/api/interest` parses an unbounded body and stores unbounded text.**
`src/app/api/interest/route.ts:6,18-20`. Bare `req.json()` with no size cap on an unauthenticated route
that is not in the proxy matcher; `uniqname`/`classYear`/`howHeard` are typechecked but never
length-capped, and `rush.interest_signups` declares them as bare `text` with no CHECK.
Effect: a large JSON body is fully buffered and parsed before the rate-limit check at `:12` ever runs.
`readJsonBody(req, 8*1024)` already exists in `src/lib/api-route.ts` and is used by `/api/contact`.
Fix: use `readJsonBody`, and cap each optional field at ~200 chars.

**B9. CI has never run.**
`.github/` is untracked. The workflow inside it runs `npm ci && lint && test && build` on push and PR,
which is exactly right, it has just never been committed, so nothing has ever gated a push to `main`.
Fix: `git add .github/`.

## SHOULD

| # | where | defect |
|---|---|---|
| S1 | `20260830090000:196` + `src/app/admin/screening/packet-action.tsx:41` | `create_screening_batch` copies application responses verbatim into screening packets. The only thing between an applicant's name in their own free text and a blind reviewer is an admin manually reading and editing each packet. Approve 80 unread and blindness is gone with no audit signal. Flag packets whose content matches the applicant's own name/uniqname. |
| S2 | `20260830090000:288` | `recuse_screening_assignment` inserts a replacement only if one exists. If the last eligible reviewer recuses, the packet is stuck below `reviews_per_application` forever, `freeze_screening_batch` raises 55000 permanently, and the cycle can never reach `DECISION_LOCK`. Deadlock with no recovery RPC (`unique (cycle_id)` blocks a second batch). |
| S3 | `src/app/api/admin/decisions/route.ts:76-85` | After `release_decision` succeeds, the follow-up select drops `error` and `sendEmail`'s boolean return is ignored, yet the route returns 200. Decision is RELEASED, applicant never emailed, board sees success. |
| S4 | `src/app/apply/page.tsx:53` | `intake_schema` called with `error` dropped; `parseIntakeSchema(null)` → `cycleOpen=false`. Any transient RPC failure shows every applicant "Applications are currently closed" during an open cycle, with nothing logged. |
| S5 | `src/app/apply/page.tsx:33-38` + `src/app/api/apply/route.ts:39` | Malformed question rows are silently dropped by `flatMap(… return [])`, and `parseAnswers({})` returns `{}`, which passes the truthiness check. One bad question row → applicant submits with zero written responses, no error anywhere. |
| S6 | all rate-limited routes | Every bucket keys on the leftmost `x-forwarded-for` entry, which is the client-controlled end of the chain. If the platform appends rather than overwrites, the login and signup limits are bypassable by sending a random XFF per request. Verify against Vercel's behavior, then key on the platform-set hop. |
| S7 | `src/lib/rate-limit.ts:21` + `20260825000000:69` | Login and forgot-password buckets store the raw lowercased email as the table's primary key, and `prune_rate_limits()` is never called from any route, script, or cron. Every email anyone types into either form accumulates in plaintext forever. Hash the key; schedule the prune. |
| S8 | `src/app/api/apply/resume/finalize/route.ts:33,62` | No rate limit (unlike `start/route.ts:29`), and `pdfjs-dist` parses attacker-supplied bytes with no timeout or worker isolation. A crafted PDF hangs the handler until platform timeout, 10× per account per hour. |
| S9 | `20260831120000:153-159` | Nothing ever cleans up `PENDING` resume documents whose bytes uploaded but never finalized. No prune job exists anywhere. Objects accumulate in the bucket permanently. |
| S10 | `src/lib/rate-limit.ts:24-29` | Fails closed on error, correct for `apply`/`interest`/`contact`, but it also gates `/api/auth/login`. A Supabase hiccup 429s every login site-wide, including the board members trying to fix it. |
| S11 | `20260830090000:158` vs `src/app/admin/applications/[id]/page.tsx:158` | `ratings_read_with_evaluation` excludes BOARD, but the dossier renders per-round aggregates for any admin. A BOARD-only member sees every round PENDING and a null final score, with no error and no explanation. |
| S12 | `20260822140000:356` | `set_decision_preview` is the only decision RPC with no recusal check. A conflicted PANEL member can rewrite the applicant-facing communication preview. |
| S13 | `20260830090000:192` | `assign_evaluator` has no `is_active_screening_reviewer` exclusion but `applications_read_internal` does. Assigning a screening reviewer as an evaluator creates a row RLS then hides, so they see zero assignments, the round board shows it Open forever. |
| S14 | `src/app/api/interest/route.ts:24`, `src/app/api/member/buddy/route.ts:17` | Raw Postgres `error.message` returned to the client. Every other route funnels through `mapRpcError`, which exists precisely to stop this. |
| S15 | `src/app/api/admin/decisions/route.ts:65`, `admin/screening/route.ts:34`, `member/screening/route.ts:17`, `member/evaluations/[assignmentId]/route.ts:13` | Enums and JSON payloads forwarded to RPCs with no allowlist or shape check. `outcome:"garbage"` surfaces as HTTP 500 (`22P02` is missing from `RPC_ERROR_STATUSES`) rather than 400. |
| S16 | `src/app/api/admin/decisions/route.ts:55-59`, `admin/events/[id]/rotate/route.ts:12`, `admin/round-board.tsx:26`, `admin/events/[id]/page.tsx:16,23` | Five more `{data}`-without-`error` sites. Each turns an outage into a misleading 403 / empty list / silent redirect. |
| S17 | `next.config.ts:17-22` | No `Content-Security-Policy`. The other four security headers are present and correct. Applicant free text (2400-char textareas) is rendered back in `/admin` with no script-source backstop. |
| S18 | `src/instrumentation.ts:22-24` | `register()` throws when the service-role key is missing, aborting the whole server instance. A typo in a var only the admin routes need takes down the public marketing site on cold start. |
| S19 | `src/app/api/health/route.ts:8` | Real dependency probe (verified live, 565ms), but unauthenticated and uncached. Anyone can drive unlimited Supabase RPCs by hammering it. |
| S20 | `.gitignore` | 49MB of untracked source photos at the repo root (`mecg-pictures/` 24M of unstripped HEIC/WhatsApp originals of identifiable students, `Board Headshots/` 25M byte-identical to `public/board/`, `MECG_Logos (2)/` 812K), plus `test-results/` and `supabase/.branches/`. One `git add -A` puts all of it in history permanently. |
| S21 | `public/board/*.jpeg` | Seven committed images over 2MB (5.2MB max); `public/` totals 35M. All served through `next/image` with correct `sizes`, so browser payload is fine, but Vercel re-transcodes a 5MB source on every cache miss. Downscale to ~1600px. |
| S22 | `src/app/admin/rush-controls.tsx:273,306` | Status selects list every enum value including illegal backwards transitions. The DB rejects them correctly, so the user just gets a raw "invalid cycle transition" with no hint at what is legal. `pipeline-status-form.tsx:58` already does this right. |
| S23 | `src/app/(marketing)/join/page.tsx:62` | Renders dynamic only because `createClient()` calls `cookies()`, not because it needs a session. Every visit is a cold render plus an RPC. Use a cookie-free anon client and `revalidate = 300`. |
| S24 | `src/app/apply/application-form.tsx:53,301,349` | `FieldError` sits inside the wrapping `<label>` while also being an `aria-describedby` target, so the error folds into the field's accessible name and is announced twice; and the submit button's only pending signal is a label swap on a `disabled` element, which drops focus to `<body>` and announces nothing. `ResponsesStep:326` already gets the label structure right. |
| S25 | dead code | Never-imported and safe to delete (zero-reference greps confirmed): `src/app/(marketing)/work/project-inquiry-form.tsx`, `src/components/bento-grid.tsx`, `src/components/project-work-card.tsx`, `src/lib/project-work.ts`, `src/components/reveal.tsx`, `src/lib/rush.js` + `rush.test.js` (its 4 passing tests cover a function nothing calls; the real check-in window logic lives in SQL and is untested). |
| S26 | `20260821090000:212,506` | `rush.claim_tokens` is a dead table (RLS on, no policy, no RPC, no reference) holding unsalted token digests nothing expires. `audit_read_board` was never dropped when `audit_events_read_internal` replaced it, leaving two overlapping permissive policies. |
| S27 | `docs/SUPABASE_FULL_FUNCTIONAL_PLAN.md:15`, `docs/RUSH_PLATFORM_PLAN.md:308` | The first contradicts itself (line 5 says Prisma is removed, line 15 says every route still imports it); the second is 423 lines of future tense describing shipped work. Both mislead anyone estimating what is left. |

## Test gaps worth closing with the fixes

- `src/lib/evaluation.test.js:47`: `combineRoundScores` has no weight-0 case and no empty-array case. That is exactly B1; no existing test could have caught it.
- `src/lib/evaluation.test.js:36`: `aggregateRound` is never tested at the `spread >= 25` boundary.
- `src/lib/screening.test.ts:45`: no case for fewer reviewers than `reviewsPerPacket`, which is S2's deadlock.
- `src/lib/workflow.test.ts:25`: the TS transition graph and the SQL one in `set_cycle_status` are hand-maintained duplicates with no test asserting they match.

## Verified clean, no action needed

- **No secrets, ever.** No service-role JWT, `sk-` key, bcrypt hash or hardcoded password in the working tree or in any commit reachable from `--all`. The only `.env*` ever committed is `.env.example` with placeholders. The sole service-role client (`src/lib/supabase/admin.ts:1`) opens with `import "server-only"` and is used at exactly 4 call sites, each preceded by an authorization check.
- **No EXIF GPS** in the committed `public/` photos (checked directly; the two "GPS" byte matches in `blake.jpeg` are compressed-pixel coincidences with no lat/long tags). The unstripped originals are in the untracked `mecg-pictures/`, which is S20.
- **Authorization is sound.** All 35 routes tabulated. Every app-layer check is backstopped by a `SECURITY DEFINER` function that re-derives the cycle from the target row rather than trusting `body.cycleId`. That is what closes cross-cycle IDOR in `admin/rush` and `admin/decisions`. All 60+ definer functions set `search_path = ''`. No open redirect anywhere. No mutation reachable via GET. There is no separate password-based admin login (`api/admin/login` is a one-line re-export; `/admin/hash` is the deliberation board, not a hashing page). Check-in tokens are two concatenated v4 UUIDs stored only as sha256.
- **RLS recursion is fully fixed.** Every remaining cross-table policy chain traced to a terminating definer helper; nothing after `20260831030000` reintroduces a cycle.
- **Blind screening holds** against every path traced: RPC payloads, direct table reads, joined over-selects, resume filenames, and the indirect `conflict_declarations` ID leak. S1 is the one residual, and it is a process gap rather than a code hole.
- **RSVP and buddy capacity are not races.** `rsvp_slot` and `book_buddy_slot` both `SELECT … FOR UPDATE` the parent row before the capacity count, plus a unique constraint on bookings.
- **Scoring math is otherwise correct**: no division by zero, missing evaluations excluded rather than zeroed.
- `database.types.ts` matches the migration DDL exactly: all 38 tables, columns and enums.
- Domain is consistent (`mecgmichigan.com`) across `metadataBase`, `robots.ts`, `sitemap.ts`. Sitemap lists no authenticated routes; robots disallows `/admin /member /applicant /apply /api /login` and both password routes.
- No `dangerouslySetInnerHTML`, no `console.log/debug/warn`, no floating promises, no empty `catch {}` beyond the one noted. Every client form checks `response.ok` before showing success.
- Resume upload chain is solid apart from S8/S9: server-generated regex-constrained paths, 10MB + `application/pdf` enforced by the bucket, `upsert:false`, 300s signed URLs.
- The deleted `public/about/founders.jpg` and `public/board/annie-2026.jpg` have zero references. Commit the deletions.

## Deliberately not flagged

- **Bundle size and dependency upgrades.** Out of scope for this pass; nothing here blocks a release.
- **`/` → `/home` `permanent: true`** (`next.config.ts:7`) makes `src/app/page.tsx`'s three.js splash unreachable, and drags `three` + `@react-three/fiber` into the build for a route with no traffic. Reported as a fact, not a defect, because retiring the splash may be intentional. If it is, delete `splash.tsx`/`hero-scene.tsx` and the two deps. If it is not, note that a 308 is cached indefinitely by browsers.
- **ICS CRLF injection** (`src/app/api/events/[id]/ics/route.ts:14`): requires `RECRUITMENT_OPERATIONS` to exploit and the blast radius is one calendar entry.
- **Unused exports in `site-content.ts` / `join-content.ts` / `rubrics.ts`**: cosmetic.
- **`listUsers({perPage:1000})`** (`admin/rush/route.ts:82`): will start lying past 1000 auth users. Not now.
- **`X-Powered-By`**: set `poweredByHeader: false` whenever you next touch the config.
- **Photo-carousel `role`/`tabIndex`**: degraded, not blocked; arrow buttons work.

## Not verified

The live database was never contacted. Every SQL finding is read from the migration set on the
assumption the deployed schema matches it, taking the latest timestamp where a function is redefined.
Supabase Auth dashboard settings ("Secure password change", email confirmation) were likewise not
inspected, which matters for B4. The XFF behavior in S6 depends on the deployment platform.
