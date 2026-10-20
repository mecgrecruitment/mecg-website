# Design-system review — 2026-10-16

Scope: independent AI specialist code audit, not a real user study. Read-only source review; only this report written.
Authority: `docs/DESIGN.md` (Precision Instrument). Source reflects a concurrent-edit workspace at review time.
No browser, runtime, contrast-tool, or assistive-technology verification performed; line references may shift.

## Confirmed defects

- **P1 — Public labels inherit workspace styling and dark labels lose contrast.**
  `src/components/section-label.tsx:13` always emits `.section-label`; `src/app/globals.css:646–650` sets 12px sans, near-zero tracking, navy/62, with no public uppercase/mono variant.
  `dark` changes only the number (`section-label.tsx:16`), leaving label text navy over navy in `src/components/page-intro.tsx:20–25` when a label is supplied.
  Violates `docs/DESIGN.md:10,16,35`; impacts the signature numbering and readability.
  Most marketing sections omit labels entirely: `src/app/(marketing)/home/page.tsx:34–131`, `work/page.tsx:38–99`, `team/page.tsx:22–25`, `contact/page.tsx:21–24`.
  Existing case-detail labels omit `number`: `src/app/(marketing)/work/[slug]/page.tsx:77,91,105,118`.

- **P2 — Home reverses the specified proof hierarchy and uses explicitly prohibited content.**
  `src/app/(marketing)/home/page.tsx:75–95` renders “Welcome to MECG” and the president's welcome immediately after stats.
  The remaining sections are history, pillars, and a community carousel (`:97–131`); clients, featured engagement, semester spec, alumni, and closing CTA are absent.
  `HOME_PHOTOS` is a people/culture inventory (`:18–26`) passed to `PhotoCarousel` (`:130`).
  Violates home ordering (`docs/DESIGN.md:14`), banned welcome/president content (`:56`), people carousels (`:59`), and join/team-only culture placement (`:70`).

- **P2 — Shared chrome loses the title-block structure and canonical alignment.**
  `src/components/site-footer.tsx:14–36` is three unframed columns plus copyright; it lacks location/revision cells and the title-block hairline grid required by `docs/DESIGN.md:41`.
  `src/components/site-header.tsx:75–76` adds a drop shadow and `max-w-[90rem]` with `xl:px-24`, against hairline-only structure and `max-w-6xl px-6` (`docs/DESIGN.md:20,33`).
  Desktop header links/auth use `min-h-10` (`site-header.tsx:86,91`); footer links use it too (`site-footer.tsx:26,31–33`): 40px rather than the documented 44px floor (`docs/DESIGN.md:35`).

- **P2 — Reusable marketing primitives drift beyond chrome.**
  `src/components/section-heading.tsx:10` uses `text-3xl sm:text-4xl`; `src/components/page-intro.tsx:27` uses `text-3xl sm:text-5xl`, both below the documented scales (`docs/DESIGN.md:33`).
  Structural shadows recur in `src/components/project-card.tsx:6`, `src/app/(marketing)/work/page.tsx:54`, and `work/[slug]/page.tsx:95`, contrary to `docs/DESIGN.md:20,44`.
  Additional button styles appear at `src/app/globals.css:129–132`, consumed by `home/page.tsx:54`, `work/page.tsx:98`, and `join/page.tsx:145`; the documented set is primary/secondary/dark (`docs/DESIGN.md:19,60`).
  Photo captions are absent in `home/page.tsx:92–94,105–113`, `src/components/photo-carousel.tsx:43–54`, and `team/page.tsx:30–35`; required figure grammar is `docs/DESIGN.md:18,42`.

## Top 3 exact changes

1. **Restore public section-label semantics in one shared component.** Add an explicit public/workspace variant to `SectionLabel`; public uses mono, uppercase, 11–12px, tracking 0.16em, navy/65 on light and white/70 on dark, retaining orange/ink numbers. Keep workspace sans styling. Supply sequential `number` values and labels to all marketing sections and page intros; require a public number at the type boundary.
2. **Recompose home around existing proof.** Preserve hero and server-rendered stats; follow with the existing self-hosted client inventory, an approved featured engagement (or honest pending-approval status), semester facts, then people/alumni only where verified content exists, ending with the two audience CTAs. Remove the welcome heading, president letter, and people carousel. Reuse `PAST_PROJECTS`, `SEMESTER_FACTS`, and public-project data already consumed by `src/app/(marketing)/work/page.tsx:8–10,33,47,66,75`; do not invent results, alumni claims, or artifacts.
3. **Restore the shared engineering drawing frame.** In `site-header.tsx`, replace shadow/90rem sizing with the documented 6xl shell and hairline border. In `site-footer.tsx`, arrange existing organization/contact/location content into bordered title-block cells; add revision metadata only from a real maintained source. Set header/footer links to `min-h-11`; use motion tokens for their feedback. Preserve navigation, auth behavior, logo, and mobile disclosure.

## Hypotheses / verify before claiming

- The desktop navigation may crowd around the `md` breakpoint: `site-header.tsx:76,80–92` puts four links, auth, logo, and a primary CTA on one row. Test 768–1024px and 200% zoom; source alone does not establish overflow.
- Navy focus overrides may give light inputs inside navy bands a low-contrast outline: `src/app/globals.css:99–101` and `src/app/(marketing)/join/interest-form.tsx:7`. Inspect the actual outline against its immediately adjacent background before changing it.
- Proof-first ordering should improve access to client evidence, but conversion/usability impact remains a hypothesis; no participant evidence was collected.

## Preserve

Keep navy/blue/orange/paper tokens, the orange-ink split, system sans/mono faces, real self-hosted imagery, 2px primary buttons, server-rendered figures, and hairline grids. These already support the established identity (`src/app/globals.css:12–43,104–127`; `home/page.tsx:62–72`).
Do not treat missing client approvals or project artifacts as defects to solve with fabricated content (`docs/DESIGN.md:66–70`).
