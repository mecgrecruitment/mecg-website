# Homepage refinement result — October 17, 2026

The homepage now uses a light header and cool-paper opening, deep-blue text and restrained orange actions. Smaller responsive type and a compact factual band leave more room for actual chapter photographs and concrete project questions. This refines MECG's established blue/orange world and retained system font; private interfaces remain outside the change.

## Implemented surface

- Two real chapter photographs are manually selectable, with matching captions and selected-state feedback. There is no autoplay. A separate community photograph keeps membership context distinct from client evidence.
- Five project areas change an explicitly labeled example question and approach. “Discuss this question” carries the chosen area to the contact form's editable subject. A single string query value is trimmed and limited to 150 characters; repeated subject parameters are ignored. Prefilling does not submit the form.
- Four process controls expose the existing engagement steps and “What you leave with” handoffs. Native FAQ disclosures retain practical engagement information. Selected process state uses an underline as well as color.
- Choice panels use brief CSS feedback; reduced-motion preferences remove their movement. No new runtime dependency or external font request was introduced.
- Existing fact sources, past-organization attribution, client-approved featured-project conditional, all-major eligibility and live recruitment actions remain in use. Examples and community photography do not establish client outcomes.

The final explorer introduction reads “A few questions we could explore together.” This copy-only adjustment followed the independent review to remove canned contrastive phrasing; the changed desktop/mobile region was recaptured, and the reviewer confirmed that Ship remains the disposition.

## Verification and disposition

The implementation pass reports 22 passing `public-journeys` Playwright checks: 11 each in desktop and mobile Chromium, covering public routes, contact flow, selected-area subject prefilling and editing, photo selection, step handoffs, menu Escape/focus return and reduced motion. Two public-entry smoke checks also passed. TypeScript checking, targeted ESLint and `git diff --check` passed. These checks were reported by the implementing agent and were not rerun during this documentation pass.

The independent [finish review](FINISH-REVIEW.md) gives a **Ship** disposition for the saved desktop/mobile screenshots and supporting source it inspected. It found coherent color/proportion, purposeful interactions and sound composition in the reviewed mobile regions. Its screenshot inventory and accepted tradeoffs remain the authoritative record of that review. The final confirmation additionally inspected the revised introduction, selected Data state and closing/footer capture; its scope remains the listed views and changes.

[Solid text-pair calculations](CONTRAST.md) record authored opaque color-pair luminance ratios, from 5.81:1 to 15.03:1. They support those specific pairs and do not constitute a computed-style or full accessibility audit.

## Limits

The public preview on port 3000 uses a placeholder backend. The isolated read-only sample preview on port 3010 was synchronized and browser-checked for the new headline, light header, question explorer and absence of horizontal overflow. No external deployment or real message delivery test occurred. Mocked inquiry confirmation verifies UI behavior, not board email receipt.

The reviewer did not independently rerun functional checks, measure computed contrast, exercise every topic/photo/step or all focus/hover/loading/error states, or inspect a complete mobile community/closing/footer capture. The final confirmation includes a desktop closing/footer capture. Development indicators visible in some captures are local overlays. No design detector ran because the context launcher received permission denied; direct project context and manual review supplied the design evidence.

The evidence does not establish production readiness, full accessibility conformance, conversion improvement, real-user acceptance or cross-browser coverage beyond the reported Chromium checks. `docs/PRODUCT.md` still refers to the historical Precision Instrument identity; that pre-existing context drift is preserved outside this homepage documentation scope.

## Source inventory

- [Direction](DIRECTION.md), [independent review](FINISH-REVIEW.md) and [contrast calculations](CONTRAST.md).
- [Product context](../../PRODUCT.md) and the narrowly updated current-homepage rule in [design guidance](../../DESIGN.md). Historical and private-workspace rules are preserved.
- `src/app/(marketing)/home/page.tsx` and `home.css`: composition, responsive type, surface colors, native FAQs and motion rules.
- `src/components/home-photo.tsx`, `home-project-explorer.tsx` and `home-engagement.tsx`: manual photographs, example questions/contact link and process handoffs.
- `src/components/site-header.tsx`: homepage-specific header class; `src/app/(marketing)/contact/page.tsx` and `contact-form.tsx`: bounded subject input and editable form default.
- `src/lib/site-content.ts`, public recruitment helpers and public-project release helpers: existing factual, recruitment and approved-project boundaries.
- `public/mecg/chapter-presentation-2026.jpeg`, `chicago-community-2026.jpeg` and `community-green-day.jpeg`: actual chapter imagery.
- `tests/e2e/public-journeys.spec.ts`, `tests/e2e/public-smoke.spec.ts` and `playwright.config.ts`: browser behavior checks and desktop/mobile project definitions.

This documentation pass changes only the current-homepage bullet in `docs/DESIGN.md` and this result record. It does not change UI code or repair unrelated canonical-context drift.

## Selected-photo follow-up

The user selected the PwC-visit photograph and rejected the panoramic treatment. Updated the default to `members-professional.jpeg`, widened the desktop image column, reduced headline scale, and used a taller frame matching the original 1600:1126 aspect ratio with a modest 10% zoom that keeps the full group visible. Mobile places the photo before the longer explanation. Chicago remains the optional second view.

Verified at1280×800 and390×844. Six targeted desktop/mobile Playwright checks passed (homepage fit, photo selection and project-to-contact flow); TypeScript, targeted ESLint and diff checks passed. The isolated3010preview was relaunched with the updated source. No deployment.

## Homepage clarity follow-up

Implemented the approved five refinements: a tighter 28% PwC crop retaining the full group; the headline “Pro bono consulting, led by Michigan students.”; a shorter two-sentence introduction; a fixed hero photo with one caption and Chicago moved to the community section; and the interactive question explorer directly after the hero/facts, before partner logos. Removed the photo selector and its client state. Retained the blue/orange identity, live recruitment links, approved-project boundary and editable inquiry flow.

Verified the updated hero at 1280×800 and 390×844 in the collaborative browser. All 22 desktop/mobile public-journey checks passed, including keyboard question selection, contact subject editing, menu focus return, reduced motion, photo placement and section order. TypeScript, targeted ESLint and `git diff --check` passed. The contact confirmation test intercepts the response; real delivery and deployment were not exercised. Preview is the isolated read-only sample environment on port 3010.
