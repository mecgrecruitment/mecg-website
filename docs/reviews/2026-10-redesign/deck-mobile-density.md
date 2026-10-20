# Discussion deck: compact mobile identity

2026-10-17. Later local working tree; frozen panel votes unchanged.

The actual390px capture showed the224px portrait and large stacked identity pushing Room vote toward the bottom of the first screen. The current responsive layout uses a64px portrait beside the applicant name and metadata below640px, with compact card padding and24px grouping. The desktop presentation retains its224px portrait, centered60px name and existing spacing. Identity still appears before the voting action; scoring and result semantics are unchanged.

A final single browser run passed **90/90 checks** across desktop/mobile Chromium, Firefox and desktop/mobile WebKit. Three added viewport journeys per configuration check a ready quorum at320×900,390×844 and1280×900. On both narrow fixtures the entire ready voting action and applicant heading are inside the initial viewport. Desktop explicitly retains the224px portrait. No result is applied by rendering or resizing; no horizontal document overflow occurs. Existing44px target, keyboard continuation, shortcut isolation, motion preference, image failure and uncertain/rejected-result recovery checks also pass.

Production build including TypeScript, focused ESLint and whitespace checks pass. The Impeccable mechanical detector returned an empty finding list. The before capture and final390px/1280px captures were visually inspected. [Raw logs, source hashes and captures](evidence/deck-mobile-density/) preserve exact evidence. This is a bounded refinement of the established design system, not a new palette, scoring rule or consequence flow.

The tests render actual gated components with fictional applicant data and intercepted local APIs in the official Playwright1.64.1 Linux Docker image. Before and after captures have different synthetic vote states: the initial target-size fixture has no votes, while final readiness fixtures deliberately supply a quorum. No numerical or grade change is inferred from the comparison. These checks do not establish hosted authorization, physical-device/assistive-technology behavior, human acceptance or universal first-screen fit for every possible name and metadata length.

The Impeccable context launcher also reported legacy PRODUCT metadata. That metadata migration is outside this refinement; no project facts or design authority were rewritten.
