# Mobile responsive audit — 2026-10-16

Source-only review by an independent AI specialist; not a real user study.
Scope: `/home`, `/team`, `/work`, `/work/[slug]`, `/join`, `/contact`, shared header/footer and public forms.
Authority: `docs/DESIGN.md:33–35` (responsive containers; interactive targets ≥44px).
No browser rendering, physical-device touch, or user testing performed; no external account writes.
Findings describe source inspected during concurrent implementation; line numbers may move.

## Top 3 risks

### 1. Confirmed defect — public links miss the project's touch-target floor (P2)

- Evidence: `src/components/site-footer.tsx:24–33` gives navigation, email and social links `min-h-10` (40px at the default root size), without vertical padding.
- Evidence: `src/app/(marketing)/contact/page.tsx:37–38` repeats 40px social targets; the email anchor at line 32 has no height floor or vertical padding.
- Header desktop links/auth also use `min-h-10`: `src/components/site-header.tsx:86,91`; these remain relevant on touch tablets.
- Impact: smaller hit areas than the explicit 44px project requirement. This is a design-contract finding, not a claimed WCAG failure or measured mistap rate.
- Recommendation: use `min-h-11 inline-flex items-center` for these links; make the email target equally tall. Preserve existing visible text and spacing hierarchy.
- Verify: inspect actual target boxes on `/contact` and the footer at 320/390/768px; include the header in touch-tablet checks.

### 2. Hypothesis — desktop navigation starts before all header content fits (P1 if reproduced)

- Confirmed source: `src/components/site-header.tsx:76–80,91–99` combines `sm:px-10`, a logo, six navigation items and `gap-6`; desktop navigation appears and the menu button disappears at `md`.
- The header row and navigation have no wrapping or explicit collision fallback; signed-in CTA text becomes “My workspace” (`src/components/site-header.tsx:63–67`).
- Risk: near the default 768px breakpoint, the combined logo, labels, gaps and gutters may force undesirable wrapping, compression or overflow. No collision was rendered or measured.
- Recommendation if reproduced: retain mobile navigation through `lg`, or reduce spacing at intermediate widths after measuring both auth states.
- Verify: 767/768/820/1023/1024px, signed out and signed in, plus enlarged text; check horizontal scroll, label wrapping and logo/nav separation.

### 3. Hypothesis — expanded mobile menu lacks a short-viewport overflow strategy (P1 if reproduced)

- Confirmed source: `src/components/site-header.tsx:75,104–121` places the expanded menu inside the sticky header; five `py-4 text-lg` rows, an additional CTA, margins and menu padding increase its height.
- Neither the menu nor header sets a viewport-relative maximum height or internal vertical scrolling.
- Risk: below `md`, a short landscape viewport or enlarged text may put lower actions outside the visible area; reachability depends on actual sticky/document scrolling behavior and remains unverified.
- Recommendation if reproduced: cap the menu to remaining dynamic viewport height and allow `overflow-y-auto`, keeping the toggle reachable.
- Verify: open at 667×375 and 568×320, then enlarge text; reach every action by touch scrolling and keyboard, close it, and follow a link.

## Existing safeguards worth retaining

- Mobile menu toggle has 44px minimum dimensions and expanded-state wiring (`src/components/site-header.tsx:94–99`); mobile links close the menu (`:112,118–119`).
- Home CTA row wraps (`src/app/(marketing)/home/page.tsx:52`); public forms use single-column base grids (`src/app/(marketing)/contact/contact-form.tsx:41`; `src/app/(marketing)/join/interest-form.tsx:56`).
- Join photos use a native horizontal scroll region with nonshrinking slides and 44px arrow buttons (`src/components/photo-carousel.tsx:39–44`); intentional carousel scrolling is not evidence of page overflow.
- Shared buttons already enforce 44px minimum height (`src/app/globals.css`, `.button-primary` shared rule).
