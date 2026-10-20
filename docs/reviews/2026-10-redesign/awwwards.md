# Awwwards reference review — 2026-10-16

Independent AI specialist review; this is not a user study or evidence of conversion lift.
Scope: read-only source/web research; only this report written. No implementation or subdelegation.
Authority: `docs/DESIGN.md`, especially lines 13–20, 49–60, 68–70; preserve Precision Instrument.
Read homepage source and inspected the live [homepage](https://mecgmichigan.com/home) at 1280×800; its content order matched source.
Source references describe this concurrent-work snapshot; recheck before implementation. Mobile, keyboard and performance were not tested.
Method limitation: Impeccable context launcher returned permission denied; used project documents directly. No detector or formal dual-agent critique run.

## Confirmed defects against the documented design

- **P1 — Proof is absent from home.** `src/app/(marketing)/home/page.tsx:75` begins welcome, president, history, pillars and community photos after stats; there are no client, featured-engagement or semester-spec sections anywhere in that file. This conflicts with `docs/DESIGN.md:14`; prospects must leave home to find named client evidence.
- **P1 — Explicitly prohibited welcome material.** `src/app/(marketing)/home/page.tsx:76` says “Welcome to MECG”; line 84 introduces the president's welcome. Both contradict `docs/DESIGN.md:56`. Move relevant people/history material to team; replace homepage space with evidence.
- **P2 — Numbering system missing.** Home imports `SectionHeading`, never `SectionLabel` (`src/app/(marketing)/home/page.tsx:6`); `src/components/section-heading.tsx:9` outputs only an h2 and `src/components/marketing-section.tsx:31` adds no label. Violates `docs/DESIGN.md:16`; restore numbered labels with the existing `src/components/section-label.tsx:13`.
- **P2 — People carousel contradicts the system.** `src/app/(marketing)/home/page.tsx:18` defines seven community images and line 130 renders `PhotoCarousel`; `docs/DESIGN.md:59` explicitly prohibits people carousels. Prefer a small static, captioned culture selection on join/team.
- **P2 — Photographs lack prescribed figure captions.** President/history images at `src/app/(marketing)/home/page.tsx:92` and :105 have no caption or hairline class; carousel image wrappers at `src/components/photo-carousel.tsx:44` have a frame but no caption. Alt text does not supply the visible context required by `docs/DESIGN.md:18`.

## Three Awwwards-listed references

Listing confirms inclusion only. No award, score, or causal usability claims are made. Current sites may differ from their historical listed versions.

### 1. Leva — engineering consultancy

- Sources: [Awwwards listing](https://www.awwwards.com/sites/leva-engineering-consultancy), [current site](https://www.leva.io/).
- Observed in current page content: explicit engineering contact action; trust-logo band; capabilities interleaved with named installation links; project entries pair an image, title, short explanation and project link. Feasibility/prototyping text names CAD, force loads and fabrication methods.
- Apply: pair one MECG capability with one approved client question and deliverable; follow with a compact engagement specification. Make evidence reachable through ordinary links.
- Pitfalls: Leva has a substantial physical-artifact inventory and embedded video; MECG's documented inventory does not. Its kinetic offering does not justify decorative kinetic animation for MECG. Do not imply MECG performs Leva's mechanical fabrication services.

### 2. Skaled — consulting / revenue performance

- Sources: [Awwwards listing index naming Skaled](https://www.awwwards.com/websites/%233C0576/?page=65), [current site](https://skaled.com/).
- Observed in current page content: a direct service-category explanation, experience figures beside service scope, a specific report CTA describing bottlenecks and a roadmap, and testimonials followed by relevant service links.
- Apply: explain what an inquiry yields using MECG's existing process facts; connect scope → evidence → handoff rather than repeating organizational history. Existing material is in `src/lib/site-content.ts:167` and :174.
- Pitfalls: its commercial AI positioning and figures belong to Skaled. Do not transfer metrics, testimonials, report promises or aggressive ROI language. The individual Awwwards detail URL timed out; listing verification uses the index, and current content is not asserted to be the historical design.

### 3. D.Potfer Studio — consulting / communication

- Sources: [Awwwards listing](https://www.awwwards.com/sites/d-potfer-studio), [archived gallery element](https://www.awwwards.com/inspiration/carrousel-gallery-d-potfer), [archived navigation element](https://www.awwwards.com/inspiration/navigation-transition-d-potfer), [site](https://dpotferstudio.com/).
- Observed in listing/archive metadata: black/gray/white palette; typography and portfolio emphasis; a project-gallery carousel and a project-page navigation transition are explicitly documented. Live site fetch returned 502; animation behavior and present layout were not verified.
- Apply: let type hierarchy and an economical palette carry client-question rows; make each row a clear route into the engagement. Keep MECG's own navy/paper/orange roles.
- Pitfalls: gallery interaction is not evidence of better discovery. Do not reproduce its carousel, transition choreography or gray text values; these can conflict with MECG's motion, people-carousel and contrast rules.

## Hypotheses requiring validation

- Showing named clients and an approved engagement before culture may help prospects judge fit faster. Validate task completion with actual prospects; this audit supplies no user evidence.
- A hero that states the client task more directly may communicate more than the organization-name headline (`src/app/(marketing)/home/page.tsx:46`). Check comprehension before changing approved copy.
- A captioned working-session image may strengthen credibility compared with social imagery; asset suitability and publishing permission remain unverified (`docs/DESIGN.md:68`).

## Implementation recommendations, in order

1. Restore hero → stats → clients → featured engagement → semester spec before people. Reuse `PAST_PROJECTS` and `SEMESTER_FACTS` (`src/lib/site-content.ts:21`, :158); neither client descriptions nor logos prove project outcomes.
2. Use an approved public project from the existing work-page pipeline (`src/app/(marketing)/work/page.tsx:33`, :62). If unavailable, render the documented pending-approval status; never manufacture a question, result, quote or artifact.
3. Add `SectionLabel` to every home section; use hairline rows, sans prose and mono metadata. Replace welcome/president/carousel space with that proof structure.
4. Preserve the existing two hero actions (`src/app/(marketing)/home/page.tsx:53`); add concise engagement expectations using established process content, without multiplying CTA styles.
5. Validate the implemented home at desktop and narrow widths: reading order, keyboard access, captions, contrast, reduced motion, and inquiry/join destinations. Confirm factual claims with the board separately.
