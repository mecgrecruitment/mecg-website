# Deck result application recovery

2026-10-16. Current-tree response to V2 seat 021's consequential failure-announcement finding. The V2 snapshot and vote are unchanged.

Previously an unsuccessful result application cleared the pending live message and rendered an ordinary footer paragraph. The deck also used an unbounded request helper and stamped any successful HTTP body, including a missing or invalid result identifier.

The current deck has a persistent alert region associated with the explicit result action. An asynchronous rejection moves keyboard focus to its recovery summary, keeps the applicant on screen, and exposes an explicit retry. Pointer failures use a separate persistent alert in the footer. Native keyboard guards, motion preferences, cycle-scoped links, and score calculations remain unchanged.

Result application now bounds the complete authorized request and JSON consumption at 15 seconds, using the established `fetchJsonWithTimeout` helper. A successful response must contain the exact current-stage pass status from `HASH_STAGE_RULES` or `REJECTED`, matching the SQL `apply_stage_hash_result` contract. This changes acknowledgement validation, not voting or grading rules. The old accessibility fixture returned `ADVANCED`, which is not this RPC's result contract; it now returns `IN_PROCESS` for the Group Case stage. An explicit malformed-receipt test retains `ADVANCED` to prove it cannot confirm success.

Lost transport, malformed success, HTTP 408/5xx, and deadline expiry show an unknown outcome: the write may already be saved. They create no stamp or confetti, do not advance the deck, and block blind application repetition until the operator checks Hash and reloads authoritative saved results. The check link preserves the cycle and opens a new tab; reload is explicit. A synchronous in-flight guard also prevents repeated result application while one request is pending. Definitive client rejections preserve an accessible retry. No automatic result retry or automatic card advancement is introduced.

## Verification

Focused ESLint, `npx tsc --noEmit`, and `git diff --check` passed. Eleven scenarios across Chromium desktop/Pixel 7, Firefox desktop, WebKit desktop/iPhone 13 yielded **55/55 passing browser checks** in 29.2 seconds. Runtime: Docker Playwright 1.64.1 against the existing synthetic localhost:3000 dev server.

Four new scenarios exercise keyboard application rejected with 409 and an announced/focused retry; lost application transport; an invalid successful receipt; and response headers followed by JSON that never settles. Unknown scenarios verify the same applicant remains visible, no stamp/confetti/next-unapplied control appears, the apply action stays disabled, no additional apply occurs, and recovery controls remain keyboard reachable. The deadline test advances the browser clock after a genuinely pending JSON promise. Existing motion and shortcut checks remain in the run.

[Raw browser log](evidence/deck-result-recovery-browser.log). Failure artifacts would be retained under `.audit/deck-result-recovery`; this run had no failures.

This proves synthetic browser behavior, not a screen-reader session, hosted provider recovery, physical-device testing, or a new panel endorsement. The timeout cannot cancel a server transaction that already committed; the unknown-outcome copy and repeat guard deliberately preserve that uncertainty. The presentation-pointer request still uses the pre-existing helper; this change bounds the consequential result-application operation.
