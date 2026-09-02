# MECG professional website scorecard

Review date: September 1, 2026
Scope: MECG's `/design-preview` prototype and current public pages from nine relevant organizations.
Sources: First-party websites and the MECG repository only.

## Result

MECG scores **77 out of 100** after the responsive and interaction pass. That places the prototype above the two student-consulting references and one point below UNIT9, but below the professional firms and studios in this review.

The visual direction is not the main problem. MECG already has a specific position, a restrained graphic system, real photography, and a motion concept tied to consulting work. The score falls because the page cannot yet prove what the work changed. Six partner names and four scale facts do not replace a case study with a challenge, method, deliverable, and approved result.

A realistic next version scores **92 out of 100** if MECG publishes three strong case studies, commissions a small documentary photo library, and carries the prototype's conversion paths and motion rules into the live routes. The 92-point score is a design target, not a measured future result.

## Weighted rubric

| Category | Weight | What earns the points |
| --- | ---: | --- |
| Positioning clarity | 20 | A visitor can identify the audience, offer, difference, and next step from the opening screen. |
| Proof and case depth | 20 | Named work explains the challenge, approach, output, result, team, and date. Figures and quotes have context. |
| Visual authorship | 15 | Typography, composition, color, and graphic devices form a recognizable system tied to the organization. |
| Photography | 12 | Original images document people, work, and results. Captions and credits add context. |
| Motion and 3D purpose | 10 | Motion explains the offer or subject. It does not act as decoration. Static content carries the same meaning. |
| Navigation and conversion | 13 | Visitors can find work, services, people, and the right inquiry path without guessing. |
| Accessibility and performance evidence | 10 | The public page or source shows semantic structure, keyboard support, motion restraint, useful image text, or an explicit performance method. |

The scores are comparative editorial judgments, not analytics or lab measurements. A low accessibility and performance score means that the public pages did not provide enough evidence during this review. It does not prove that the site fails an audit.

## Ranking

| Rank | Organization | Position 20 | Proof 20 | Visual 15 | Photo 12 | Motion 10 | Nav 13 | Access and performance 10 | Total |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Arup | 18 | 20 | 13 | 12 | 6 | 12 | 9 | **90** |
| 2 | IDEO | 19 | 18 | 15 | 10 | 9 | 12 | 6 | **89** |
| 3 | Boston Consulting Group | 18 | 20 | 13 | 10 | 6 | 12 | 8 | **87** |
| 4 | BUCK | 17 | 16 | 15 | 8 | 10 | 11 | 7 | **84** |
| 5 | frog | 16 | 16 | 14 | 9 | 8 | 12 | 7 | **82** |
| 6 | McKinsey & Company | 17 | 18 | 12 | 8 | 5 | 12 | 8 | **80** |
| 7 | UNIT9 | 17 | 15 | 15 | 7 | 10 | 9 | 5 | **78** |
| 8 | MECG design preview | 18 | 8 | 14 | 8 | 9 | 11 | 9 | **77** |
| 9 | 180 Degrees Consulting | 17 | 17 | 11 | 9 | 5 | 12 | 5 | **76** |
| 10 | TAMID Group consulting | 15 | 9 | 8 | 5 | 2 | 10 | 8 | **57** |

## MECG score

### Verified observations

- The opening identifies the model as pro bono, one semester, University of Michigan, and teams of 6 to 8 students. It separates the client action from the student action. See [`page.tsx`](<../../src/app/(marketing)/design-preview/page.tsx>).
- The page names six organizations and publishes four aggregate facts. It explicitly withholds detailed outcomes until MECG and the organization approve publication. This is honest, but it leaves no project-level proof.
- Two MECG photographs have descriptive alternative text and factual captions. Both are group portraits. The page does not yet show a client session, an artifact, an analysis, or a delivered result.
- The decision model uses consulting terms such as define, analyze, model, and recommend. The SVG and its animation are tied to the method rather than a generic technology motif. See [`decision-model.tsx`](<../../src/app/(marketing)/design-preview/decision-model.tsx>).
- The CSS limits animation to `prefers-reduced-motion: no-preference`. The HTML caption carries the model's meaning when the SVG is hidden from assistive technology. See [`design-preview.module.css`](<../../src/app/(marketing)/design-preview/design-preview.module.css>).
- The shared header labels client and student paths separately, exposes the current page, and uses a real button with `aria-expanded` for the mobile menu. See [`site-header.tsx`](../../src/components/site-header.tsx).
- The browser suite verifies the preview at desktop and mobile widths, checks for horizontal overflow at 360 pixels, verifies the reduced-motion state, and reaches the skip link by keyboard. See [`public-smoke.spec.ts`](../../tests/e2e/public-smoke.spec.ts).

