# Applicant draft and requested-changes status

This change addresses the source-derived dashboard finding in the frozen [panel-v2-062 report](./panel-100-v2/reports/panel-v2-062.json). The report itself was not changed. Its finding was that caller-owned DRAFT and NEEDS_INFO applications could be described as submitted/in review and, with an empty schedule, receive a caught-up message instead of an application action.

`src/app/applicant/application-status.ts` now supplies explicit editable-state presentation and a small application-access boundary. The real dashboard uses it in the hero, current application and earlier history:

- DRAFT reads “Your application is a draft” and “Draft · Not submitted,” explaining that saving is not submission.
- NEEDS_INFO reads “Your application needs changes” and “Changes requested · Resubmission needed.” It does not imply the requested update is already back in review.
- Both states use a plain status in place of the review stepper, so there are no fake completed Submitted steps. Historical editable rows keep that same truthful status.

Before offering editing, the dashboard uses its existing authenticated/RLS Supabase client to read only the relevant owned application ids, cycle ids and statuses, alongside the existing `intake_schema` authority. A matching owned application and current cycle, editable status, open intake, matching requested-changes state and valid versioned draft permit “Continue application” or “Review and resubmit” through the existing guarded `/apply` route. The dashboard does not grant editing permission or alter intake policy.

Closed intake or another cycle gives editing-unavailable guidance and a recruitment contact link. Failed, malformed or unverified lookup data gives unknown-access guidance, a reload instruction and contact. These states do not invent a deadline, say a deadline passed, or promise resubmission. An authoritative opportunity to start a new cycle remains available when the history’s draft is no longer editable.

A current draft or requested update takes priority over the schedule fallback. Actual bookings, public events and schedule lookup failures remain visible in their existing sections. Submitted/released decision, offer deadline/response, onboarding, withdrawal, application-received receipt and original-resume identification disclosure behavior remain unchanged. Editable attachments use the application workspace rather than the separate post-submission replacement controls.

## Verification

The focused helper and actual-dashboard SSR suite passed **24 tests**. The broader applicant/apply/auth-routing suite passed **45 tests**. Fixtures exercise both editable statuses in hero and history, genuine submitted current status beside editable history, prior released decisions, empty/booked/failed scheduling, public events, open/closed/failed/malformed/wrong-cycle editing access, starting a new cycle, receipt refusal for editable states and preservation of the identifying-original-resume disclosure for a real submission. TypeScript, targeted lint and diff whitespace checks passed.

The SSR tests render the actual dashboard and actual `PortalShell`; authentication and own-data services use explicit synthetic fixtures. Node adapts `next/image` to its equivalent static image element and stubs unrelated interactive client children. No fake hosted application or provider record is involved. Fixture HTML export is opt-in through `APPLICANT_STATUS_CAPTURE=1`.

Eight local Chromium renders checked the four open/closed DRAFT/NEEDS_INFO fixtures at **1440 × 1000** and **390 × 844**. They loaded the current local Next CSS and asserted a styled shell, correct heading/action target, no hero pipeline and no horizontal overflow. Representative desktop/mobile captures covering all four states were visually inspected: status/action copy is readable and the existing Precision Instrument hierarchy is retained. These are static synthetic SSR layout captures, not an authenticated hosted journey or evidence that every client action works.

Durable raw test/type/lint/visual logs, capture script, exact input hashes, synthetic HTML, visual result JSON and screenshots are in [evidence/applicant-editable-status](./evidence/applicant-editable-status/). Preliminary visual tooling attempts are retained separately: about:blank did not load local CSS, and navigating a live Next document before replacing its content let hydration restore that document. Final proof uses a browser-intercepted synthetic document at the local origin, with real CSS and no live app hydration, and explicitly asserts styling before capture. The earlier Node image-interoperability attempt is also retained; it was resolved by the test-only image adapter.

Browser capture used the established `mcr.microsoft.com/playwright:v1.64.1-noble` Docker runner with host networking and a mounted repository. The existing local server remained running; the task’s ephemeral browser container exited and was removed. No SQL, hosted data, deployment, frozen panel report or external message was changed. The Impeccable context launcher did not run due to its executable permission; project PRODUCT/DESIGN/routing guidance and the clarify/craft references were read directly instead.
