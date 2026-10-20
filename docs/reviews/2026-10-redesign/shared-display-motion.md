# Shared-display motion control

2026-10-16. Follow-up to panel seat 028's presentation-motion objection. This is current-tree implementation evidence; it does not change the frozen panel vote.

The Hash discussion deck now exposes a keyboard-operable **Presentation motion** button with a stable accessible name and pressed state. The supporting sentence says whether motion is enabled for this browser tab, disabled by the presenter, or disabled by the device's reduced-motion setting. An operating-system reduction request disables the button and always wins over an enabled tab preference, including changes made while the deck is open. Rendering starts still until that preference is known.

Turning motion off removes card entrances, shimmer, headshot movement, stamps, screen shake, confetti, and transitions throughout this deck. Explicit result application skips its decorative 1.2-second delay. Essential result information, navigation, cycle-scoped links, and the existing application action remain available. Scores now render directly rather than counting up, consistent with `docs/DESIGN.md`'s requirement that real numbers never count up from zero.

Only a non-sensitive `on`/`off` preference is saved in `sessionStorage`; no candidate information is added. Both storage reads and writes tolerate unavailable browser storage. The preference persists through a reload in this browser tab. There is no account-wide or cross-device preference claim. If storage is blocked, the control works in memory for that page.

## Verification

- Focused ESLint passed for the deck and accessibility spec; `npx tsc --noEmit` passed.
- `git diff --check` passed on the current shared tree.
- Seven real-browser scenarios × five configured engines/devices = **35/35 passed** in 22.9 seconds. Docker Playwright 1.64.1, existing synthetic dev server on localhost:3000; Chromium desktop/Pixel 7, Firefox desktop, WebKit desktop/iPhone 13.
- Three new scenarios cover keyboard toggling without applying a result; retained off state after reload; zero computed animation/transition and immediate explicit application with a frozen clock; enabled preference overridden by OS reduction before/after reload and during the session; and blocked session-storage recovery.
- Existing checks still cover native Enter handling, headshot failure before hydration, Exit activation, and reduced-motion reveal without confetti or decorative delay.
- Raw output: [deck-motion-browser.log](evidence/deck-motion-browser.log). Browser artifacts: `.audit/deck-motion-followup` (retained on failure; this run passed).

These are synthetic local-browser checks. They do not prove a real shared-display usability study, human designer endorsement, hosted authentication, or unanimity of a new 100-agent review.
