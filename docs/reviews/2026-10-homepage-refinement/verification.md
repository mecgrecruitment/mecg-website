# Homepage verification

October 17, 2026. Local preview: http://localhost:3001/home. Nothing deployed.

- Final production build passed, including TypeScript.
- Focused ESLint and diff whitespace checks passed.
- Existing public smoke expectation updated to the new headline; no new redundant unit tests.
- 12/12 selected checks passed against the final production preview: public entry redirect and content; one heading, metadata and viewport fit; mobile-menu Escape/focus return; engagement-station handoff and reduced motion. Profiles: desktop Chromium, mobile Chromium, desktop Firefox.
- Initial cross-browser run: 8 Chromium-profile checks passed; 12 Firefox/WebKit cases could not launch because browser executables were absent. Installed browser binaries and repeated Firefox successfully. WebKit host requirements remain unavailable (libicu74/libxml2/libflite1); Safari behavior is unverified in this pass. No system packages were changed.
- After the 320px counter adjustment, three focused instrument checks passed in the same available profiles. Final production 12/12 results include that correction.
- Shared-browser inspection covered desktop 1280px, mobile 390px and narrow 320px, plus the lower homepage sections and expanded final process station. No horizontal page overflow at tested narrow widths. Final 390px production view has both audience actions visible by y553; no broken main-content images.
- SVG camera framing retains all geometry: bench bounds x84.9–515.1, y66.9–327.8; moving head remains inside the new viewBox at every station. Existing transition and operating-system reduced-motion behavior retained.
- Desktop hero reduced from 857px to 703px at 1280px width. Mobile headline now takes two lines at 320px and 390px.

## Evidence
Before and two design rounds, plus final clean production captures, are in evidence/. Critique history is in CRITIQUE.md. Logs: /tmp/mecg-homepage-refinement-production-tests.log, /tmp/mecg-homepage-refinement-build-final.log, /tmp/mecg-homepage-refinement-lint.log.

This is UI verification against the local fallback configuration. It does not prove hosted authentication, real-provider integrations, actual user task success or SEO ranking gains.
