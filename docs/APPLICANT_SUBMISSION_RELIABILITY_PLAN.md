# Applicant submission reliability plan

Status: implemented; database migration and staging release checks pending

Date: 2026-09-10

## Outcome

An applicant must be able to finish and submit even when autosave, storage,
email, or an upstream dependency is slow or temporarily unavailable. A failed
request must not lose newer answers, invalidate a previously good document, or
leave the interface waiting forever.

## Reliability contract

- The final submission uses the complete form payload and never depends on an
  unbounded autosave queue.
- Every browser network phase has a deadline and an actionable retry state.
- The newest valid draft wins across server and browser recovery copies.
- Resume and headshot readiness comes from authoritative persisted state, not a
  stale path in a draft.
- Failed and cancelled uploads cannot permanently exhaust a cycle quota.
- A committed application is durable and idempotently discoverable even if the
  response is interrupted.
- Expected failures have stable public codes, truthful HTTP statuses, and a
  privacy-safe support reference.
- Confirmation delivery happens from a durable outbox and never delays the
  application commit response.

## Implementation sequence

### Gate 1 — prevent applicant dead ends

1. Bound draft, submit, resume, headshot, and direct-storage requests.
2. Let step navigation and final submission proceed independently of a failed
   or timed-out autosave.
3. Show the full save failure and retry action at every viewport size.
4. Preserve the last known good headshot during a failed replacement and allow
   valid PDF files whose browser MIME metadata is empty.
5. Validate all steps immediately before submission and focus the first field
   that needs attention.

### Gate 2 — preserve authoritative state

1. Clear browser recovery only after a matching server save; any remaining
   scoped browser snapshot is unacknowledged and wins on reload without relying
   on unrelated device and server clocks.
2. Resolve the current READY resume from the document lifecycle rather than
   accepting a draft path as proof that a file exists.
3. Compensate a failed signed-upload setup so it cannot orphan an undiscoverable
   pending row.
4. Make upload attempt limits time-bounded and status-aware; retain abuse
   protection without permanently penalizing ordinary failures.
5. Reconcile an ambiguous submit response against the caller's application
   status before presenting failure.

### Gate 3 — truthful errors and operations

1. Distinguish rate-limit rejection from rate-limit dependency failure.
2. Distinguish signed-out users from identity/profile dependency failures.
3. Return stable, non-sensitive application error codes with field or recovery
   guidance while keeping raw database messages private.
4. Add structured events for identity, draft, upload, submit, reconciliation,
   and notification phases. Events contain timing, outcome, and a correlation
   ID, never answers, tokens, or file contents.
5. Insert the application receipt into the notification outbox in the submit
   transaction and let the existing worker retry delivery.

## Verification gates

- Unit and route tests cover deadlines, stale recovery precedence, limiter
  unavailability, actionable error mapping, and ambiguous submission results.
- Upload tests cover empty MIME metadata, signed-URL compensation, cancelled
  attempts, previous-file preservation, and quota recovery.
- Database tests cover concurrent/idempotent submit, transactional outbox
  creation, upload quota windows, and rollback behavior.
- Browser tests cover desktop and mobile application completion with injected
  draft, upload, submit, and response failures.
- Required repository gates: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run check:sql`, production-mode `npm run build`, and the Supabase test
  suite when a local or linked test database is available.

## Implementation record

- Completed bounded, coalesced autosave and independent full-payload submit.
- Completed server-authoritative draft/resume recovery, including NEEDS_INFO
  reconstruction, removed-question filtering, and clock-independent recovery.
- Completed bounded ambiguous-submit polling with idempotent retry guidance.
- Completed versioned, durable transactional application-receipt enqueueing,
  with immediate post-response delivery and the scheduled worker as fallback.
- Completed truthful rate-limit/auth dependency statuses and correlated,
  privacy-safe draft, submit, reconciliation, and primary upload events.
- Added an environment-gated Playwright harness that runs the interrupted
  autosave/submit journey in desktop and mobile Chromium.

## Release and incident checks

1. The versioned submission RPC is a rollout handshake: database-first keeps
   old instances on their legacy receipt path; application-first falls back to
   the legacy RPC and direct receipt until the migration is present.
2. Run one controlled staging application from fresh Clerk signup through the
   applicant confirmation page.
3. During an active-cycle incident, extend the application deadline or provide
   a Board-approved manual intake path before deploying a broad repair.
4. Monitor draft, upload-finalize, submit, and identity failure ratios after
   release and keep rollback limited to application code; repair applied schema
   with a forward migration.

## Non-goals

- No new queue, cache, database, or production dependency.
- No weakening of ownership checks, PDF validation, RLS, or submission
  idempotency.
- No logging of applicant-provided content or authentication material.