### Inference

The prototype feels more authored than the two student-organization references because the graphic language comes from MECG's work. It does not yet feel as credible as the top professional references because the method is illustrated in more detail than the results are documented. A polished mechanism beside an unproved claim creates the wrong emphasis.

### Current and potential score

| State | Position | Proof | Visual | Photo | Motion | Nav | Access and performance | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Finished interaction pass | 18 | 8 | 14 | 8 | 9 | 11 | 9 | **77** |
| After the remaining evidence and rollout work | 19 | 18 | 14 | 11 | 9 | 12 | 9 | **92** |

## Competitor evidence

### Arup

Verified observations:

- The [Arup homepage](https://www.arup.com/en-us/) opens with a sustainability position, links directly to projects, and introduces named employees with roles and portraits. It also provides a skip-to-content link.
- The [Marie Selby Botanical Gardens case study](https://www.arup.com/projects/marie-selby-botanical-gardens/) names the location, client, collaborators, services, and projected performance. It credits images, includes a client quote, and ends with a relevant contact route.
- The case states that the 877 kW solar array is projected to generate about 5 percent more energy than the campus consumes. This is specific proof with scope and context.

Inference: Arup is the best model for MECG's case-study structure and documentary photography. Its motion behavior and runtime performance were not measured.

### IDEO

Verified observations:

- The [IDEO homepage](https://www.ideo.com/) states its offer in one sentence, presents named client work near the top, and follows it with named client testimony.
- The [IDEO work index](https://www.ideo.com/work) supports search and category filters. Cards state the client and the change, such as H&M cutting excess inventory and Ford changing how it works.
- The contact prompt asks for details that can route the inquiry to the right person.

Inference: IDEO has the strongest verbal and visual authorship in the consulting group. The changing hero language suits a design firm, but copying that device would make MECG less specific.

### Boston Consulting Group

Verified observations:

- The [BCG client-impact library](https://www.bcg.com/about/client-impact) groups work by industry and capability. Its lead stories attach figures such as a 60 percent efficiency increase or two-times productivity to named work.
- The [Ergon Retail case study](https://www.bcg.com/about/client-impact/energy-retailer-transformation) separates the obstacle from the result. It reports one million migrated accounts, a 13-point rise in employee engagement, and customer happiness above 80 percent.
- The public page has a skip-to-main link and a distinct contact route.

Inference: BCG's content depth is far beyond MECG's needs. MECG should copy the evidence structure, not the library size.

### BUCK

Verified observations:

- The [BUCK homepage](https://buck.co/) uses one sentence and three selected projects rather than a long service explanation.
- The [Comfy brand refresh](https://buck.co/work/comfy-brand-refresh) explains how node-based product logic became dimensional forms, connections, typography, spatial composition, and motion.
- The page separates the visual system, type and color, motion, and credits. It names the people responsible for the work.

Inference: BUCK offers the strongest reference for purposeful motion. MECG's decision transmission follows the same sound principle because its motion comes from the consulting method. MECG should not copy BUCK's volume of movement.

### frog

Verified observations:

- The [frog homepage](https://www.frog.co/) separates work, services, culture, insights, careers, and contact. Its project inquiry names products, services, experiences, business models, and ways of working.
- The [frog work index](https://www.frog.co/work) reports 179 case studies and lets visitors browse by sector, service, or studio.
- Visible play language appears on media-led content. The public page also provides descriptive image labels for some items.

Inference: frog's taxonomy makes a large body of work legible. MECG should not add filters until it has enough cases to justify them.

### McKinsey & Company

Verified observations:

- The [McKinsey homepage](https://www.mckinsey.com/) labels current content by type, including survey, article, blog, podcast, and webinar. Services are grouped under industries, capabilities, and technology and AI.
- The [Cleansheet impact page](https://www.mckinsey.com/capabilities/operations/how-we-help-clients/cleansheet/our-impact) reports scoped results, including a 12 percent cost reduction in six months and more than $100 million in run-rate savings.
- The homepage provides a skip-to-main-content link.

Inference: McKinsey's information architecture is useful for a large research library. MECG needs a smaller work-first system.

### UNIT9

Verified observations:

- The [UNIT9 homepage](https://unit9.com/) exposes work by medium, including film, digital, games, virtual and augmented reality, experiential, and real-time effects.
- The [Met Replica case study](https://www.unit9.com/project/verizon-met-replica) explains the background, execution, result, technology, disciplines, release date, credits, and awards. It includes an explicit play control.
- The 3D work represents the Metropolitan Museum of Art and its collection. The technology follows the subject.

Inference: UNIT9 proves why a spatial experience exists before discussing its production. The page describes results in broad language, so it earns fewer proof points than Arup or BCG.

### 180 Degrees Consulting

Verified observations:

- The [180 Degrees Consulting homepage](https://www.180dc.org/) states that it is the world's largest university-based consultancy for nonprofits and socially conscious organizations.
- It reports 40 countries, 210 branches, 7,800 completed projects, and more than 60,000 trained leaders.
- The page publishes client testimony from UNICEF, Make-A-Wish International, SolarBuddy, mySircles, and Venture for America. It gives students, clients, partners, and prospective branch founders separate actions.

Inference: 180 Degrees Consulting leads MECG on proof and audience routing. MECG leads on visual specificity. The 180 Degrees page repeats some testimony and calls to action, which weakens its editorial control.

### TAMID Group

Verified observations:

- The [TAMID consulting page](https://tamidgroup.org/consulting/) states that student teams work for three to four months on management, technical, or financial consulting projects.
- It explains weekly client contact, project deliverables, and a final presentation. Israeli companies receive a direct registration action.
- The page relies on category icons and a general consulting image. It does not present a case study or result on this route.

Inference: TAMID explains its operating model, but the page lacks the proof and visual authorship of the other references. Its current motion and runtime performance were not inspected.

## The changes that move MECG from 77 to 92

### 1. Publish three complete case studies

Expected score change: **proof, 8 to 18**.

Each case needs a named or clearly anonymized client, semester, decision, scope, method, deliverables, approved result, team, and related service. One result can be operational, one strategic, and one growth-focused. If MECG cannot publish an outcome, show the artifact and state what decision it supported.

This change matters more than another animation pass.

### 2. Commission a small documentary photo library

Expected score change: **photography, 8 to 11**.

Add client working sessions, analysis in progress, a whiteboard or model, a presentation, and approved deliverables. Keep the existing portraits, but stop asking portraits to prove the work. Give every image a date, caption, credit, consent record, and planned crop.

### 3. Tighten responsive sizing and section rhythm

Completed in this pass: **visual authorship, 13 to 14**.

Use fewer extreme type jumps, shorten the empty space around the decision model, and keep section introductions within one consistent measure. On smaller screens, remove nonessential diagram labels before shrinking the core mechanism. The method figure should read as one object, not a large field with a small object in its center.

### 4. Turn motion into a consistent interaction system

Completed in this pass: **motion and 3D purpose, 8 to 9**.

Keep the decision transmission as the only major animated scene. Use 140 to 220 millisecond feedback for buttons, links, cards, and the mobile menu. Add hover and focus states that reveal useful context, such as a case result or service relationship. Preserve the static caption and reduced-motion path.

Do not add ambient particles, cursor effects, or 3D to every page.

### 5. Put the prototype on the real routes and verify the journey

Expected score change: **positioning, 18 to 19, and navigation, 11 to 12**.

Move the system from `/design-preview` to the public homepage, work, service, team, join, and contact routes. Keep client and student paths separate. Test the full keyboard path, 200 percent zoom, narrow mobile layout, reduced motion, and a representative low-power phone before launch.

## What this review did not verify

The review did not measure competitor frame rates, JavaScript weight, Core Web Vitals, keyboard paths, screen-reader output, reduced-motion behavior, analytics, or conversion rates. Public markup exposed a few accessibility signals, such as skip links, image labels, and explicit media controls. Those signals support only the narrow observations stated above.

MECG received stronger accessibility and motion evidence because its source code was available for inspection. The local preview was also verified anonymously on desktop and mobile after a fail-closed Clerk fallback was added for missing local keys. The review still does not claim a browser performance score or a complete accessibility audit.
