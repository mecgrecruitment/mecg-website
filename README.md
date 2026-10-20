# MECG Rush Platform

A cycle-based rush system for applications, event attendance, structured Member evaluations, Hash deliberation, and locked Board decisions.

## Setup

```bash
npm install
cp .env.example .env
npm run supabase:link
npm run supabase:verify-project
npm run dev
```

Open `http://localhost:3000/login` and sign in with a Clerk account. Clerk handles identity; Supabase stores recruitment data and enforces cycle access. The first cycle can only be created by the existing MECG Recruitment board account. Later internal accounts are created from the Board dashboard. Applicants create their own accounts at `/apply`.

## Roles and access

- Applicants submit through `/apply` while a cycle is open and receive a private status link. Final outcomes appear only after a locked decision is explicitly released.
- Members can open Speed Dating, Group Case, and Hash workspaces. They can submit only assigned evaluations and cannot see peer scores or aggregate rankings.
- Board operations roles can manage assignments and round status. A separate Hash panel role can see locked aggregates and make decisions after every evaluated round is frozen.
- Owners can create Member, Board operations, and Hash panel roles. Users cannot grant roles to themselves.

Every privileged action uses a named session and server-side cycle permission check. Submitted evaluations are immutable. Final decisions need two distinct, conflict-free Board or Owner approvals before locking.

Users can replace temporary passwords from the Evaluation Hub. Changing a password increments the account's session version, invalidating every older session.

## Evaluation rules

Ratings use anchored scores from 1 through 5 plus `N/O`. `N/O` remains missing and never becomes zero. A valid form needs at least 75 percent observed rubric weight and its required criterion. A round needs at least two valid independent evaluations. A score spread of 25 points or more enters structured review.

The dry-run round weights are:

- Speed Dating: 40 percent
- Group Case: 60 percent

Attendance is operational only. It does not contribute to evaluation rankings or final scores. The QR check-in remains a convenience rather than proof of identity.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` is the MECG Recruitment project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the project's publishable browser key.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and is used for account administration and project verification.
- `BASE_URL` optionally sets the host encoded in check-in QR codes.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.

## Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run supabase:verify-project
npm run verify:backend
```

Run the gates in order. MECG project precedence comes first: `supabase:verify-project`
fails unless both `.env.local` and the Supabase CLI link point to the healthy MECG
Recruitment project. Run `npm run supabase:link` to repair a missing or incorrect
local CLI link. Run `npm run supabase:sync-env` to replace a stale browser key with
MECG Recruitment's publishable key.

The deterministic gates are `npm test`, `npx tsc --noEmit`, `npm run lint`, and
`npm run build`. The Supabase database gate is `npm run test:supabase`. The protected
live gates are `verify:backend`, `verify:auth`, and `verify:workflow`; run them only
after project verification succeeds.

`verify:backend` probes Supabase REST/RPC denial and migration metadata directly.
`verify:auth` requires a running app and creates external test identities.
`verify:workflow` creates temporary Clerk identities and recruitment records, then
attempts cleanup. Use a designated staging project for these external checks.

For an isolated public preview without external account credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ci.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder E2E_LOCAL_HTTP=1 PLAYWRIGHT_APPLICATION_HARNESS=1 npm run dev
```

In another terminal, run `PLAYWRIGHT_PORT=3000 npm run test:e2e -- --workers=2`.
The public site uses unavailable-service fallbacks; the application harness uses
synthetic data and intercepted APIs. This does not verify live authentication,
storage, database permissions, or email delivery. Never enable the harness on a
production deployment. Use `npm run test:supabase:local` for an isolated local
database, rather than the linked database command.

The scoring functions are pure and tested independently from Supabase. Database migrations and RLS policies live in `supabase/migrations`.

The October continuation adds eleven migrations (`20261016190000`–`20261016210000`).
Coordinate their staging rollout with the application: application, Group Case,
written-evaluation and screening routes require the new revision-aware contracts;
old authenticated draft/submission writers fail closed. The [rollout map](docs/reviews/2026-10-redesign/migration-rollout-map.md)
identifies each migration and its consuming application behavior. The local
SQL command and CI run every file in `supabase/tests`, rather than only the
foundation test. The [verification receipt](docs/reviews/2026-10-redesign/implementation-receipt.md)
records the actual checks and remaining hosted/participant evidence.

`npm run verify:publication` builds a temporary isolated production app against a
synthetic local public-RPC fixture and proves publish/image/withdraw behavior.
It does not use real client content or hosted credentials.
`npm run verify:draft-race -- supabase_db_mecg-goal-20261016` is restricted to that
dedicated disposable proof container and commits then cleans synthetic rows; it
is not a linked-project or production command.

Optional browser-engine coverage is available through `npm run test:e2e:cross-browser`
(install the matching Firefox/WebKit browser dependencies first). On an unsupported
Linux host, run the existing local test server on port3000, then use the pinned
matching image described by [Playwright](https://playwright.dev/docs/docker):

```bash
docker run --rm --init --network host --ipc host \
  -v "$PWD":/work -w /work \
  -e PLAYWRIGHT_PORT=3000 -e PLAYWRIGHT_CROSS_BROWSER=1 \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  node node_modules/@playwright/test/cli.js test \
  --project=firefox --project=webkit --project=mobile-webkit --workers=2
```

This uses the same synthetic API fixtures and local-only harness as Chromium.
It adds Linux engine coverage; it does not prove physical-device, macOS Safari,
hosted identity/storage/email integration or real-user acceptance.

## Private page walkthrough

Run `npm run preview:workspaces`, then open `http://localhost:3010/admin`. The
preview copies the current page code into ignored `.audit/workspace-preview-app`
and serves fictional data from a process-local HTTP fixture. It needs no account
or hosted database. The top bar switches between Board, Member, application
reviewer, Hash panel, Applicant and Owner views; “Browse all sample pages” opens
the page directory.

This is a visual, read-only walkthrough: controls can be explored, but submission,
save, upload and live polling APIs are blocked. It does not verify authorization
or live integrations. Authentication replacement exists only in the generated
copy; application source and production authentication are untouched. External
service credentials are removed from the child process. Never deploy the generated
preview app. Set `WORKSPACE_PREVIEW_PORT` to change the local port. Restart the
command after source changes to refresh the copied pages.
