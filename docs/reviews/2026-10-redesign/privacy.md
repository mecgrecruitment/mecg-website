# Privacy review — 2026-10 redesign

Independent AI specialist code audit; not a user study. Read-only inspection of
`docs/DESIGN.md`, route/auth helpers, recruitment migrations, and retention policy.
No live requests, account changes, or production verification. Concurrent edits
may move line numbers; cited function names identify the inspected behavior.

## Top 3 confirmed defects

### 1. High — live Hash metadata bypasses candidate visibility controls
- Evidence: `src/app/api/member/hash/live/route.ts:16–40` accepts any listed internal
  membership, then uses `createAdminClient()` to read the presenting applicant's
  name, major, class year, and status. Line 55 returns this independently of notes.
- The regular ballot excludes conflicts, decided candidates, and pending decisions:
  `supabase/migrations/20260914190000_hash_ballot_major_year.sql:33–49`.
  `hash_applicant_notes` returns an empty result, rather than denying the request,
  for closed stages, ineligible statuses, and conflicts:
  `supabase/migrations/20260914180000_hash_presenting_and_notes.sql:67–77`.
- Consequently, when a presenter remains selected, a recused member can receive
  identifying metadata; a decided candidate's status can also reach members who
  cannot see that candidate on their ballot. A closed stage does not stop it.
- Fix: resolve presenting metadata through a caller-scoped RPC that enforces stage,
  conflict, candidate visibility, and outcome-release rules before returning it.

### 2. Medium — private resume delivery exposes reusable storage credentials
- Evidence: `src/app/api/admin/applications/[id]/resume/route.ts:18–24` creates a
  300-second signed URL and redirects the browser to it. The applicant equivalent
  does the same at `src/app/api/apply/resume/route.ts:21–26`.
- Initial authorization exists, but the redirect exposes the temporary credential
  in the browser's destination/history. Reusing that URL bypasses a fresh MECG
  session/conflict check during its validity window; redirect `no-store` does not
  remove the destination credential.
- Fix: stream bytes through the authorized same-origin route with private/no-store,
  following `src/app/api/member/screening/[assignmentId]/resume/route.ts:23–38`.
  This reduces credential exposure; it cannot revoke a previously downloaded PDF.

### 3. Medium — failure diagnostics copy identity data into infrastructure logs
- Evidence: `src/app/api/admin/rush/route.ts:117,127` explicitly logs the supplied
  email together with the Clerk user ID on rollback failure, plus raw error objects.
  Lines 113–118 also return provider-specific cleanup instructions in a 500 response.
- This creates another identifiable data copy outside recruitment access controls.
  It bypasses the metadata-only logging intent documented in
  `src/lib/operational-log.ts:42–44`; the client error also exposes operational detail.
- Fix: log a bounded error category and incident reference; keep identity lookup
  and provider cleanup details in a restricted remediation record. Return the
  reference and an actionable generic failure to the caller.

## Hypotheses / operational questions — not demonstrated breaches
- Production log readers, drains, retention, and actual occurrence of the failure
  branches above were not inspected. Raw provider/database errors may contain
  further personal data; that payload content is unverified.
- Retention is explicitly policy-blocked (`docs/data-retention.md:3–17`), and
  `supabase/migrations/20260902120000_hold_unapproved_retention.sql:5–7` disables
  archived-applicant anonymization. Confirm an approved retention/hold process;
  do not invent deletion periods. Actual production accumulation is unknown.

## Public/private separation and error handling checked
- `src/proxy.ts:43–63` rejects anonymous private APIs and redirects private pages;
  public marketing reads use an anonymous client (`src/lib/supabase/public.ts:6–12`).
- Resume access is checked by a conflict-aware RPC before signing
  (`supabase/migrations/20260902145000_resume_access_and_attach_consistency.sql:39–44`).
- `mapRpcError` masks unexpected errors (`src/lib/api-route.ts`, function
  `mapRpcError`); `src/app/member/error.tsx` renders generic workspace copy.
  No anonymous applicant-data disclosure was confirmed in the inspected paths.
