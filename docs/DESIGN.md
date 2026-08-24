# MECG Design Philosophy — Precision Instrument

The single sentence: **the site is an engineering document — numbered sections, mono-set data, hairline structure, one accent used surgically — because a mechanical engineering consulting group should demonstrate rigor, not assert it.**

Decision record (2026-08-22): three directions were evaluated — precision spec-sheet, work-first editorial, kinetic motion. Precision Instrument won because it finishes what the work page already started and it is the one aesthetic business clubs (Apex, 180DC) structurally cannot claim. Work-first editorial lost because the photo inventory has zero project artifacts today (see §7). Kinetic lost as a base for maintenance risk, but its zero-cost details were grafted in (gear ratios, motion tokens, unified splash exit).

## 1. Principles

1. **If it's data, it's mono; if it's prose, it's sans.** Montserrat for everything readable. Geist Mono (`font-mono`) only for machine-ish text: section numbers, stat values, labels, metadata, statuses, captions. Never mono body copy.
2. **One accent, two inks.** `mecg-orange #fe904d` for fills and for text on navy. `mecg-orange-ink #a83e0b` for orange text on white/paper (6.2:1, WCAG AA). Never raw orange text on a light background — it fails contrast at 2.25:1.
3. **Numbers over adjectives.** Every credibility claim is a figure or a named client. No "passionate", no "excellence", no "Welcome to".
4. **Proof before people.** Home order: hero, stats, clients, featured engagement, semester spec, people, alumni, CTA.
5. **Two audiences, one CTA each.** "Discuss a project" (clients) and "Join MECG" (students). Never more than these two actions per view.
6. **One label grammar.** `NN[.N] / LABEL` — Geist Mono, ~11px, uppercase, tracking 0.16em, number in orange (ink on light, orange on dark). Every section on every page is numbered, including home. `SectionLabel` is the only way to write one.
7. **Motion seats content, never decorates.** Named tokens only: `--t-detent 150ms` (hover/press), `--t-shift 420ms` (state/page transitions), `--t-seat 700ms` (viewport reveals), eases `--ease-seat` / `--ease-detent`. Reveals are opacity + small translate, staggered 60ms in DOM order. Nothing loops, nothing counts up from zero, real numbers render server-side.
8. **Real artifacts, never stock.** Photos get a hairline frame (`outline-mecg-navy/10` on light, `outline-white/12` on dark) and a mono figure caption: `FIG. NN — PLACE, CONTEXT`. Empty proof gets a status line (`STATUS / CASE STUDY PENDING CLIENT APPROVAL`), never an apology sentence.
9. **Square, not pill.** Buttons are 2px radius: `.button-primary` (filled orange, navy text), `.button-secondary` (outline on light), `.button-dark` (outline on dark). Cards square or `rounded-2xl` max; nothing at `rounded-[2rem]`.
10. **Hairlines are the structure.** `border-mecg-navy/10` on light, `border-white/12` on dark, `gap-px` grids on tinted backgrounds. No shadows for structure.

## 2. Tokens

| Token | Value | Role |
|---|---|---|
| `mecg-navy` | `#070d1f` | Primary text, dark surfaces |
| `mecg-blue` | `#3f63af` | Headings, logo, ≤12% tints |
| `mecg-orange` | `#fe904d` | Fills; text on dark only |
| `mecg-orange-ink` | `#a83e0b` | Orange text on light surfaces |
| `paper` | `#f4f1ec` | Mats behind logos/images |

Type scale: display `text-5xl sm:text-7xl` weight 600 tight tracking; section head `text-4xl sm:text-5xl`; body 16–18px `text-mecg-navy/60`+; mono label 11–12px uppercase tracking `0.16em`; all numerals `tabular-nums`. Containers `max-w-6xl px-6`; sections `py-16 sm:py-20`; bands `py-10`.

Accessibility floors (audited): text on white ≥ `text-mecg-navy/60`; text on navy ≥ `text-white/55`; interactive targets ≥ 44px; every field carries its own `focus-visible` ring.

## 3. Signature details

- **Title-block footer**: the footer reads like an engineering drawing title block (org / location / contact / rev cells in a hairline grid).
- **Figure captions** under real photos (`FIG. 01 — 2026 COHORT, ANN ARBOR MI`).
- **Status lines** instead of apologies for pending case studies.
- **Row hover**: index number shifts to orange ink over `--t-detent`; no card scale, no shadow.
- **True gear ratios** in the hero scene: meshing gears obey `ωB = -ωA × (teethA/teethB)` for teeth 11/9/7.

## 4. Content rules

- Case study formula: client + one real question + one result line + status. Three real ones beat ten described in prose.
- Client logos are self-hosted in `public/clients/` — never hotlinked.
- No internal jargon on public pages ("hash reviews", "locked evidence").
- Copy is verb-led and declarative.

## 5. Anti-patterns (never)

- "Welcome to…" copy; presidents' letter on the homepage
- Stat counters animating from 0; looping decorative animation
- Raw `text-mecg-orange` on white; any hardcoded hex outside `globals.css`
- More than one accent per view; stock photography; carousels of people
- A new section without a `SectionLabel` number; a new button style

## 6. Toolbox

Installed: three + @react-three/fiber (splash scene only). Motion is CSS + a small IntersectionObserver reveal — no animation library until a section genuinely needs scroll-pinned choreography (then GSAP/lenis, per the old doc's research). shadcn/ui remains the fallback base for complex form UI.

## 7. Open debt (owner: board, not code)

- **Artifact sprint**: the site has zero project artifacts (no CAD, deliverable spreads, on-site photos). ~10 frames per semester — redacted decision-brief covers, two slide spreads per approvable client, one working-session shoot — would unlock the work-first proof layer. Until then, the question is the artifact (typographic case rows).
- Client approval for publishing case-study results (Legendary Sports, Glo realistic; GM unlikely).
- `mecg-pictures/` is a culture archive, not a portfolio: ~6–8 of ~60 frames are publishable (join/team culture strip only).
