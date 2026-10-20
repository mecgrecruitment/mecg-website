# Applicant recovery and submission audit

2026-10-16 · Independent AI specialist code review; not a user study.
Scope: read-only source inspection; only this report written. No runtime or database verification.
Design authority: `docs/DESIGN.md`, especially clear state feedback (§1.7) and declarative copy (§4).

## Top 3 evidence-backed risks

### 1. High — stale drafts can silently replace newer work

**Confirmed implementation gap:** browser recovery always wins over the server draft;
there is no revision/conflict check or choice before restoring all answers
(`src/app/apply/application-form.tsx:207–230`). The restored draft becomes dirty and
is autosaved (`:245–258`). Server persistence replaces the entire payload on conflict,
without an expected revision (`supabase/migrations/20260902290000_application_server_drafts.sql:152–156`).
Thus an old failed-save tab can overwrite work subsequently saved from another device.
The per-tab queue (`application-form.tsx:148–184`) cannot coordinate those writers.

**Hypothesis requiring reproduction:** an aborted save may also finish server-side after
a newer save. The queue releases on fetch timeout (`application-form.tsx:166–176`);
aborting fetch does not establish database cancellation (`src/lib/client-fetch.ts:15–21`).

Recommendation: enforce a server revision precondition; retain conflicting browser work
and offer an explicit recovery choice. Verify with two tabs and delayed writes.

### 2. High — browser recovery is promised even when it was not stored

**Confirmed defect:** storage failures return `false`
(`src/lib/application-draft-recovery.ts:190–197`), but the form ignores that result
(`src/app/apply/application-form.tsx:235–238`). A timed-out autosave nevertheless says
“Your answers are still in this browser” (`:168–170`). Recovery uses sessionStorage,
and snapshots expire after 24 hours (`src/lib/application-draft-recovery.ts:3,234`).
There is no indication whether the browser copy actually exists or how long it lasts.
If server saving also fails, reload can lose edits despite the reassurance.

Recommendation: track browser persistence success separately from server save state;
show an accurate failure message and provide copy/download recovery when both fail.
Verify storage exceptions, reload after failed save, and expired snapshots.

### 3. Medium — HTTP 500 skips submission reconciliation

**Confirmed recovery gap:** network exceptions and HTTP 502/503/504 trigger status
reconciliation, but HTTP 500 does not (`src/app/apply/application-form.tsx:403–419`).
The route can return 500 for an unexpected RPC response after the RPC call completes
(`src/app/api/apply/route.ts:67,90–94`), producing only “An unexpected error occurred.”

**Hypothesis requiring fault injection:** submission may already have committed when
the response is malformed or a downstream component returns 500. The applicant then
sees failure instead of the existing status-recovery path. No production incidence established.

Recommendation: reconcile any ambiguous server failure before declaring submission
unsuccessful; preserve an explicit “not yet confirmed” state if status is unavailable.
Verify POST 500 plus status SUBMITTED, and POST/status failures together.

## Double-click and persistence protections already present

- Submit checks pending state and disables its button
  (`src/app/apply/application-form.tsx:378,393,554`). Ordinary double-click duplication
  is not a confirmed defect. Database submission takes an actor advisory lock and
  returns the existing application on retry with the same resume
  (`supabase/migrations/20260902200000_launch_hardening.sql:70,93–102`).
- Receipt outbox inserts use an idempotency key
  (`supabase/migrations/20260907120000_applicant_submission_reliability.sql:154–163`).
- Browser recovery clears only after a matching acknowledged save or confirmed submit
  (`src/app/apply/application-form.tsx:161–164,394–398`); consent is not recovered.
- Existing `tests/e2e/application-reliability.spec.ts:3` covers failed autosave plus
  interrupted-submit reconciliation, but not the three scenarios above or double-clicks.

Priority: protect draft revisions first, make browser-save claims truthful second,
then extend ambiguous-submit reconciliation. Source findings reflect the inspected
workspace snapshot; concurrent implementation may change line positions.
