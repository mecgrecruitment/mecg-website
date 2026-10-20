# Mobile proof and process hierarchy — panel 012 follow-up

2026-10-16. Scoped implementation review using design-system-workflow, frontend-design, project Precision Instrument authority and the existing Awwwards research in `awwwards.md`. This is an AI design review and local browser evidence, not a participant study or a new panel vote.

## Disposition

**Change the mobile bench presentation.** At narrow widths the full hero bench previously placed organization figures at y=1321px in the 390px local capture. A clearly labeled “Explore the four steps” disclosure now makes the complete interactive bench optional before the figures, which start at y=903px in the same-width revised capture. The disclosure has expanded state, controlled content IDs, native button keyboard activation and an explicit close action. Its content is available on demand; no step, output, illustration or client caveat was removed. Desktop continues to display the complete bench immediately. Below 380px, expanded stations use one column to prevent long labels clipping in their cells.

**Change the repeated process section.** The later section now explains working together through existing FAQ copy: project fit, meeting cadence and the inquiry response. Existing semester cost, length, team and NDA terms remain. It no longer repeats all four bench steps and outputs. The bench remains the complete four-step explanation.

**Keep the authored identity and factual boundaries.** The Precision Instrument type, hairlines, semantic colors, numbered sections, two audience actions and real culture photograph remain. Past organizations are labeled as partnerships; pending case studies remain pending. The real photograph remains captioned as a PwC member visit, not a project artifact. Panel012's approved engagement-proof finding is still open: code cannot manufacture client approval or an inspectable deliverable.

The existing Awwwards research supports evidence before process exposition and scope/evidence/handoff clarity (Leva and Skaled), while explicitly rejecting transferred proof claims, carousels or motion. This revision applies that hierarchy within MECG's established visual system.

## Verification

- Visually inspected Chromium full-page captures at 390px and 1280px, plus the expanded bench at 320px. The initial expanded 320px inspection found clipped station labels; the one-column correction was recaptured and inspected.
- Captured the revised page and exercised expand, station04 selection and collapse at Chromium320/390 and WebKit390. Document scroll widths matched each viewport. Captured desktop1280 retains the full bench.
- Existing engagement-instrument journey updated to open the disclosure by keyboard on narrow projects. **5/5 pass**: desktop/mobile Chromium, Firefox, desktop/mobile WebKit; reduced-motion carriage behavior and both first/final handoff text checked. Raw result: `evidence/mobile-hierarchy-browser.log`.
- Scoped ESLint passes for the component, homepage and journey test. Parent owns aggregate build/type verification.
- Captures: `.audit/mobile-hierarchy-before-390.png`, `.audit/mobile-hierarchy-after-390.png`, `.audit/mobile-hierarchy-after-320.png`, `.audit/mobile-hierarchy-after-1280.png`, `.audit/mobile-hierarchy-after-webkit-390.png`, `.audit/mobile-hierarchy-expanded-after-320.png`. Capture log: `/tmp/mecg-home-mobile-capture-final.log`. Next development indicator is hidden in final captures; expanded detail captures neutralize the sticky header position solely to avoid screenshot occlusion.

The baseline was the existing production build on local port3001; revised captures used the current development server on port3000. Both use local unavailable-service fixtures. Their vertical coordinates describe these captures, not field conversion, physical-device behavior or performance. Some lazy images in full-page WebKit capture are not loaded; the Chromium capture supplies the actual culture-photo visual inspection. No hosted provider, client inquiry delivery, human comprehension, conversion, full-page screen-reader audit or new Lighthouse result is claimed.
