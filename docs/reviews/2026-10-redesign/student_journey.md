# Prospective student journey: Join → Apply → Applicant

Source audit, 2026-10-16. One independent AI specialist review, not a user study.
Scope: current source only; no live browser, authenticated session, or account writes.
Authority: `docs/DESIGN.md`, especially useful actions, plain status language, and motion that never delays work.
Findings are ranked by task impact. “Confirmed” describes code; student outcomes remain hypotheses.

## 1. Applicant: a failed schedule lookup can claim there is nothing to do

**Confirmed defect (high):** `src/app/applicant/page.tsx:189–203` destructures only
`data` from `applicant_schedule`, discarding its error. `scheduleFromJson` converts
null to `{}` (`:102–104`); the next-action calculation then sees no bookings or
open slots (`:227–239`) and can display “No action needed / You're caught up”
(`:303–307`) for an unreleased application with no higher-priority action.

**Hypothesis:** during a schedule-service failure, applicants may stop checking
for an invitation or conclude that an existing booking disappeared.

**Action:** preserve the RPC error and render “Your schedule could not be loaded”
with retry and recruitment-team contact. Suppress schedule-dependent reassurance
until a successful load; retain the rest of the application page.
**Verify:** force only `applicant_schedule` to fail and confirm the page never
claims “caught up” or an empty confirmed schedule as established fact.

## 2. Join: preparation advice points to evaluation guidance that is never rendered

**Confirmed defect (medium):** the “How do I prepare?” FAQ says “Read how we
evaluate” (`src/lib/join-content.ts:85`). The criteria already exist in
`EVALUATION_TRAITS` (`:64–69`), but have no consumer anywhere in `src`.
Join imports only `JOIN_FAQS` and `JOIN_REASONS`
(`src/app/(marketing)/join/page.tsx:9`), and renders FAQ answers as plain text,
without a destination (`:134–138`). Recruitment-stage explanations also exist
unused in `src/lib/join-content.ts:37–62`.

**Hypothesis:** first-time applicants may seek preparation help elsewhere or
misunderstand the distinction between open events and evaluated rounds.

**Action:** render the existing evaluation criteria and short stage explanations
on Join; link the FAQ directly to that section. Keep attendance-versus-evaluation
language explicit and preserve the current factual copy.
**Verify:** a reader can follow the preparation FAQ to named criteria and identify
which rounds are evaluated without opening an account.

## 3. Apply: required uploads are disclosed after account creation and written answers

**Confirmed gap (medium):** Join and the signed-out Apply/signup surfaces provide
no materials checklist (`src/app/(marketing)/join/page.tsx:67–145`;
`src/app/apply/page.tsx:160–173,218–220`;
`src/app/apply/applicant-signup-form.tsx:178–189`). The resume requirement and
PDF/10 MB limit appear in Materials (`src/app/apply/application-form.tsx:534–535`),
rendered after Details and Responses (`:483–486`). Validation blocks progress
without a resume and, when supported, a photo (`:344–348`).

**Hypothesis:** students starting on a phone or near the deadline may discover
too late that they need files prepared, interrupting an otherwise saved draft.
This audit does not establish abandonment or the accuracy of “About 15 minutes.”

**Action:** add a compact pre-account checklist on Apply, linked from Join:
required resume PDF ≤10 MB, photo when supported, written responses, and draft
saving. Repeat the actual closing date/time beside the signed-in time estimate.
**Verify:** before signup, a prospective student can name required materials;
after signup, the deadline remains visible without returning to Join.

No code changed. No subdelegation. Questions skipped: fixed read-only review brief.
