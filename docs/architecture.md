# MECG architecture

Status: current at commit `c8da18d` plus the active execution-plan changes
Last reviewed: 2026-09-01

## System boundary

MECG is one Next.js application backed by one Supabase project. The application contains a public marketing site and a private recruitment platform.

Vercel runs the Next.js application. Supabase provides PostgreSQL, Auth, and private resume storage. Resend delivers application and decision email. Vercel Cron calls protected maintenance routes.

## Entry points

| Area | Entry point | Purpose |
| --- | --- | --- |
| Marketing | `src/app/(marketing)` | Public organization, project, team, join, and contact pages |
| Applicant application | `src/app/apply` | Account setup, draft application, resume upload, and submission |
| Applicant portal | `src/app/applicant` | Status, schedule, RSVP, buddy booking, survey, and offer response |
| Member portal | `src/app/member` | Assignments, evaluations, screening, impressions, conflicts, and profile |
| Board portal | `src/app/admin` | Cycle, event, assignment, screening, deliberation, decision, export, and account work |
| HTTP API | `src/app/api` | Server-side validation and calls into Supabase |
| Request proxy | `src/proxy.ts` | Session refresh and protected-route handling |
| Database | `supabase/migrations` | Tables, RLS, functions, triggers, grants, and scheduled database work |
| Database tests | `supabase/tests/rush_foundation.sql` | Authorization and workflow invariants |
| Live verification | `scripts/verify-*.mjs` | Project identity, Auth, backend, and full workflow checks |

## Trust boundaries

### Browser to Next.js

Treat every request body, route parameter, header, and uploaded file as untrusted. API routes bound JSON input before parsing. The resume flow uses a server-created storage path and validates the uploaded bytes before the document becomes usable.

### Next.js to Supabase

The database is the final authorization boundary. Privileged RPCs derive the actor from `auth.uid()`, derive the cycle from stored records, and check capabilities inside the transaction.

The browser uses the publishable Supabase key. Server-only administration uses the service-role key through `src/lib/supabase/admin.ts`. Client code must never import that module.

### Supabase to external delivery

The database commits business state before the application attempts email delivery. The notification outbox tracks delivery separately so a provider failure cannot roll back or repeat a decision.

### Public content release

`src/content/projects.public.ts` is the public case-study boundary. `scripts/export-public-projects.mjs` requires client and MECG approval and emits only allowlisted fields.

## Authorization model

Memberships are scoped to a recruitment cycle. The active roles are:

- `MEMBER`
- `RECRUITMENT_COMMITTEE`
- `BOARD`
- `PANEL`
- `OWNER`

`src/lib/authorization.ts` maps roles to application permissions. PostgreSQL functions repeat the decisive checks. RLS remains enabled on recruitment tables.

Applicants own their application records. Members see assigned work but not peer scores. Screening reviewers receive pseudonymous packets. Panel-only Hash users receive applicant codes rather than identity data. Conflicts remove access and block writes.

## State ownership

PostgreSQL owns durable workflow state. React components own temporary form state. Do not add a second durable workflow state store in the browser or Vercel runtime.

The main state machines cover:

- Recruitment cycles
- Evaluation rounds
- Applications
- Screening batches, packets, and assignments
- Evaluations
- Decisions and approvals
- Resume documents
- Notifications

## Failure behavior

- Authorization fails closed.
- Invalid workflow transitions return a conflict response.
- Missing optional email configuration degrades delivery but does not corrupt business state.
- Health probes time out and return 503 without database details.
- Resume validation rejects unparseable, encrypted, scripted, embedded, oversized, or overlong PDFs.
- Scheduled cleanup requires `CRON_SECRET`.

## Verification layers

Use the layers in this order:

1. Pure unit tests for scoring, parsing, transitions, and distribution.
2. Route tests with mocked dependencies.
3. TypeScript and ESLint.
4. Production build.
5. PostgreSQL lint and pgTAP.
6. Browser tests against an isolated stack.
7. Protected staging verification.
8. Production smoke checks after deployment.

The [release checklist](release-checklist.md) names the required commands.
