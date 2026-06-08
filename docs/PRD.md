# MECG Digital Platform — Product Requirements Document

| | |
|---|---|
| **Product** | MECG Website System (External Site + Internal Recruitment ATS) |
| **Version** | v1.0 — Reconciled |
| **Owner** | Rahil Bhavan, MECG |
| **Date** | June 8, 2026 |
| **Status** | Draft for board review |
| **Supersedes** | mecgmichigan.com (current Webflow-era site) |

> **About this version.** This is the consolidated, board-ready specification. It merges the owner's draft with seven enriched domain specifications (design system, external site, internal ATS, data model, RLS/security, accessibility/performance/reliability, and delivery) into one internally consistent contract. Every cross-domain contradiction surfaced in adversarial review has been resolved against a single authoritative reconciliation pass; the resolutions are logged in **Appendix C**. Requirement identifiers (`DS-`, `EX-`, `ATS-`, `DM-`, `SEC-`, `NFR-`, `MET-`, `PH-`, `CON-`, `RISK-`, `OQ-`) are preserved so this document traces cleanly to implementation work.

---

## Table of contents

1. Summary
2. Background & problem
3. Goals & non-goals
4. Success metrics
5. Users & personas
6. Scope decisions (locked)
7. Design system & art direction
8. External site requirements
9. Internal recruitment ATS requirements
10. Data model
11. Access control & security (RLS)
12. Tech stack
13. Non-functional requirements (accessibility, performance, reliability)
14. Content requirements
15. Phased delivery
16. Risks & mitigations
17. Open questions / decisions log
18. Goal traceability matrix
- Appendix A — Placeholder rubric defaults
- Appendix B — Asset / font references
- Appendix C — Reconciliation log

---

## 1. Summary

MECG will ship a single web application split into two hard-separated zones that share one brand, one codebase, and one deploy:

1. **External site** — a public, art-directed marketing and recruiting surface. Full design treatment, inspired by the editorial/brutalist execution of Obys Agency's *AI Modernism of Kharkiv* (aim.obys.agency): type-as-hero, near-monochrome, an indexed/annotated catalog system, and tasteful motion. Its job is to recruit applicants, impress clients, and showcase placements.

2. **Internal site** — a gated applicant tracking system (ATS) for the recruitment funnel, accessible only to the board and recruitment committee (plus a thin member-profile surface for general members). It replaces the scattered Google Docs used today for speed dating, group case, and interview scoring, and adds candidate profiles, notes, reactions, live hash voting, and bias-mitigation tooling. It inherits the brand's type system and palette but is optimized for density and speed, not art direction.

The guiding split: **the external site is a showcase; the internal site is a tool.** Motion and art direction go to the showcase; clarity and scanning speed go to the tool.

---

## 2. Background & problem

The current site (mecgmichigan.com) has a strong recruitment timeline page but several problems:

- The homepage impact counters render live as **"0 Members / 0 Projects Completed / 0 Different Majors"**, which reads as broken to applicants and clients.
- The President's welcome copy is generic and reads as templated; no named clients, no specific outcomes.
- The visual identity (dual rotating gears, literal "engineering = gears") is dated and undifferentiated.
- There is **no internal tooling**. Recruitment scoring for speed dating, group case, and final interviews lives in disconnected Google Docs. There is no candidate-level aggregation, no structured notes, no voting, no audit trail, and no access control beyond Google sharing settings.

This PRD addresses both: a redesigned public site and a purpose-built internal recruitment platform.

---

## 3. Goals & non-goals

### 3.1 Goals

> These six goals are authoritative and verbatim from the owner's draft. The traceability matrix in §18 maps each to the requirement IDs that satisfy it.

- **G1.** Replace the public site with a distinctive, type-forward, art-directed experience that signals precision and competence to clients and applicants.
- **G2.** Build a recruiting weapon: a placement/internship page that visibly shows where members work.
- **G3.** Replace Google Docs recruitment scoring with a structured ATS: candidate profiles, stage scoring, notes, reactions, voting, and hash deliberation.
- **G4.** Enforce strict role-based access control so candidate evaluation data is never exposed to candidates or unauthorized members.
- **G5.** Reduce bias and improve fairness in evaluation (blind-until-submitted scoring, score normalization, conflict-of-interest handling).
- **G6.** Keep the system maintainable by a rotating, volunteer student board.

### 3.2 Non-goals (v1)

- No public-facing client portal or project-management tooling for active engagements.
- No WebGL / shader-based image distortion effects (deliberately cut for maintainability).
- No native mobile apps; responsive web only.
- No payments, dues collection, or financial tooling.
- No automated parsing/scoring of applications via AI (human evaluation only in v1).
- No authenticated applicant portal in v1: applicants hold no login and cannot self-serve. Self-service withdrawal is deferred (see §17 OQ-12 and ATS-36); withdrawal in v1 is a board action initiated by an emailed request.

---

## 4. Success metrics

Each metric has an explicit baseline (today's state), a target tied to the Fall 2026 cycle, and a defined measurement method and owner. Metrics are grouped as **Adoption & Data Integrity** (the core reason the ATS exists), **Fairness**, **External Performance**, and **Content Currency**.

| ID | Metric | Baseline (today) | Target (Fall 2026 cycle) | How measured | Owner |
|---|---|---|---|---|---|
| **MET-1** | Recruitment data consolidation | 100% in scattered Google Docs; 0% structured | 100% of Speed Dating / Group Case / Interview scoring captured in the ATS; **zero** Google Docs scoring used in the live cycle | Count of scoring artifacts in `scores` vs. any Google Doc used; audited at each stage close | Recruitment chair |
| **MET-2** | Evaluator adoption | 0% (no app exists) | ≥90% of committee evaluators submit ≥1 score in-app per stage they are assigned to | Distinct evaluator IDs in `scores` per stage ÷ assigned evaluators (from `evaluator_assignments`, DM-M2) | Board |
| **MET-3** | Score completeness | Unknown / informal | ≥95% of candidates who advance have scores from the minimum required distinct evaluators per stage (default ≥3) | Per-candidate evaluator count vs. `MIN_EVALUATORS_PER_STAGE`, computed from `scores` | Recruitment chair |
| **MET-4** | Blind-until-submitted integrity | N/A (Google Docs fully open) | 0 confirmed cases of an evaluator viewing peers' scores/notes before submitting | API access-log review + RLS policy test suite passing in CI; manual spot-check during pilot | Staff engineer |
| **MET-5** | Hash deliberation efficiency | Untimed, anecdotal ("too long") | Median deliberation time per candidate reduced vs. prior cycle; controversy-first queue used for ≥80% of candidates | Timed observation during hash (`votes`/`decisions` timestamps); post-hash facilitator survey | Recruitment chair |
| **MET-6** | PII / evaluation-data leak incidents | N/A | **0** incidents where a candidate, general member, or unauthorized member accessed scores/notes/reactions/hash | RLS automated test pass rate (100%) + penetration spot-check before go-live + incident log | Staff engineer |
| **MET-7** | Application intake reliability | N/A (no native form) | ≥99% successful submissions (form write + resume upload) during the window; 0 lost applications | Ratio of completed `candidates` rows with resume in Storage vs. submission attempts | Staff engineer |
| **MET-8** | Public site performance | Broken `0` counters; no Lighthouse baseline | Lighthouse Performance ≥85 mobile / ≥95 desktop; LCP < 2.5s on Home and Placement | Lighthouse CI on each deploy against Home, Placement, Recruitment | Frontend lead |
| **MET-9** | Accessibility | Unknown on current site | WCAG 2.1 AA on all public pages; internal tool fully keyboard-navigable | axe-core automated scan in CI (0 critical) + manual keyboard pass on internal | Frontend lead |
| **MET-10** | Content currency | `0 Members / 0 Projects / 0 Majors`; generic copy | Homepage stats and Placement page show real, current data; **no placeholder zeros or lorem** at launch | Manual launch checklist sign-off against CON-* items | Owner (Rahil) |
| **MET-11** | Maintainability / handoff | Single maintainer, tribal knowledge | A new board member can run locally and deploy from README + seed script within 1 day, with no help | Timed onboarding dry-run with one non-author board member before cycle | Staff engineer |

> Measurement cadence: MET-1 through MET-5 are measured **per stage during the live cycle**; MET-6 through MET-9 are gated in CI and re-checked at go-live; MET-10/MET-11 are launch-checklist items.

---

## 5. Users & personas

| Persona | Zone | Needs |
|---|---|---|
| **Prospective applicant** | External | Understand what MECG is, see where members work, view recruitment timeline, apply |
| **Client / company** | External | Quickly assess credibility, services, and team quality |
| **Alumni** | External | See current placements, stay connected |
| **Applicant (candidate)** | Application intake only | Submit application; **no access to any evaluation data**; no authenticated session (SEC-8) |
| **General member** | Internal (thin) | Create/edit own member profile; view open-rush candidate roster (no scores) via `v_candidate_roster` (J1) |
| **Recruitment committee** | Internal | Score candidates per stage, leave notes, react, vote in hash — but not configure rubrics or roles |
| **Board** | Internal (full) | Everything above + configure rubrics/stages/cycles, manage roles, run hash sessions, view audit log, finalize decisions |

Roles are mutually exclusive per user per cycle; a user holds exactly one role (board implicitly inherits all committee capabilities). Role is stored in `members.role` and resolved at query time, never embedded in the JWT (SEC-7).

---

## 6. Scope decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| **Art-direction scope** | External: full. Internal: type system only. | The ATS needs density and scanning speed; full motion would slow the committee down. |
| **Motion & build ambition** | "Tasteful 80%" — Lenis smooth scroll, GSAP reveals, custom cursor, type preloader. **No WebGL.** | Captures the editorial wow while staying editable by future boards. |
| **Color** | Monochrome + single Michigan **maize** accent. | Black/cream does the work; maize keeps brand equity without going corporate blue+maize. |
| **Design intent** | Borrow AIM's *craft* (type, monochrome, annotation system, motion), not its Kharkiv/constructivist theme. | Execution qualities transfer; the art-historical content does not. |
| **Codebase** | One Next.js app, two route zones (`app/(external)` public, `app/(internal)/*` gated). | Shared brand/deploy, hard auth boundary. |
| **Hosting** | Vercel. | Already connected; native Next.js host. |
| **Backend** | Supabase (Postgres + Auth + RLS + Storage). | Already connected; RLS is the access-control backbone. |
| **General-member visibility** | Members CAN view the open-rush candidate roster (names/basic info only), NEVER scores, notes, reactions, or hash. | Transparency for members without compromising evaluation confidentiality (J1/J2). |
| **Hash vote visibility** | ANONYMOUS by default; board may flip a session to open per-session. | Protects candor by default; transparency is a deliberate, audited choice (ATS-45). |
| **Application intake** | NATIVE form → `candidates` + `application_responses`; resume to private Storage. Server-mediated; the only public write path. | One narrow, hardened entry point into the funnel (F2). |

## 7. Design system & art direction

> **Scope.** This is the single normative source for the MECG visual language; it governs both zones. The external site receives the full treatment (type-as-hero, motion, annotation chrome, preloader, custom cursor). The internal ATS inherits **fonts, palette, and the annotation grammar only** (DS-52–DS-58). Where a value is given (rem, ms, easing, opacity) it is a contract. The canonical home for the **maize/contrast rules** (G2 reconciliation), **font-loading contract** (H), and **reduced-motion mapping** (O6) is this section; other sections cross-reference by ID.

### 7.1 Design intent (locked)

- **DS-1.** The reference execution is Obys Agency, *AI Modernism of Kharkiv* (`aim.obys.agency`). MECG borrows its **craft** — typography as the primary visual element, near-monochrome surfaces, an indexed "technical catalog" annotation system, and restrained motion — and **not** its constructivist/Kharkiv art-historical content.
- **DS-2.** Two surfaces, one brand: **the external site is a showcase; the internal site is a tool.** This split is the tie-breaker for every design trade-off.
- **DS-3.** No WebGL, shader, or GPU image-distortion effects anywhere, in either zone. Motion is limited to DOM/CSS/GSAP transforms and Lenis scroll.
- **DS-4.** The palette is monochrome (ink + paper) with a **single** maize accent. Michigan blue (`#00274C`) is reserved and may appear only in the internal zone, only as a structural header tint (DS-49, DS-50).

### 7.2 Typography — typefaces, weights & loading (canonical: font-loading contract, H1–H3)

- **DS-5.** Typeface roles are fixed. **Loaded weights are the union actually used across both zones** (reconciliation H1):

| Role | Typeface (primary / fallback) | Weights loaded | Where used |
|---|---|---|---|
| Display / hero | **Archivo Expanded** (Black) / Bricolage Grotesque | 900 | Hero, section openers, kinetic type |
| Headings | **Archivo** (or Archivo Expanded at smaller optical sizes) | 600, 700 | H1–H4 |
| Body / UI | **Space Grotesk** / Inter | 400, 500, 700 | Paragraphs, UI labels, buttons (incl. bold UI/body) |
| Mono / annotation | **Space Mono** | 400, 700 | Indices, footnote markers, bracket chrome, meta line, timestamps, scores (incl. bold mono in `IndexMarker`/`BracketChrome`) |

- **DS-6. Loading method (H2).** Fonts load via Next.js `next/font` — `next/font/google` for the OFL faces (Space Grotesk, Space Mono, Bricolage Grotesque, Inter) and `next/font/local` for the self-hosted **Archivo Expanded Black** display face. Self-hosting the display face is explicitly permitted (it resolves the Archivo "Expanded" stretch axis that `next/font/google` cannot reliably express). `display: "swap"`; subset `latin`; the display face is preloaded. Manual `@font-face`/CDN `<link>` tags are otherwise prohibited (they bypass `next/font`'s self-hosting, preloading, and fallback generation).
- **DS-7.** Each role exposes a CSS custom property (`--font-display`, `--font-sans`, `--font-mono`) mapped to the Tailwind `fontFamily` theme. Components reference the token, never a typeface directly.
- **DS-8.** A size-adjusted system fallback per role keeps font-failure legible and minimizes CLS. `next/font`'s `adjustFontFallback` must remain enabled. Target font-swap shift ≤ 0.01 CLS.
- Display fonts are declared in `app/(external)/layout.tsx`, **not** `app/layout.tsx`, so the internal tool never loads them (NFR-18, NFR-20).

### 7.3 Type scale — external (editorial)

`rem` base = 16px. Display is fluid; everything else steps.

| Token | Size (rem) | Line-height | Tracking | Font role | Notes |
|---|---|---|---|---|---|
| `text-display` | fluid: min 3rem · pref 8vw+1rem · max 12rem | 0.90 | -0.04em | display | Hero only (DS-12) |
| `text-h1` | clamp(2.5, calc, 5.0) | 0.95 | -0.03em | display/headings | Page titles |
| `text-h2` | clamp(2.0, calc, 3.5) | 1.00 | -0.02em | headings | Section openers |
| `text-h3` | 2.0 | 1.05 | -0.015em | headings | Sub-sections |
| `text-h4` | 1.5 | 1.10 | -0.01em | headings | Card titles |
| `text-h5` | 1.25 | 1.15 | 0 | headings | Minor headings |
| `text-h6` | 1.0625 | 1.20 | 0.02em | sans 700 | Eyebrow / label, uppercase |
| `text-body-lg` | 1.25 | 1.50 | 0 | sans | Lead paragraphs (≤52ch) |
| `text-body` | 1.0625 | 1.60 | 0 | sans | Default paragraph (≤66ch) |
| `text-body-sm` | 0.9375 | 1.55 | 0 | sans | Secondary copy |
| `text-caption` | 0.8125 | 1.40 | 0.01em | sans | Captions, credits |
| `text-mono` | 0.75 | 1.30 | 0.04em | mono | Annotation, indices — uppercase |

- **DS-9 / DS-10.** Negative tracking scales with size on headings (tightest at display, easing to 0 by H6). Body and mono never use negative tracking.
- **DS-11.** Maximum measure: body **66ch**, lead (`body-lg`) **52ch**. Exceeding either is a defect.
- **DS-12 / DS-13.** `text-display` uses a single `clamp()` (min 3rem · pref 8vw+1rem · max 12rem) at line-height 0.90, tracking -0.04em. `text-h1`/`text-h2` clamp; all other steps are fixed `rem`.
- **DS-14.** The hero type-as-hero line stays one unbroken line ≥1280px and wraps to at most two lines below; three lines at any breakpoint is a defect.
- **DS-15.** Fluid type is validated at 320, 768, 1024, 1440, 1920px with no glyph clipping the viewport or safe gutter.

### 7.4 Type scale — internal (dense)

Base = 14px (0.875rem); minor-third (~1.2); fixed steps only.

| Token | Size (rem) | Line-height | Tracking | Font role | Notes |
|---|---|---|---|---|---|
| `i-h1` | 1.5 | 1.20 | -0.01em | headings | Page / candidate name |
| `i-h2` | 1.25 | 1.25 | 0 | headings | Panel titles |
| `i-h3` | 1.0625 | 1.30 | 0 | headings/sans 700 | Sub-panels |
| `i-body` | 0.875 | 1.45 | 0 | sans | Default UI text |
| `i-body-sm` | 0.8125 | 1.40 | 0 | sans | Dense rows, secondary |
| `i-caption` | 0.75 | 1.35 | 0.01em | sans | Meta, helper text |
| `i-mono` | 0.6875 | 1.30 | 0.04em | mono | IDs, timestamps, scores |
| `i-num` | inherits row | inherits | 0 | mono, **tabular-nums** | All numeric cells |

- **DS-16 / DS-17.** All ATS numerics (scores, z-scores, vote tallies, quorum counts, timestamps) render in Space Mono with `font-variant-numeric: tabular-nums`. Non-tabular numerics in a data table are a defect.
- **DS-18 / DS-19.** No negative tracking below `i-h1`; table rows at line-height 1.45 with 8/12px vertical padding on the 4px unit.

### 7.5 Spacing, grid, radii, borders

- **DS-20.** Base spacing unit = **4px**. Scale: `0,4,8,12,16,24,32,40,48,64,80,96,128,160,192` px. Off-scale values are a defect. External rhythm 8px; internal 4/8px.
- **DS-21.** External grid: 12 columns, `column-gap clamp(16px,2vw,32px)`, max-width 1440px; asymmetric editorial spans allowed; full-bleed sections encouraged.
- **DS-22.** Internal grid: 12 columns, fixed 16px gap, max-width 1600px; fixed left rail + fluid main + optional right meta rail; orthogonal, no asymmetric spans.
- **DS-23.** Gutters: external `clamp(20px,5vw,120px)`; internal fixed 24px (16px <768px). No content/annotation outside the gutter.
- **DS-24.** Breakpoints: `sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. External usable from 320px; internal targets 1024px+ but must not break or hide critical actions down to 768px.
- **DS-25.** Radii are square: `--radius-none: 0` default; `--radius-sm: 2px` only for form inputs. `border-radius ≥ 8px` is prohibited (lint-able).
- **DS-26.** Borders are hairlines: `--rule` (1px ink) and `--rule-soft` (1px ink @ 12–16%). Separation via rules and whitespace, not shadows.
- **DS-27.** No drop shadows on the external site. Internal may use one `--shadow-pop` token for popovers/menus/modals only.
- **DS-28.** Media is un-rounded, full-contrast, monochrome-leaning, framed by a 1px ink hairline; grayscale-by-default with color-on-interaction allowed for team/placement grids (paired with DS-39d).

### 7.6 Annotation / catalog component system

The annotation grammar is the brand's signature, implemented as four reusable components in `components/annotation/`. These are the **only** sanctioned way to render indices, footnotes, bracket chrome, and the meta line; inline `[01]`/`[*]`/`[Menu]` strings are a lint-able defect (DS-36, DS-51).

- **DS-29. `<IndexMarker>`** — zero-padded catalog index in mono. Props: `value`, `prefix` (e.g. `"E"`, `"C"`), `pad` (default 2), `bracket` (default true), `as`, `tone` (`default | accent`; `accent` paints maize per DS-47). Usage: pillars `[01]–[04]`, gallery `[01]…[n]`, funnel `E01–E05`, candidates `C01…`.
- **DS-30 / DS-31. `<FootnoteMarker>`** — `[*] [**] [***]` superscript mono marker; props `level`, `id` (req.), `label`. Every marker MUST have exactly one matching `<Footnote id>` block; the marker is a real `<a href="#id">` with `aria-describedby`. Orphan or duplicate-id markers are a build-time defect.
- **DS-32 / DS-33. `<BracketChrome>`** — `[Menu] [Close] [Index] [Gallery]`. Props `label`, `onActivate` (renders `<button>` when present), `state` (`idle | active`), `aria`. Always keyboard-focusable when interactive, with a visible focus ring (DS-43) and `aria-expanded` for menu controls. Brackets are literal mono glyphs, not images.
- **DS-34 / DS-35. `<MetaLine>`** — `Michigan Engineering Consulting Group / Ann Arbor / ©2026`. Props `segments`, `separator`, `sticky`, `year` (derived, never hardcoded). Appears on every external page (footer + optional sticky edge) and every internal page header (`i-mono`, non-sticky).
- **DS-37.** `©`, timestamps, and ID strings always render in the mono role.

### 7.7 Motion inventory ("the 80%") — canonical reduced-motion mapping (O6)

External-only unless stated. **Reduced-motion is a first-class state and is specified once here** (other sections reference DS-38/DS-39).

- **DS-38.** When `(prefers-reduced-motion: reduce)` is set: all scroll/reveal animations resolve instantly to their final visible state; Lenis is not initialized (native scroll); the **preloader is skipped entirely** (content renders immediately — reconciliation H3); the custom cursor is disabled. No effect ever leaves content hidden or mid-transition under reduced motion.

| # | Effect | Library | Timing / easing | Reduced-motion fallback |
|---|---|---|---|---|
| **DS-39a** | Smooth scroll | Lenis | `lerp 0.1` (≈`dur 1.2`), wheel ×1.0, `smoothTouch:false` | Lenis **not initialized**; native scroll |
| **DS-39b** | Heading reveals | GSAP + ScrollTrigger | mask/clip, `0.8s`, `power3.out`, `stagger 0.06s`, `start "top 85%"`, `once:true` | Headings fully visible at final position |
| **DS-39c** | Image reveals | GSAP / CSS clip-path | clip wipe `1.0s power4.out`; hover scale `1.0→1.03` `220ms` | Images full opacity, no clip; no hover scale |
| **DS-39d** | Grayscale→color media | CSS | `grayscale(1)→0` over `300ms` on hover/in-view | Chosen static state shown immediately |
| **DS-39e** | Custom cursor | Custom (RAF) | follower `lerp 0.15`; target scale `200ms` | Disabled; native cursor |
| **DS-39f** | Preloader | Custom + GSAP | type intro ≤`1500ms`, exit wipe `600ms` | **Skipped entirely** (H3) |
| **DS-39g** | Page transitions | GSAP / View Transitions | cross-fade/wipe ≤`500ms` | Instant route change |
| **DS-39h** | Micro-interactions | CSS | `120–180ms ease-out` | Static hover state, no timing |
| **DS-39x** | WebGL / shader | — | — | **Excluded entirely** (DS-3) |

- **DS-40.** Lenis (external only): one app-shell init, `lerp 0.1`, `smoothWheel:true`, `smoothTouch:false`, wired to GSAP ScrollTrigger via a single RAF loop, torn down on route unmount. Never loaded in `/internal/*` (DS-54).
- **DS-41.** GSAP defaults `{ ease: "power3.out", duration: 0.8 }`; reveals `once:true`; a `matchMedia`/reduced-motion guard prevents timeline instantiation under reduce (NFR-12). No infinite ambient animations.
- **DS-42.** Custom cursor mounts only when `(pointer: fine)` AND `(hover: hover)` match AND reduced-motion is off; re-evaluated on `matchMedia` change (hybrid devices). Otherwise native cursor.
- **DS-43. Focus visibility outranks cursor styling.** A visible focus ring is always present for keyboard users in both zones; `:focus-visible` is never suppressed. The default ring color is defined canonically in DS-47a (G1 reconciliation).
- **DS-44.** When Lenis is disabled (reduced-motion, internal, or flag-off), all scroll-dependent logic degrades to native scroll without breakage or hidden content.
- **DS-45.** Preloader runs once per browser session (`sessionStorage` flag), is skipped under reduced motion (DS-38) and in the internal zone (DS-55), must not block FCP beyond its ≤1500ms budget, and has a hard timeout that reveals content if assets stall.

### 7.8 Inversion strategy & maize discipline — canonical maize/contrast rules (G2)

- **DS-46. Inversion, not dark mode.** A single light catalog (paper ground, ink text) punctuated by deliberate **inverted blocks** (ink ground, paper text). No user-toggled dark theme in v1. Inversion is per-section via a surface token set (DS-59).
- **DS-47. Maize discipline — accent only.** Maize (`#FFCB05`) is permitted ONLY on: (1) text/link hover and active states; (2) annotation markers in `tone="accent"`; (3) focus rings **only where contrast allows** (DS-47a); (4) small key accents (a single underline, a 2–4px rule, an active dot/tick).
- **DS-47a. Focus-ring color (reconciliation G1 — supersedes any "maize ring default").** The default focus ring is **`2px solid var(--ink)` with 2px offset** on paper/light backgrounds (ink vs paper = 17.1:1, far exceeding the ≥3:1 UI threshold). On inverted (ink) sections the ring is `2px solid var(--paper)`. A **maize** focus ring is permitted **only** on dark (ink or blue) background sections, where maize-on-ink = 13.0:1 and maize-on-blue = 9.9:1 both pass. Maize focus rings on paper (1.31:1) are prohibited.
- **DS-48. Maize area cap (lint-able).** No element may use `background: var(--maize)` over more than ~5% of the viewport; maize backgrounds are prohibited on containers, sections, cards, and full-width bars. Permitted maize fills: inline/small chips, the cursor dot, focus indicators (per DS-47a), and ≤4px rules.
- **DS-49. Maize contrast rule (reconciliation G2).** Maize is **never** body or small-UI text on paper (maize-on-paper = 1.31:1, fails). Maize on paper is permitted only for large display accents, annotation markers rendered at WCAG large-text size (≥24px or ≥18.66px bold), decorative rules, and hover/active fills that also carry a non-color affordance. The canonical contrast matrix is NFR-2; the practical rule: **maize pairs only with ink or blue, never with paper.**
- **DS-50. Blue is reserved & zone-scoped.** `#00274C` appears ONLY in the internal zone, ONLY as a structural header/section tint, never as an accent competing with maize, and never on the external site. Blue is never used as text/iconography on ink (1.32:1, fails); on paper/maize it is compliant.
- **DS-51. Lint enforcement.** CI-checkable defects: (a) hardcoded hex in components; (b) maize as a large background (DS-48); (c) blue in the external route group; (d) inline annotation glyphs bypassing the components (DS-36); (e) `border-radius ≥ 8px` (DS-25); (f) maize focus ring on a paper surface (DS-47a).

### 7.9 Internal styling rules (inherits only — strict)

- **DS-52.** The internal ATS inherits **exactly three things**: typeface roles (DS-5), color tokens (DS-60), and the annotation grammar (DS-29–DS-37). Nothing else by default.
- **DS-53.** Internal uses the dense scale (DS-16), the internal grid (DS-22), and tabular numerics (DS-17). Not the editorial scale or asymmetric grid.
- **DS-54 / DS-55 / DS-56.** No Lenis/smooth scroll, no preloader, no custom cursor in `/internal/*`.
- **DS-57.** No reveal/scroll/parallax animations internally. Only functional micro-feedback ≤150ms via CSS (hover/active/focus, menu/popover open/close, optimistic-update flashes).
- **DS-58.** The internal zone is dense, table/card-based, keyboard-first, with visible focus on every interactive element. Bias-sensitive UI states (blind-until-submitted masking) are functional requirements (§9) styled as unambiguous, accessible states.

### 7.10 Design tokens (values only)

- **DS-59.** Tokens are CSS custom properties on `:root` (paper/light) re-declared under `.inverted` / `[data-surface="inverted"]` for inverted blocks. Surface-pair tokens flip; brand tokens (`--ink`, `--paper`, `--maize`, `--blue`) do not.
- **DS-60.** Token table:

| CSS custom property | Value | Tailwind mapping | Notes |
|---|---|---|---|
| `--ink` | `#0A0A0A` | `colors.ink` | Primary text / inverted ground |
| `--paper` | `#F2EEE4` | `colors.paper` | Primary ground (cream) |
| `--maize` | `#FFCB05` | `colors.maize` | Accent only (DS-47, DS-48, DS-49) |
| `--blue` | `#00274C` | `colors.blue` | Reserved; internal only (DS-50) |
| `--surface` | paper → ink when inverted | `colors.surface` | Section ground |
| `--on-surface` | ink → paper when inverted | `colors.on-surface` | Section text |
| `--rule` | `var(--ink)` | `colors.rule` | 1px structural hairline |
| `--rule-soft` | ink @ 14% alpha | `colors.rule-soft` | 1px in-card divider |
| `--font-display` | Archivo Expanded (next/font/local), fallback | `fontFamily.display` | DS-5/DS-6 |
| `--font-sans` | Space Grotesk / Inter (next/font/google) | `fontFamily.sans` | DS-5/DS-6 |
| `--font-mono` | Space Mono (next/font/google) | `fontFamily.mono` | DS-5/DS-6 |
| `--radius-none` | `0` | `borderRadius.DEFAULT` | DS-25 |
| `--radius-sm` | `2px` | `borderRadius.sm` | Inputs only |
| `--space-unit` | `4px` | `spacing` base | DS-20 |
| `--gutter` | `clamp(20px,5vw,120px)` | `spacing.gutter` | External (DS-23) |
| `--gutter-internal` | `24px` (16px <md) | `spacing.gutter-int` | Internal |
| `--container-ext` | `1440px` | `maxWidth.ext` | DS-21 |
| `--container-int` | `1600px` | `maxWidth.int` | DS-22 |
| `--measure` | `66ch` | `maxWidth.measure` | DS-11 |
| `--focus-ring` | `2px solid var(--ink)`, offset `2px` (default); `var(--paper)` on inverted; maize only on dark per DS-47a | utility `focus-visible` | DS-43, DS-47a |
| `--shadow-pop` | tight low-opacity | `boxShadow.pop` | internal only (DS-27) |
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` | `transitionTimingFunction.out` | DS-41 |
| `--ease-inout` | `cubic-bezier(0.65,0,0.35,1)` | `transitionTimingFunction.inout` | Transitions/preloader |
| `--dur-micro` | `150ms` | `transitionDuration.micro` | DS-39h |
| `--dur-reveal` | `800ms` | `transitionDuration.reveal` | DS-39b |

- **DS-61.** Tailwind `theme.extend` consumes these custom properties so a single source of truth drives raw CSS and utility classes; no color/spacing/radius/font/timing value is hardcoded in a component when a token exists.

## 8. External site requirements

This section is the definitive specification for the public, art-directed surface. Every requirement is `EX-n` and independently testable. All pages inherit §7 (Archivo Expanded / Space Grotesk / Space Mono; ink/paper/maize; blue reserved; the bracketed annotation system; the "tasteful 80%" motion stack; **no WebGL**).

**Rendering doctrine.** The external site is read-only to the public. Every route is Static or ISR. The *only* anonymous write path in the entire system is the `/apply` submission (EX-59, reconciled to a server-mediated Route Handler — see §8.9 and F2). No public route reads any evaluation table (`scores`, `notes`, `reactions`, `votes`, `decisions`, `hash_sessions`, `audit_log`) under any circumstance; public reads are limited to the curated published views per page (`v_placement_public`, `v_team_public`, `v_impact_stats`).

### 8.0 Global shell (every external route)

**Navigation**
- **EX-1.** A persistent fixed header on all external routes. Closed state: MECG wordmark (left) + a single bracketed `[Menu]` trigger (right) in Space Mono. No horizontal link bar when closed.
- **EX-2.** `[Menu]` opens a full-viewport overlay; the trigger swaps to `[Close]`. The overlay lists primary routes as oversized display type with mono indices: `[01] Home`, `[02] Placement`, `[03] Trek`, `[04] Team`, `[05] Recruitment`, `[06] Services`, `[07] About`, `[08] Contact`, plus a maize-accented `[ Apply → ]` CTA to `/apply`.
- **EX-3.** Fully keyboard operable: `[Menu]`/`[Close]` is a real `<button>` with `aria-expanded`; opening moves focus to the first item; focus is trapped; `Esc` closes and restores focus. Overlay uses `role="dialog"` + `aria-modal="true"` + accessible name.
- **EX-4.** Current route carries `aria-current="page"` + a visible maize marker.
- **EX-5.** The header stays legible against paper and ink sections on scroll; CLS contribution = 0.
- **EX-6.** There is **no** link to `/internal/*` anywhere in public nav, footer, sitemap, or menu. The internal zone is reachable only by direct URL and gated by auth (§11). Crawlers must never discover internal routes from the external site.

**Footer**
- **EX-7.** Global footer on every route: (a) the meta line `Michigan Engineering Consulting Group / Ann Arbor / ©2026` in Space Mono (year derived, never stale); (b) a compact route index; (c) a social row.
- **EX-8.** Social row = exactly **Instagram** and **LinkedIn** in v1; each an `<a rel="noopener noreferrer" target="_blank">` with an accessible label. URLs from the single config source (EX-12).
- **EX-9.** Footer CTA to `/apply` and `/recruitment`. Email is not exposed as harvestable plain text (Contact uses obfuscation/`mailto:`, EX-46).

**Shared configuration & motion**
- **EX-10.** All external pages register `app/(external)/layout.tsx`, which mounts the preloader (once/session), Lenis, the custom cursor, header, and footer. Internal routes do not use this layout.
- **EX-11.** The type preloader runs at most once per browser session (`sessionStorage`); never blocks LCP beyond its budget; skipped under reduced motion (DS-38/EX-14) and for returning-in-session visitors.
- **EX-12.** Site-wide constants — social URLs, contact email, calendar links, legal name, impact-stats source — live in one typed config module (`lib/site-config.ts`). No page hardcodes these inline.

**404 / error**
- **EX-13.** A custom `not-found.tsx` (styled `[404] / Not in index`) keeps the global shell and links back to `/`, `/recruitment`, `/apply`. A custom `error.tsx` offers recovery. Neither leaks stack traces, internal route names, or env data.

**Reduced motion & responsiveness (shell-level)**
- **EX-14.** Reduced motion (canonical map in DS-38/DS-39): preloader skipped, Lenis disabled, custom cursor → native, all GSAP reveals resolve immediately to final state. Enforced globally.
- **EX-15.** Custom cursor only on fine-pointer/hover devices (DS-42); no cursor-dependent interaction is the only way to reach content.
- **EX-16.** Fully usable from **320px**, validated at 320/360/768/1024/1280/1440+. No horizontal overflow; no clipped text; tap targets ≥44×44px.
- **EX-17.** All display/kinetic type uses fluid `clamp()` (DS-12).
- **EX-18.** Fonts load `font-display: swap` with a defined fallback stack (DS-6); no invisible-text flash blocking LCP.

### 8.1 Home (`/`)

Flagship landing surface converting two audiences: applicants (→ `/recruitment`, `/apply`) and clients (→ `/placement`, `/services`). Sections: (1) kinetic-type hero + CTAs `[ Apply → ]` / `[ Our Work → ]`; (2) pillars index `[01]–[04]`; (3) **impact stats band**; (4) placement teaser slider; (5) closing CTA + footer. Components: `KineticHero`, `PillarsIndex`, `ImpactStats` (server), `StatCounter` (client, animation only), `PlacementTeaser`/`LogoMarquee`, `CTASection`, shared shell. Source: Static/ISR; pillars static (single source shared with `/about`, EX-44); teaser reads the same published placement view as `/placement`. SEO: title `MECG — Michigan Engineering Consulting Group`; `summary_large_image`; dedicated 1200×630 OG.

**Impact stats — zero-proof hardening (canonical home for the zero-proofing contract, O6; highest priority):**
- **EX-19.** Impact stats derive from **exactly one** source of truth: a typed, version-controlled config (`lib/impact-stats.ts`) OR a single published view `v_impact_stats`. Default recommendation: config-first for v1 to remove DB-at-build-time fragility.
- **EX-20.** Each stat has a stable key, integer value, display label, optional suffix; validated at source (`value: integer ≥ 1`).
- **EX-21. Build-time guard (hard fail).** `scripts/check-impact-stats.ts` (wired into `prebuild`/CI) fails the build if any required stat is missing, `null`, `undefined`, non-numeric, or `≤ 0`. Required keys allowlist: at minimum `members`, `projectsCompleted`, `majors`.
- **EX-22.** The rendered value is the server-rendered final number. The count-up is purely visual: with JS off/failed or reduced motion, the **final correct number is already in the DOM** (never a `0` placeholder). Animation may start from 0 only when JS is active and reduced motion is off.
- **EX-23.** If the DB-view source fails or returns empty at build/revalidate, the build fails rather than rendering zeros.

### 8.2 Placement / "Where We Work" (`/placement`) — highest-value recruiting page

The strongest credibility artifact: visibly show where members intern/work. Sections: hero/intro; **company logo wall** (monochrome/normalized); internship highlights (quote + role + company, indexed `[01]…[n]`); optional stat strip (EX-19 rules); CTA to `/recruitment` + `/apply`. Components: `PlacementHero`, `LogoWall`, `CompanyLogo`, `InternshipHighlightCard`, `PlacementStats`, `EmptyState`, `CTASection`.

**Data source — derivation + curation (core requirement; backed by `placement_features`, DM-M4):**
- **EX-24.** Placement data is derived from member profiles via a public read-only view `v_placement_public` exposing ONLY: company name, normalized slug, logo reference, and (for highlights) member display name, role/title, year, quote. No candidate/evaluation data; no non-public member fields.
- **EX-25. Manual curation override layer** = the `placement_features` table (DM-M4), board-controlled. It can: include/exclude companies; pin/order featured logos and highlights; supply a canonical logo asset and normalized display name ("Google LLC" → "Google"); suppress a company/quote. **A featured entry may reference a member OR be a fully manual entry.** Curation always wins over raw derivation.
- **EX-26.** Member quotes/photos appear in highlights only when the member has set **`placement_consent = true`** (DM-M5) — a flag **separate from `is_public`** (which governs `/team`). A member can appear in placement-but-not-team, team-but-not-placement, both, or neither.
- **EX-27.** Companies are de-duplicated and normalized by slug.
- **EX-28.** ISR (revalidate hourly/daily) reading the published view; never a client-side authenticated fetch.

**Logo handling:** **EX-29** `next/image` from a curated asset (`public/logos/` or Storage) via the curation layer, monochrome/grayscale treatment. **EX-30** meaningful `alt` (company name); consistent bounding box (`object-fit: contain`). **EX-31** missing curated asset → a **typographic logo tile** (never a broken image). **EX-32** the homepage teaser consumes the same view/curation source.

**Empty states:** **EX-33** zero companies → branded empty state ("Placement data publishing soon" + CTA), never a blank grid or zeros. **EX-34** companies present but no highlights → logo wall renders, highlights section omitted gracefully.

SEO: title `Placement — Where MECG Members Work`; `summary_large_image`.

### 8.3 Chicago Trek (`/trek`)

Indexed editorial photo gallery. Sections: intro/narrative `[ Trek / Chicago ]`; indexed gallery `[01]…[n]`; optional pull-quotes; CTA to `/recruitment`. Components: `TrekHero`, `GalleryGrid`, `GalleryItem`, `Lightbox`, `CTASection`. Source: Static/ISR; curated assets via a typed manifest (`src`, `alt`, `index`, optional `caption`). Lightbox is keyboard navigable (arrows, `Esc`, focus trap, `role="dialog"`), respects reduced motion. Failed image → styled placeholder, never a broken-image icon. 320px → single column.

### 8.4 Team (`/team`)

Monochrome indexed portrait grid. Sections: `[ Team ]` intro; indexed grid `[01]…[n]` (photo, name, role, year, major); optional filter; CTA. Components: `TeamHero`, `MemberGrid`, `MemberCard`, `EmptyState`, `CTASection`. Source: ISR reading public view `v_team_public` of `members WHERE is_public = true`, exposing ONLY display name, role, year, major, photo, bio.
- **EX-35.** Only `is_public = true` members appear; enforced at the view/RLS level, not just UI.
- **EX-36.** Photos via `next/image` (`alt = name`); missing photo → initials/monogram tile.
- **EX-37.** Empty public set → branded empty state.

### 8.5 Recruitment / Join (`/recruitment`)

Converts applicants; preserves the timeline restyled into the annotation system. Sections: hero `[ Recruitment / Join ]` + cycle framing; **funnel timeline** `E01 → E0n` (Application → Speed Dating → Group Case → Interview → Decision); event calendar links; primary `[ Apply → ]` (top + bottom); FAQ accordion. Components: `RecruitmentHero`, `FunnelTimeline`, `FunnelStage`, `CalendarLinks`, `CTASection`, `FAQAccordion`. Source: Static/ISR; timeline/dates/FAQ via typed content/MDX; calendar links from config.
- **EX-38.** Funnel indices use `E01…E0n`; public events are visually distinguished from internal-only stages (Hash is never advertised as an applicant step).
- **EX-39.** Accessible FAQ accordion (`<button>` + `aria-expanded` controlling an associated region; keyboard operable).
- **EX-40.** Cycle dates/year from config, not hardcoded.

### 8.6 Services (`/services`)

Converts clients. Sections: hero `[ Services ]`; offerings index `[01]…[n]`; sanitized outcomes; client logos (gated); CTA → `/contact`. Components reuse `LogoWall`/`CompanyLogo`.
- **EX-41.** Outcomes sanitized; no confidential client data; uncertain stats excluded rather than published.
- **EX-42.** Client logos render only for clients with explicit `display_permitted = true` in the curation/config source; absent permission → omitted (no placeholder). (Open: OQ-2.)
- **EX-43.** Missing permitted logo → typographic tile (reuse EX-31).

### 8.7 About (`/about`)

Mission, four pillars in depth, history. Sections: hero `[ About ]`; pillars `[01]–[04]` expanded; history/narrative with `[*]` footnotes; optional values; CTA. Components: `AboutHero`, `PillarsDetail`, `HistoryTimeline`, `AnnotationBlock`, `CTASection`.
- **EX-44. Pillars single source (canonical, O6).** Pillar definitions come from the **same content module** as the homepage pillars index, so `[01]–[04]` never diverge between `/` and `/about`.
- **EX-45.** President's-welcome copy must be specific (named outcomes/clients where permitted), not templated. Placeholder/lorem must not ship (content-completeness check at launch).

### 8.8 Contact (`/contact`)

Sections: hero `[ Contact ]`; primary contact (email via `mailto:`/obfuscated, Ann Arbor location, Instagram + LinkedIn); optional inquiry form; footer meta line.
- **EX-46.** Email/socials from the single config source; email obfuscated against naive scrapers.
- **EX-47.** A general contact/inquiry form is **optional** for v1. If included it MUST be a separate low-trust channel (email service or a `contact_messages` table), MUST NOT write to `candidates` or any evaluation table, and MUST include spam mitigation + validation. The application path is `/apply` only.
- **EX-48.** Copy directs applicants to `/apply` and clients/press to the contact channel.

### 8.9 Apply (`/apply`) — native intake (the only public write path)

Lets applicants submit natively, writing to `candidates` + `application_responses` and uploading a resume to private Storage. **This is the single sanctioned anonymous mutation, implemented server-side (F2): the browser POSTs multipart form data to one narrow Next.js Route Handler that uses the `service_role` key to insert the rows and upload the resume. There is NO anon RLS INSERT policy and NO anon Storage policy.** Sections: intro `[ Apply ]`; the form; resume upload; consent/notice; submit + status region; success/error states. Components: `ApplyHero`, `ApplicationForm`, `FormField`, `ResumeUpload`, `ConsentCheckbox`, `SubmitButton`, `FormStatus` (`role="status"`/`aria-live`), `SuccessPanel`, `ErrorPanel`.

**Fields (v1 minimum; final list pending CON-5/content owner):**
- **EX-49.** Required: full name; UMich email (`@umich.edu` validated); graduation year/class; major(s); resume file. Recommended: phone, LinkedIn URL, short essay prompt(s) (per `application_responses`, sourced from `application_questions` DM-M6), how-did-you-hear.
- **EX-50.** Explicit constraints: email regex + `@umich.edu`; year as constrained select; majors text/multiselect; essay min/max; URL validation.

**Validation & UX:**
- **EX-51.** Validation runs client-side (inline, on blur/submit) and server-side (authoritative, shared Zod schema). The server never trusts client validation.
- **EX-52.** Each field shows an inline error tied via `aria-describedby`; invalid fields get `aria-invalid="true"`; on submit-with-errors, focus moves to the first invalid field and a summary is announced.
- **EX-53.** Submit shows pending/disabled state; cannot double-submit. Duplicate `@umich.edu` within the same cycle is handled deterministically per the per-cycle uniqueness rule (C1): the server catches the conflict and returns the same generic confirmation (SEC-25), preventing enumeration. Re-application in a **different** cycle creates a new candidate row (C2/ATS-55).
- **EX-54.** Required fields/formats are enforced before any write; a partial/invalid payload never creates a `candidates` row or an orphan Storage object.

**Resume upload (canonical resume constraints, O6 — reconciliation F1/F3):**
- **EX-55.** Accepted type = **`application/pdf` only**, max **10 MB**. DOC/DOCX is explicitly out. MIME + extension validated server-side in the Route Handler; disallowed types rejected with a clear message.
- **EX-56.** Upload targets the **private** `resumes` bucket. No public read/list; resumes are readable only by committee/board via short-lived signed URLs minted server-side (SEC-28).
- **EX-57.** The object path is `resumes/{candidate_id}/{uuid}.pdf`; the reference is persisted to `candidates.resume_storage_path` (canonical column name, F3). A failed DB insert leaves no dangling resume; a failed upload leaves no candidate with a phantom pointer (transaction/compensating cleanup, NFR-24).
- **EX-58.** Size/type limits + rate limiting are enforced; full AV scanning is out of v1 scope unless decided otherwise (OQ-13).

**The narrow public write path (security-critical):**
- **EX-59.** `/apply` is the only anonymous write, implemented as a single **server-mediated Route Handler** holding the `service_role` key (F2). It can only insert `candidates` + `application_responses` and upload to `resumes`; it never reads/updates/deletes any row and has no access to any evaluation table. The browser never receives a Storage credential or pre-signed URL.
- **EX-60.** Because writes are server-mediated, **anon holds no direct DB or Storage grant.** RLS default-deny applies to anon everywhere; policy tests confirm anon cannot insert/select/update/delete any table or enumerate Storage (SEC-21, SEC-26, SEC-38).
- **EX-61. Anti-abuse (canonical /apply abuse contract, O6 — reconciliation L).** Mandatory **Cloudflare Turnstile**, verified server-side in the Route Handler (accessible audio/visual widget). Mandatory **rate limit of 5 submissions / IP / 24h**, enforced via a Postgres-backed counter (`apply_rate_limit`, DM-M8) checked/incremented in the same server transaction (no Upstash dependency); Vercel firewall rules may supplement. Plus a honeypot field and full server-side validation. Bot/over-limit submissions are rejected before any write (HTTP 429 on rate-limit).
- **EX-62.** All submitted text is untrusted: stored as data (never rendered as HTML), escaped on any later internal display; file names sanitized before use in Storage paths.

**No evaluation data exposure (locked invariant):**
- **EX-63.** The `/apply` request, response, client bundle, and any error message expose **zero** evaluation data — never `scores`, `notes`, `reactions`, `votes`, `decisions`, `hash_sessions`, controversy, normalized composites, candidate status, or any other applicant's data.
- **EX-64.** The success response returns only a confirmation (and optionally a non-sensitive reference id); no internal candidate state, stage, or IDs that map to evaluation context.

**Success / error states:**
- **EX-65.** On success: a confirmation panel announced via `aria-live`, with next steps (timeline link, no eval data), preventing re-submit. **Success copy = "Application submitted."** An email-confirmation line is shown **only if** the transactional-email feature is enabled (OQ-11); v1 does not assert an email exists in copy unless approved (O1).
- **EX-66.** On error: the form preserves entered values, shows an actionable message via `aria-live="assertive"`, distinguishes validation errors from server/network errors. No raw server/stack details.

### 8.10 Cross-cutting non-functional (external)

- **EX-67.** Every external route is Static or ISR; no external page performs a client-side authenticated Supabase read. Public data flows only through `v_placement_public`, `v_team_public`, and `v_impact_stats` (if used), which expose no evaluation or non-public fields.
- **EX-68.** Performance per §13: Lighthouse ≥85 mobile / ≥95 desktop; LCP < 2.5s. `next/image` with explicit dimensions; fonts subset + swap; motion libs code-split off the critical path.
- **EX-69.** Accessibility: WCAG 2.1 AA on all external pages — semantic landmarks, logical heading order, visible focus (DS-47a), AA contrast against ink and paper (maize as accent only, never sole indicator, never body text where contrast fails), keyboard operability, `alt` on all images.
- **EX-70.** Reduced motion (EX-14) and pointer-aware cursor (EX-15) honored on every page.
- **EX-71.** Responsive correctness (EX-16/EX-17) validated from 320px on every route.
- **EX-72.** SEO baseline per route: unique `<title>` + meta description, canonical, OG + Twitter (`summary_large_image`), a generated `sitemap.xml` (external routes only — internal excluded, EX-6), and `robots.txt` disallowing `/internal/*`. A default brand OG image exists as fallback.
- **EX-73.** No external page, bundle, sitemap, or robots file references internal routes, evaluation data, or any secret. Only the public (anon/publishable) key is shipped to the client — and even that grants nothing, since anon writes are server-mediated (EX-60).
- **EX-74.** Empty/failure states are designed, not accidental: no page renders `0`, blank grids, broken images, lorem, or template defaults in production (enforced by build guards — EX-21 — and content-completeness review — EX-45).

**Requirements index:** Global shell EX-1–EX-18 · Home/impact-stats EX-19–EX-23 · Placement EX-24–EX-34 · Team EX-35–EX-37 · Recruitment EX-38–EX-40 · Services EX-41–EX-43 · About EX-44–EX-45 · Contact EX-46–EX-48 · Apply EX-49–EX-66 · Cross-cutting EX-67–EX-74.

## 9. Internal recruitment ATS requirements

### 9.0 Mental model & conventions

The funnel is fixed: **Application → Speed Dating → Group Case → Interview → Hash → Decision.** The candidate profile is the single source of truth; every score, note, reaction, COI flag, and hash vote attaches to a `(candidate, stage)` pair. **All requirements are enforced by Supabase RLS first and by UI second — the UI is never the security boundary.** Requirements are `ATS-1 … ATS-60`. "MUST" = hard requirement; "SHOULD" = strong default overridable only by a board decision logged in the audit trail.

**Terminology.** *Stage* = a funnel phase with its own rubric and blind boundary (Speed Dating, Group Case, Interview); Hash is a deliberation stage with votes, not rubric scores. *Evaluator* = any committee/board user who submits scores, reactions, or notes. *Composite (raw)* = weighted mean of one evaluator's criteria for a candidate in a stage. *Normalized composite (z)* = that raw composite z-scored against the same evaluator's distribution within the stage (ATS-21). *Controversy* = dispersion of evaluator opinion (ATS-37). *Cycle* = one recruitment season; candidates, rubric versions, and hash sessions are cycle-scoped via `recruitment_cycles` (DM-M1).

### 9.0.1 Internal information architecture (reconciliation O3)

All internal routes live under `app/(internal)/` and are auth-gated by middleware (SEC-9); none are linked from the public site (EX-6). All are dynamic/SSR (`force-dynamic`, NFR-21).

```
/internal                         Dashboard (cycle summary, my assignments, quick links)
/internal/candidates              Candidate roster for the active cycle (committee/board)
/internal/candidates/[code]       Candidate profile (C01…) — aggregation view (ATS-32)
/internal/score/[code]/[stage]    Scorecard for a (candidate, stage) — blind-until-submitted (ATS-10–15)
/internal/hash                    Hash session list (board opens/closes)
/internal/hash/[id]               Live deliberation for a session (queue, cards, voting, quorum)
/internal/members                 Member profiles (own profile editable; board edits any)
/internal/admin                   Rubrics, roles, cycles, allowlist — BOARD ONLY
/internal/audit                   Audit log viewer — BOARD ONLY
```

Navigation respects role: general members see only `/internal/members` (own profile) and a read-only `/internal/candidates` roster gated to open-rush cycles via `v_candidate_roster` (J1); committee adds candidate profiles, scorecards, and hash; board adds `/internal/admin` and `/internal/audit`.

### 9.1 Roles & permissions

Four authenticated roles plus the unauthenticated applicant. Exactly one role per user per cycle; board inherits all committee capabilities.

| Capability | Applicant (anon) | General member | Recruitment committee | Board |
|---|:---:|:---:|:---:|:---:|
| Submit application via `/apply` | ✅ | ✅ | ✅ | ✅ |
| View any evaluation data (scores/notes/reactions/hash) | ❌ | ❌ | ✅ | ✅ |
| View open-rush candidate roster (names + basic info only) | ❌ | ✅ | ✅ | ✅ |
| Create / edit **own** member profile | ❌ | ✅ | ✅ | ✅ |
| View full candidate profile (aggregated) | ❌ | ❌ | ✅ | ✅ |
| Enter rubric scores | ❌ | ❌ | ✅ | ✅ |
| Leave notes | ❌ | ❌ | ✅ | ✅ |
| Leave conviction reactions | ❌ | ❌ | ✅ | ✅ |
| Raise COI flag | ❌ | ❌ | ✅ | ✅ |
| Cast hash votes | ❌ | ❌ | ✅ | ✅ |
| Configure rubrics / criteria / weights / stages / cycles | ❌ | ❌ | ❌ | ✅ |
| Manage roles & invite allowlist | ❌ | ❌ | ❌ | ✅ |
| Open/close/configure hash sessions; flip vote visibility | ❌ | ❌ | ❌ | ✅ |
| Mark COI scores excluded / restore | ❌ | ❌ | ❌ | ✅ |
| Finalize decisions | ❌ | ❌ | ❌ | ✅ |
| View audit trail | ❌ | ❌ | ❌ | ✅ |

- **ATS-1.** The system MUST enforce default-deny RLS so any user with no role row, or an unauthenticated session, reads nothing in the internal schema except `v_candidate_roster` (ATS-3) and their own member profile. **AC:** a no-role or anon query against `scores`/`notes`/`reactions`/`votes`/`decisions`/`audit_log` returns zero rows (verified by automated RLS test per table).
- **ATS-2.** Exactly one role per user per cycle; reassignment replaces (never stacks) and is audit-logged with actor, target, old/new role, timestamp. A user may hold different roles in different cycles.
- **ATS-3.** General members view the open-rush roster (names + basic info only) via `v_candidate_roster` (J1), never any evaluation data. They see `display_code` (C01), `full_name`, `year`, `major`, and a coarse status label. The underlying tables remain unreadable; a join attempt from the view to evaluation tables returns zero rows.
- **ATS-4.** The member-visible status exposes only a board-configured coarse set — default `Applied | In process | Closed` (J1) — never stage pass/fail, scores, or rank. Default maps active candidates to "In process" until decisions finalize.

### 9.2 Stage-based scoring rubrics (configurable, weighted, versioned)

- **ATS-5.** A rubric belongs to exactly one stage and cycle, with ≥1 criterion. Each criterion has name, optional description, integer weight, and a score scale (**default 1–5 integer**, bounds configurable; K1). The board can add, rename, reweight, reorder, deactivate criteria.
- **ATS-6.** Evaluators score each criterion on the configured scale. **Scores are integers within `[min_score, max_score]`** (K1; no half-points). Out-of-range or non-integer values are rejected by the API; no row is written. At most one score per evaluator per criterion per candidate per stage.
- **ATS-7.** `composite_raw = Σ(value_i × weight_i) / Σ(weight_i)` over active criteria in the rubric version scored against (weighted mean keeps the composite within `[min, max]`). Recomputed (in `v_score_composite`, I4) when any constituent score changes (subject to ATS-50). Each composite records its rubric version.
- **ATS-8.** Rubrics are immutable once any score references them; any edit creates a **new rubric version** and existing scores keep their version. The profile and hash card label each score's version.
- **ATS-9.** New scores use the current active version; aggregation groups/labels by version and surfaces a "mixed rubric version" badge when versions differ within a stage.

### 9.3 Blind-until-submitted (bias-mitigation crown jewel — canonical mechanism, O6)

Enforced **both UI and RLS** — UI hiding alone is insufficient. **Canonical mechanism (reconciliation B): a dedicated append-only `score_submissions` table.** One row per `(evaluator_id, candidate_id, stage)` is inserted at the moment the evaluator submits that stage's scorecard. There is **no `status` column on `scores`.** The blind predicate (UI and RLS) for reading any peer's `scores`/`notes`/`reactions` for `(candidate_id, stage)` is: visible only if `EXISTS (SELECT 1 FROM score_submissions ss WHERE ss.evaluator_id = current_member_id() AND ss.candidate_id = <row>.candidate_id AND ss.stage = <row>.stage)`. An evaluator always sees their own rows; board is never blinded.

- **ATS-10.** Before an evaluator's own submission for `(candidate, stage)` is committed, they MUST NOT see, for that pair: any peer's criterion scores, composites, normalized scores, conviction reactions, notes, COI flags, controversy, the count of others who submitted, or any aggregate. The candidate's **application data and resume are always visible** (they are the input, not peer opinion).
- **ATS-11.** Enforced server-side via RLS: a direct REST/RPC call from a non-submitted evaluator returns zero peer rows. The predicate keys on the existence of the caller's own `score_submissions` row (via `current_member_id()`, A2).
- **ATS-12.** The unlock event is the explicit, irreversible "Submit scores" action that atomically commits the evaluator's criterion scores (and reaction, if entered) **and inserts the `score_submissions` row**. Saving a draft does NOT unlock. There is no partial unlock.
- **ATS-13.** UI states for `(candidate, stage)`: (1) **Not started** — application+resume shown; empty form; peer panel `[Blind] Peer scores hidden until you submit`; no counts. (2) **Draft** — values persisted to the author only; peer panel still locked; "Submit to reveal peer input" affordance. (3) **Submitting** — atomic commit; controls disabled. (4) **Submitted (unlocked)** — peer scores, normalized values, reactions, notes, COI, controversy, aggregates visible. (5) **Edit-requested (post-submit)** — peer data stays visible (cannot re-blind); edit tracked (ATS-50).
- **ATS-14.** The blind boundary is per-evaluator and per-`(candidate, stage)`: submitting for `(C1, Speed Dating)` unlocks only that pair.
- **ATS-15.** Drafts are author-private, excluded from all aggregates, normalization, controversy, hash, quorum, and completeness until submitted.

### 9.4 Conviction reactions

- **ATS-16.** Scale = exactly **Strong Yes · Yes · No · Strong No** (no neutral/abstain). One reaction per evaluator per candidate per stage; stored attributed and timestamped.
- **ATS-17.** Reactions follow the same blind rule as scores; a reaction MAY be submitted as part of the atomic submit (ATS-12). Editable pre-lock (ATS-50/D1).
- **ATS-18.** Numeric encoding for controversy/aggregation only: `Strong Yes = +2, Yes = +1, No = −1, Strong No = −2`; never substituted for rubric composites in normalization.

### 9.5 Notes

- **ATS-19.** Each note is attributed, stage-tagged, timestamped, attached to a candidate; multiple per evaluator per stage; authorship recorded server-side.
- **ATS-20.** Peer notes for `(candidate, stage)` are hidden until the viewer has submitted for that pair. An evaluator always sees/edits their own notes (pre-lock). **Notes are editable until the stage lock point (D1)** and **soft-deleted via a single `deleted_at timestamptz` column (D2)** — there is no 15-minute window and no separate "hidden" boolean. Board may soft-delete any note; authors may soft-delete their own pre-lock. Edits/deletes are audit-logged; the body is preserved in the row and audit log.

### 9.6 Score normalization (z-score per evaluator within stage — reconciliation K2)

Corrects for evaluators who score systematically high/low or in a narrow band. Computed per evaluator across the candidates they scored within a stage, then aggregated per candidate. Derived in views (`v_score_normalized`, I4); not a base column.

- **ATS-21.** For evaluator E in stage S, let E's submitted composites be `{x₁…xₙ}` (excluded COI scores removed first, ATS-30). `μ_E = (1/n)·Σxᵢ`; **sample standard deviation `σ_E = sqrt( Σ(xᵢ − μ_E)² / (n − 1) )`** (K2). `z(C,E) = (x_C − μ_E) / σ_E`. The candidate's stage normalized composite is the mean of `z(C,E)` over non-excluded evaluators who scored C in S.
- **ATS-22.** Both raw and normalized composites display side by side (e.g. `z = +0.84`); raw is never hidden.
- **ATS-23.** Edge cases (K2): **n = 1** → `σ_E` undefined → `z = null`, fall back to raw for that contribution, badge `Not normalizable (n=1)`; the score still counts in the raw aggregate but is excluded from the normalized mean. **σ_E = 0** (n ≥ 2) → `z = 0` for all that evaluator's candidates, badge `Zero-variance evaluator`. **n below `MIN_N_FOR_NORM` (default 3)** → compute but badge `Low-n normalization (n=k)`; board MAY suppress normalized display below threshold. **No submitted scores** → normalized `null`; profile shows "Awaiting scores."
- **ATS-24.** Normalization recomputes reactively: adding/editing/excluding/restoring a score in S recomputes `μ_E`/`σ_E` and the normalized composites for **all** candidates that evaluator scored in S, atomically, before hash sorting uses them.
- **ATS-25.** Normalization is scoped strictly within `(evaluator, stage, cycle)`; cross-stage and cross-cycle scores never enter a distribution.

### 9.7 Conflict-of-interest (COI)

- **ATS-26.** Any committee/board evaluator can raise a COI flag ("I know this candidate"), attributed, timestamped, optional reason, at any time.
- **ATS-27.** COI-flagged scores/reactions/notes carry a visible `COI` badge. The flag is disclosure (not peer opinion) and is visible to all committee+board, not subject to the blind rule.
- **ATS-28.** Only the board toggles a flagged score's `excluded` state; excluding removes it from raw aggregate, normalization, controversy, and completeness counts, while the row is retained with an `Excluded (COI)` badge. Every toggle is audit-logged.
- **ATS-29.** A COI flag alone is non-destructive (default "flag visible, score still counted"). The board MAY set a per-cycle auto-exclude policy; auto-exclusion is itself audit-logged.
- **ATS-30.** Excluded scores are removed from `{xᵢ}` before computing `μ_E`/`σ_E`; this can change n and trigger small-n handling (ATS-23).
- **ATS-31.** If exclusions drop a candidate's counted evaluators in a stage below `MIN_EVALUATORS_PER_STAGE` (default 2), the candidate is flagged `Insufficient independent evaluation`; the system MUST NOT auto-decide. Board recruits more evaluators, re-includes a reviewed score with logged justification, or carries the candidate to hash with the banner shown. Audit-logged.

### 9.8 Candidate profile (aggregation)

- **ATS-32.** A single profile aggregates, scoped to cycle: application responses + resume link; per-stage raw and normalized composites (with version labels); notes (subject to blind rules); reactions; COI flags + exclusion states; current stage + status; controversy (ATS-37). Committee+board only.
- **ATS-33.** Per-stage rollups: evaluator count (counted vs excluded), raw mean composite, normalized mean composite, reaction distribution, controversy. Empty stages show "Awaiting scores."
- **ATS-34.** The profile respects blind-until-submitted: peer-derived sections for a stage the viewer hasn't submitted are masked (ATS-10/13); the rest renders normally.
- **ATS-35.** Each candidate shows a stable index `C01…Cn` per cycle (`per_cycle_seq`, DM), used consistently across roster, profile, and hash, and shown to members in `v_candidate_roster` (J1).
- **ATS-36.** A candidate can be set `withdrawn` (board action; in v1 there is **no authenticated applicant self-withdraw** — withdrawal is requested by email and set by the board, O2/OQ-12). On withdrawal: in-flight scores retained read-only and excluded from active queues/quorum; removed from open hash sessions; profile shows `Withdrawn (at <stage>, <timestamp>)`. No scores deleted. Re-entry is a logged board action. Funnel movement is recorded in `stage_transitions` (DM-M7).
- **ATS-37.** Controversy for `(candidate, stage)` = the standard deviation of counted evaluators' normalized composites; when normalized values are unavailable (small-n), fall back to the standard deviation of the conviction-reaction encoding (ATS-18). Higher = more controversial. `null` when fewer than 2 counted evaluators. Computed in `v_candidate_controversy` (I4).

### 9.9 Member profile (feeds `/placement` and `/team`)

- **ATS-38.** Members create/edit their own profile (name, year, major, role, photo, bio, current company/internship, `is_public`, `placement_consent`). A member edits only their own row (RLS); board edits any.
- **ATS-39.** Member internship data feeds `/placement` via `v_placement_public` + `placement_features` curation (DM-M4, §8.2). **`is_public` governs `/team`; `placement_consent` (DM-M5) separately governs `/placement`** — a member can appear in one, both, or neither.
- **ATS-40.** Members and candidates are distinct tables; a former candidate who becomes a member carries no evaluation rows into the member profile.

### 9.10 Hash mode (live deliberation)

- **ATS-41.** Only the board can create/open/close a hash session, scoped to a stage + cycle, with a defined **participant set (eligible voters) recorded in `hash_session_participants` (DM-M3)** and open/close timestamps. Committee+board readable; never member/applicant readable.
- **ATS-42.** The queue sorts by raw composite, normalized composite, or controversy. **Default = controversy-descending.** Sort is viewer-local.
- **ATS-43.** Per-candidate hash card: index + name, raw + normalized composite, reaction distribution, controversy, COI/exclusion badges, insufficiency banner (ATS-31), notes (subject to upstream blind rules), live tally state, quorum status.
- **ATS-44.** Vote options = exactly **Advance · Cut · Discuss more**. One active vote per participant per candidate per session; changeable until the candidate's decision is finalized. Votes are append-only (a change writes a new row; latest by `created_at` supersedes; full history retained).
- **ATS-45.** **Default visibility = anonymous** (participants see only the aggregate tally). The board can flip a **specific session** to `open` before or during voting; the flip is audit-logged with actor + timestamp, and **all participants are visibly notified via a banner + an ARIA live-region announcement** (O4, NFR-15). Visibility is per-session, never global, and cannot retroactively re-anonymize already-attributed votes without an audit-logged board action. Even in anonymous mode, attribution is stored server-side for audit but never exposed in any participant-facing API response (the `vote_counts` view omits `voter_id`, I2).
- **ATS-46.** Each session has a configurable quorum (absolute count or fraction of eligible participants from `hash_session_participants`, board-set). The card shows votes cast vs threshold and a `Quorum met / not met` state. A decision cannot finalize while quorum is unmet unless the board overrides with logged justification.
- **ATS-47.** Tie/no-quorum never auto-resolve. **Tie** → `Tied — needs resolution`; default path is convert to `Discuss more` and re-vote, or a logged board override. **No quorum** → cannot finalize; board may extend voting, re-queue, or override with justification. Either is audit-logged.
- **ATS-48.** Only the board finalizes. Finalization records candidate, stage, outcome, the tally at decision time, quorum state, vote-visibility mode, deciding board member, timestamp, and any override justification. **The `decisions` row is permanently immutable/append-only (E1); a reversal or change of mind is a NEW decision row referencing the prior — never an edit/delete. `decision_value` ∈ `{accepted, rejected, waitlisted}` (E2); the latest row by `created_at` is authoritative.**
- **ATS-49.** All hash votes, vote changes, visibility flips, quorum overrides, and decisions are append-only with full history retained. RLS + a `deny_mutation` trigger deny UPDATE/DELETE on these tables for all roles including `service_role` (DM-4).

### 9.11 Edge cases (cross-cutting)

- **ATS-50. Evaluator submits then edits (canonical lock model, D1).** After submitting `(candidate, stage)`, an evaluator MAY edit their own scores/reaction/notes **until the stage lock point = when that stage's hash decision is finalized** (board-configurable; default = hash finalization for the stage). Editing does not re-blind (UI state → "Edit-requested," ATS-13.5). Every edit writes an audit event with before/after, recomputes the evaluator's normalization distribution (ATS-24), and is marked `Edited <timestamp>`. After lock, edits are refused; a correction is a board-logged action (which does not delete the `score_submissions` row; re-opening for edit is itself audited, B3).
- **ATS-51.** Candidate withdraws mid-stage — governed by ATS-36.
- **ATS-52.** Rubric edited after scores exist — governed by ATS-8/ATS-9 (new version; mixed-version badge; the board is warned at edit time).
- **ATS-53.** Tie / no quorum in hash — governed by ATS-47.
- **ATS-54.** COI on a majority of evaluators — governed by ATS-31.
- **ATS-55. Re-applicant across cycles (C2).** A prior-cycle applicant who reapplies creates a **new candidate row scoped to the new cycle**; prior-cycle evaluation data is not visible by default (avoids carry-forward bias). The system SHOULD detect a likely match (by email/name) and surface a non-evaluative `Re-applicant (applied <cycle>)` badge to the board only; viewing prior-cycle scores is a board action, audit-logged. (Open: identity-match rule, OQ-7.)

### 9.12 Audit trail

- **ATS-56.** The audit log records, for every score/note/reaction/COI flag-or-exclusion/rubric-or-version change/role change/hash vote-or-change/visibility flip/quorum override/decision/candidate status change: actor (server-derived auth user), action, target, before/after where applicable, and server timestamp.
- **ATS-57.** Append-only and board-only: RLS denies UPDATE/DELETE for all roles including board; INSERTs come from trusted server logic (triggers/security-definer functions), not arbitrary client writes. Only board can SELECT.
- **ATS-58.** Board can filter/sort by actor, action type, candidate, stage, time range. Read-only.

### 9.13 Native application intake (`/apply`)

- **ATS-59.** `/apply` is the native intake writing to `candidates` + `application_responses` and uploading the resume to private Storage. It is the only public write path and is **server-mediated** (F2 — see §8.9). Resume is **PDF-only ≤10MB** (F1). On success the applicant sees a confirmation and gains **no read access** to any candidate or evaluation data (ATS-1).
- **ATS-60.** The intake path is tightly scoped: **anon holds no direct DB or Storage grant** (F2); the Route Handler performs all writes with the `service_role` key. Anon cannot SELECT/UPDATE/DELETE any internal table or enumerate/read resumes. The handler applies Turnstile + the 5/IP/24h Postgres-backed rate limit + honeypot (EX-61/L) and records submission timestamp and source. Resumes are readable only by committee+board via signed URLs, never publicly enumerable.

### 9.14 Configurable parameters (board-set, per cycle)

| Parameter | Default | Governs |
|---|---|---|
| `MIN_N_FOR_NORM` | 3 | Min candidates an evaluator must have scored in a stage before normalization shows without a low-n badge (ATS-23) |
| `MIN_EVALUATORS_PER_STAGE` | 2 | Min counted evaluators before a candidate is flagged insufficiently evaluated (ATS-31); MET-3 default ≥3 for completeness |
| Rubric scale | 1–5 integer | Per-stage criterion scoring range (ATS-5/6, K1) |
| Hash quorum | board-set | Votes required to finalize (ATS-46) |
| Default hash vote visibility | anonymous | Per-session, flippable to open (ATS-45) |
| COI auto-exclude policy | off (flag only) | Whether a COI flag auto-excludes the score (ATS-29) |
| Post-submit edit lock point | stage hash finalized | When evaluators can no longer self-edit (ATS-50, D1) |
| Member-visible status labels | Applied / In process / Closed | Coarse status exposed to members (ATS-4, J1) |

## 10. Data model

### 10.0 Design principles

- **DM-1 — Surrogate keys.** Every table uses a `uuid` primary key from `gen_random_uuid()`. UUIDv7 is preferable on the highest-insert tables (`audit_log`, `votes`) if `pg_uuidv7` is enabled, but at the anticipated scale (<200 candidates/cycle, <25 evaluators) UUID v4 is fully acceptable. **`members.id` is the table's own PK and is NOT `auth.uid()` (reconciliation A1); the auth link is `members.user_id`.**
- **DM-2 — Timestamps.** All tables carry `created_at timestamptz NOT NULL DEFAULT now()`; mutable tables also carry `updated_at` maintained by a `set_updated_at()` `BEFORE UPDATE` trigger. All UTC. Append-only tables carry only `created_at`; the absence of `updated_at` signals immutability.
- **DM-3 — Soft vs hard delete.**

| Table | Policy | Rationale |
|---|---|---|
| `members`, `candidates` | Soft delete (`deleted_at`) | Preserve attribution / evaluation history |
| `notes` | Soft delete (`deleted_at`); body preserved in row + audit log (D2) | Audit needs content; UI hides deleted |
| `rubric_versions` / `rubric_criteria` | No delete; versioning handles retirement | Historical score resolution |
| `scores`, `reactions`, `coi_flags` | No delete | Evaluation data is permanent |
| `hash_sessions` | Soft close (`ended_at`) | Sessions finish, not deleted |
| `votes`, `decisions`, `audit_log`, `score_submissions`, `stage_transitions`, `application_responses` | Append-only — no UPDATE/DELETE (DM-4) | Immutability is a correctness/compliance requirement |
| `invite_allowlist` | Hard delete permitted | Revoked-before-use invites may be removed |
| `recruitment_cycles` | Soft archive (`is_active`) | Cycles are never deleted |

- **DM-4 — Append-only enforcement.** `votes`, `decisions`, `audit_log`, `score_submissions`, `stage_transitions`, and `application_responses` are permanently append-only via a `BEFORE UPDATE OR DELETE` trigger `deny_mutation` on each: `RAISE EXCEPTION 'Table % is append-only.'`. RLS alone is insufficient because `service_role` bypasses RLS; the trigger fires unconditionally for all roles including `service_role` and `postgres`. **`decisions` carries no UPDATE path anywhere (E1).**

### 10.1 Enums

- **DM-5.**
  - **`member_role`**: `board` · `recruitment_committee` · `general_member`.
  - **`candidate_stage`**: `applied` · `speed_dating` · `group_case` · `interview` · `hash` · `decided`.
  - **`candidate_status`** (J2 — **no `open_rush` value**; open-rush is a cycle property): `active` · `advanced` · `cut` · `waitlisted` · `withdrawn` · `accepted` · `rejected`.
  - **`reaction_value`**: `strong_yes (+2)` · `yes (+1)` · `no (−1)` · `strong_no (−2)` (numeric proxy display-only).
  - **`vote_value`**: `advance` · `cut` · `discuss`.
  - **`decision_value`** (E2): `accepted` · `rejected` · `waitlisted`.
  - **`hash_visibility`** (I1): `anonymous` (default) · `open`.
  - **`audit_action`**: `candidate_created`, `candidate_stage_advanced`, `candidate_status_changed`, `score_saved`, `score_submitted`, `score_edit_reopened`, `note_created`, `note_updated`, `note_soft_deleted`, `reaction_set`, `coi_flagged`, `coi_exclusion_toggled`, `evaluator_assigned`, `hash_session_started`, `hash_session_ended`, `hash_visibility_changed`, `hash_participant_added`, `vote_cast`, `decision_recorded`, `rubric_version_created`, `rubric_version_activated`, `member_role_changed`, `member_soft_deleted`, `invite_created`, `invite_consumed`, `cycle_created`, `cycle_open_rush_toggled`.

### 10.2 Tables

#### `members`
Every internal user; 1:1 with a Supabase Auth user via `user_id`.

| Column | Type | Null | Default | FK / Reference | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK (≠ `auth.uid()`, A1) |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | trigger-maintained |
| `deleted_at` | `timestamptz` | YES | `NULL` | — | soft delete |
| `user_id` | `uuid` | NO | — | `auth.users(id) ON DELETE CASCADE` | **UNIQUE — the auth link (A1)** |
| `role` | `member_role` | NO | `'general_member'` | — | |
| `email` | `text` | NO | — | — | UNIQUE `lower(email)`; matches auth email |
| `full_name` | `text` | NO | — | — | |
| `preferred_name`, `year`, `major`, `bio` | `text` | YES | `NULL` | — | profile fields (`bio` on `/team`) |
| `photo_storage_path` | `text` | YES | `NULL` | — | Storage path |
| `current_company`, `current_role_title` | `text` | YES | `NULL` | — | feed `/placement` |
| `linkedin_url` | `text` | YES | `NULL` | — | |
| `is_public` | `boolean` | NO | `false` | — | `true` ⇒ on `/team` |
| `placement_consent` | `boolean` | NO | `false` | — | **M5 — separate from `is_public`; `true` ⇒ company may appear on `/placement`** |

Unique: `(user_id)`, `(lower(email))`.

#### `invite_allowlist` (reconciliation I3)
Controls who may register. Board-only writes.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `email` | `text` | NO | — | — | UNIQUE `lower(email)` |
| `role` | `member_role` | NO | `'general_member'` | — | **role to grant on registration (I3)** |
| `invited_by` | `uuid` | YES | `NULL` | `members(id) ON DELETE SET NULL` | |
| `expires_at` | `timestamptz` | YES | `NULL` | — | **I3 — `NULL` = no expiry** |
| `consumed_at` | `timestamptz` | YES | `NULL` | — | **I3 — set on successful registration** |
| `notes` | `text` | YES | `NULL` | — | |

Validity = `consumed_at IS NULL AND (expires_at IS NULL OR expires_at > now())` (I3). Unique: `(lower(email))`.

#### `recruitment_cycles` (M1)
One row per cycle; all evaluation data is cycle-scoped via `cycle_id` FK chains.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `name` | `text` | NO | — | — | UNIQUE; e.g. `"Fall 2026"` |
| `applications_open_at` / `applications_close_at` | `timestamptz` | YES | `NULL` | — | controls public form availability |
| `is_active` | `boolean` | NO | `false` | — | ≤1 `true` (partial unique index) |
| `is_open_rush` | `boolean` | NO | `false` | — | **`true` ⇒ general members may read `v_candidate_roster` (J2)** |
| `created_by` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |

Unique: `(name)`. Partial unique: `(is_active) WHERE is_active`, `(is_open_rush) WHERE is_open_rush`.

#### `candidates`
One row per applicant per cycle; inserted by the server-mediated `/apply` Route Handler (F2).

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `deleted_at` | `timestamptz` | YES | `NULL` | — | soft delete |
| `cycle_id` | `uuid` | NO | — | `recruitment_cycles(id) ON DELETE RESTRICT` | |
| `per_cycle_seq` | `integer` | NO | — | — | trigger-assigned; displayed `C01`, `C02` (`display_code`) |
| `full_name`, `preferred_name`, `phone`, `year`, `major` | `text` | mixed | — | — | |
| `email` | `text` | NO | — | — | **UNIQUE per cycle `(cycle_id, lower(email))` (C1) — no global unique** |
| `gpa` | `numeric(3,2)` | YES | `NULL` | — | `CHECK (gpa BETWEEN 0 AND 4.0)` |
| `resume_storage_path` | `text` | YES | `NULL` | — | **F3 — canonical name; populated after upload** |
| `linkedin_url` | `text` | YES | `NULL` | — | |
| `current_stage` | `candidate_stage` | NO | `'applied'` | — | |
| `status` | `candidate_status` | NO | `'active'` | — | (no `open_rush`, J2) |

Unique: `(cycle_id, lower(email))`, `(cycle_id, per_cycle_seq)`. `per_cycle_seq` is set by a `BEFORE INSERT` trigger using `SELECT COALESCE(MAX(per_cycle_seq),0)+1 FROM candidates WHERE cycle_id = NEW.cycle_id FOR UPDATE` (the lock serializes concurrent intake). UI renders `C{seq:02d}` (the `display_code`, C3).

#### `application_questions` (M6)
Board-configurable application prompts per cycle.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `cycle_id` | `uuid` | NO | — | `recruitment_cycles(id) ON DELETE CASCADE` | |
| `key` | `text` | NO | — | — | stable programmatic key, e.g. `"why_mecg"` |
| `prompt` | `text` | NO | — | — | question wording |
| `input_type` | `text` | NO | `'long_text'` | — | `short_text \| long_text \| url \| select` |
| `required` | `boolean` | NO | `true` | — | |
| `sort_order` | `integer` | NO | `0` | — | |

Unique: `(cycle_id, key)`.

#### `application_responses`
Immutable key-value answers captured at submission; `question_text` snapshots the prompt so responses survive prompt edits (M6).

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | immutable |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `question_key` | `text` | NO | — | — | matches `application_questions.key` |
| `question_text` | `text` | NO | — | — | snapshot at submission |
| `response_text` | `text` | NO | — | — | `CHECK (length(response_text) > 0)` |

Unique: `(candidate_id, question_key)`. Append-only (`deny_mutation`).

#### `rubric_versions`
A versioned rubric per stage; new versions never delete old ones. ≤1 active per stage.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `cycle_id` | `uuid` | NO | — | `recruitment_cycles(id) ON DELETE RESTRICT` | cycle-scoped |
| `stage` | `candidate_stage` | NO | — | — | |
| `version_number` | `integer` | NO | — | — | per stage |
| `label` | `text` | YES | `NULL` | — | e.g. `"Fall 2026 Speed Dating v2"` |
| `is_active` | `boolean` | NO | `false` | — | ≤1 active per stage |
| `created_by` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |

Unique: `(cycle_id, stage, version_number)`. Partial unique: `(cycle_id, stage) WHERE is_active`.

#### `rubric_criteria`
Scored dimensions within a version; immutable once scores exist (versioning handles change).

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `rubric_version_id` | `uuid` | NO | — | `rubric_versions(id) ON DELETE CASCADE` | |
| `name` | `text` | NO | — | — | e.g. `"Communication"` |
| `description` | `text` | YES | `NULL` | — | evaluator guidance |
| `weight` | `numeric(6,4)` | NO | `1.0` | — | `CHECK (weight > 0)`; need not sum to 1 |
| `min_score` | `integer` | NO | `1` | — | `CHECK (min_score >= 1)` |
| `max_score` | `integer` | NO | `5` | — | `CHECK (max_score > min_score)` |
| `display_order` | `integer` | NO | `0` | — | |

Unique: `(rubric_version_id, name)`.

#### `score_submissions` (the blind-rule trigger event — reconciliation B)
One row per `(candidate, evaluator, stage)`, inserted atomically when an evaluator submits a stage scorecard. Immutable.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `submitted_at` | `timestamptz` | NO | `now()` | — | the blind-trigger timestamp (B3) |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `evaluator_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `stage` | `candidate_stage` | NO | — | — | |
| `rubric_version_id` | `uuid` | NO | — | `rubric_versions(id) ON DELETE RESTRICT` | active rubric snapshot at submit |

Unique: `(candidate_id, evaluator_id, stage)`. Append-only (`deny_mutation`); the unique constraint prevents double-submission. **There is no `status` column on `scores`; this table is the sole blind-state mechanism (B1).**

#### `scores`
One row per evaluator per criterion per candidate. **`value` is `integer` (K1).** Editable until the stage lock point (D1), enforced by a `BEFORE UPDATE` trigger that checks the lock predicate (see DM-29).

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `rubric_criterion_id` | `uuid` | NO | — | `rubric_criteria(id) ON DELETE RESTRICT` | |
| `rubric_version_id` | `uuid` | NO | — | `rubric_versions(id) ON DELETE RESTRICT` | denormalized snapshot (self-describing history) |
| `evaluator_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `stage` | `candidate_stage` | NO | — | — | denormalized for RLS/query |
| `value` | `integer` | NO | — | — | **`CHECK (value >= 1)`; range `[min_score,max_score]` enforced at API (K1); no half-points** |

Unique: `(candidate_id, rubric_criterion_id, evaluator_id)`.

#### `notes`
Free-text per candidate per stage; subject to the blind rule; **soft-delete via `deleted_at` (D2)**.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `deleted_at` | `timestamptz` | YES | `NULL` | — | **D2 — single soft-delete column; body preserved** |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `author_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `stage` | `candidate_stage` | NO | — | — | required for blind gate |
| `body` | `text` | NO | — | — | `CHECK (length(body) > 0)` |

No unique constraint (multiple notes per author per candidate per stage).

#### `reactions`
One reaction per evaluator per candidate per stage; editable until the lock point (D1); subject to the blind rule.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `evaluator_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `stage` | `candidate_stage` | NO | — | — | |
| `value` | `reaction_value` | NO | — | — | |

Unique: `(candidate_id, evaluator_id, stage)`.

#### `coi_flags`
Self-reported conflict of interest; board may exclude from aggregation.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `member_id` | `uuid` | NO | — | `members(id) ON DELETE CASCADE` | |
| `description` | `text` | YES | `NULL` | — | |
| `is_excluded_from_agg` | `boolean` | NO | `false` | — | board-only write; excludes from `v_score_composite` and downstream |

Unique: `(candidate_id, member_id)`.

#### `evaluator_assignments` (M2)
Who is assigned to evaluate which stage (and optionally which candidate). Powers MET-2 adoption / MET-3 completeness and optional stage-scoped access.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `cycle_id` | `uuid` | NO | — | `recruitment_cycles(id) ON DELETE CASCADE` | |
| `stage` | `candidate_stage` | NO | — | — | |
| `evaluator_id` | `uuid` | NO | — | `members(id) ON DELETE CASCADE` | |
| `candidate_id` | `uuid` | YES | `NULL` | `candidates(id) ON DELETE CASCADE` | **NULL = stage-wide assignment (M2)** |

Unique: `(cycle_id, stage, evaluator_id, candidate_id)` (NULLs distinct as appropriate).

#### `stage_transitions` (M7)
Append-only funnel-movement audit, independent of `candidates.current_stage`.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | immutable |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE CASCADE` | |
| `from_stage` | `candidate_stage` | YES | `NULL` | — | NULL for initial assignment |
| `to_stage` | `candidate_stage` | NO | — | — | |
| `actor_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `reason` | `text` | YES | `NULL` | — | |

Append-only (`deny_mutation`).

#### `hash_sessions` (reconciliation I1)
One per deliberation round; ≤1 active per cycle. `visibility` (not `vote_visibility`) controls identity reveal.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `cycle_id` | `uuid` | NO | — | `recruitment_cycles(id) ON DELETE RESTRICT` | |
| `stage` | `candidate_stage` | NO | — | — | the stage this hash decides |
| `name` | `text` | NO | — | — | e.g. `"Fall 2026 Hash — Round 1"` |
| `visibility` | `hash_visibility` | NO | `'anonymous'` | — | **I1 — board-only change** |
| `quorum_threshold` | `integer` | NO | `0` | — | `CHECK (>= 0)` |
| `is_active` | `boolean` | NO | `false` | — | **I1 — ≤1 active per cycle** |
| `started_at` / `ended_at` | `timestamptz` | YES | `NULL` | — | **I1 — `ended_at NULL` = open** |
| `started_by` | `uuid` | YES | `NULL` | `members(id) ON DELETE SET NULL` | |

Partial unique: `(cycle_id) WHERE is_active`.

#### `hash_session_participants` (M3)
The eligible-voter set; quorum = distinct voters ÷ eligible participants.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | |
| `session_id` | `uuid` | NO | — | `hash_sessions(id) ON DELETE CASCADE` | |
| `member_id` | `uuid` | NO | — | `members(id) ON DELETE CASCADE` | |

Unique: `(session_id, member_id)`.

#### `votes` (reconciliation I2)
Append-only; identity column is **`voter_id`**. Current vote for `(session_id, candidate_id, voter_id)` = greatest `created_at`. `voter_id` is concealed from non-board users when `visibility = 'anonymous'`.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | determines currency |
| `session_id` | `uuid` | NO | — | `hash_sessions(id) ON DELETE RESTRICT` | |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE RESTRICT` | |
| `voter_id` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | **I2** |
| `value` | `vote_value` | NO | — | — | |

No unique constraint (latest row wins). Append-only (`deny_mutation`).

#### `decisions` (reconciliation E)
Append-only board outcomes. Latest row per `(session_id, candidate_id)` by `created_at` is authoritative. **No UPDATE path (E1).**

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | latest = authoritative |
| `session_id` | `uuid` | NO | — | `hash_sessions(id) ON DELETE RESTRICT` | |
| `candidate_id` | `uuid` | NO | — | `candidates(id) ON DELETE RESTRICT` | |
| `value` | `decision_value` | NO | — | — | **`accepted \| rejected \| waitlisted` (E2)** |
| `decided_by` | `uuid` | NO | — | `members(id) ON DELETE RESTRICT` | |
| `rationale` | `text` | YES | `NULL` | — | |
| `voter_tally` | `jsonb` | YES | `NULL` | — | `{"advance":n,"cut":n,"discuss":n,"total_voters":n}` snapshot |

No unique constraint. Append-only (`deny_mutation`). A reversal is a new row (E2).

#### `audit_log`
Board-only, append-only; populated by `AFTER INSERT/UPDATE/DELETE` triggers via a shared `audit_trigger_fn()`.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` | `timestamptz` | NO | `now()` | — | immutable |
| `actor_id` | `uuid` | YES | `NULL` | `members(id) ON DELETE SET NULL` | NULL for system/anon-intake events |
| `action` | `audit_action` | NO | — | — | |
| `entity_type` | `text` | NO | — | — | table name |
| `entity_id` | `uuid` | NO | — | — | affected PK |
| `cycle_id` | `uuid` | YES | `NULL` | `recruitment_cycles(id) ON DELETE SET NULL` | denormalized for filtering |
| `before_state` / `after_state` | `jsonb` | YES | `NULL` | — | `to_jsonb(OLD)` / `to_jsonb(NEW)` |
| `metadata` | `jsonb` | YES | `NULL` | — | IP, UA, request id |

Append-only (`deny_mutation`) plus RLS: SELECT board only; INSERT `service_role`/trigger only.

#### `placement_features` (M4)
Curation/override layer powering `/placement` (EX-25). A row references a member OR is a fully manual entry.

| Column | Type | Null | Default | FK | Notes |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | — | PK |
| `created_at` / `updated_at` | `timestamptz` | NO | `now()` | — | |
| `cycle_id` | `uuid` | YES | `NULL` | `recruitment_cycles(id) ON DELETE SET NULL` | optional scoping |
| `member_id` | `uuid` | YES | `NULL` | `members(id) ON DELETE SET NULL` | **NULL ⇒ manual entry (M4)** |
| `company` | `text` | NO | — | — | normalized display name |
| `role_title` | `text` | YES | `NULL` | — | |
| `term` | `text` | YES | `NULL` | — | e.g. `"Summer 2026"` |
| `logo_storage_path` | `text` | YES | `NULL` | — | curated logo asset |
| `quote` | `text` | YES | `NULL` | — | highlight quote |
| `sort_order` | `integer` | NO | `0` | — | |
| `is_featured` | `boolean` | NO | `false` | — | pin to highlights |

#### `apply_rate_limit` (M8 / reconciliation L2)
Postgres-backed counter enforcing 5 submissions / IP / 24h without an Upstash dependency.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `ip_hash` | `text` | NO | — | hashed client IP (PK part) |
| `window_start` | `timestamptz` | NO | — | rolling 24h window anchor (PK part) |
| `count` | `integer` | NO | `0` | incremented in the same server transaction as the intake check |

PK: `(ip_hash, window_start)`. The Route Handler checks/increments this row transactionally before any insert (EX-61).

### 10.3 Derived views (reconciliation I4 — derived values are NOT base columns)

All derived computations operate only on scores with a `score_submissions` row; drafts are excluded. **Composites, normalized composites, and controversy live in views, never on `candidates`.**

- **DM-25 — `v_score_composite`** (SQL view; formerly raw-composite view). For each `(candidate c, evaluator e, stage s)` with a `score_submissions` row:
  `composite_raw(c,e,s) = SUM(scores.value × rubric_criteria.weight) / SUM(rubric_criteria.weight)` over criteria whose `rubric_version_id` matches `score_submissions.rubric_version_id`. Evaluators with `coi_flags.is_excluded_from_agg = true` for that candidate are filtered out.
- **DM-26 — `mv_evaluator_stage_stats`** (materialized view, refreshed `CONCURRENTLY` by an `AFTER INSERT` trigger on `score_submissions`). For each `(evaluator e, stage s, cycle cyc)`: `n = |K|` where `K` = candidates e submitted in s; `μ = (1/n)Σ composite_raw`; **`σ = STDDEV_SAMP` = `sqrt( Σ(composite_raw − μ)² / (n − 1) )` (reconciliation K2 — sample, n−1; the population/`STDDEV_POP` variant is removed).**
- **DM-27 — `v_score_normalized`** (SQL view on `v_score_composite` + `mv_evaluator_stage_stats`). Per `(c,e,s)`: if `n = 1` → `z = null` (raw-only fallback, badge `Not normalizable (n=1)`); else if `σ = 0` → `z = 0`; else `z = (composite_raw − μ)/σ`. Panel aggregates: `panel_composite_normalized(c,s) = AVG(z)`, `panel_composite_raw(c,s) = AVG(composite_raw)`, `panel_evaluator_count(c,s) = COUNT(DISTINCT e)` over non-excluded evaluators with a submission for `(c,s)`.
- **DM-28 — `v_candidate_controversy`** (SQL view on `v_score_normalized`). `controversy(c,s) = stddev of z over counted evaluators`; falls back to the stddev of reaction encodings when normalized values are unavailable (ATS-37). Hash default sort `controversy DESC`, secondary `panel_composite_normalized DESC`. Also exposes `evaluator_min_normalized`, `evaluator_max_normalized`, `panel_composite_raw`.
- **DM-30 — Public + roster views.** `v_candidate_roster` (J1 — `display_code`, `full_name`, `year`, `major`, coarse status; gated to `is_open_rush` cycles; general-member surface); `v_placement_public` (EX-24, merges `members` consent rows + `placement_features`); `v_team_public` (EX-35, `is_public` members); `v_impact_stats` (optional, EX-19); `vote_counts` (I2 — `(session_id, candidate_id, value, count)`, omits `voter_id`).

### 10.4 Rubric versioning (DM-24)
When a rubric changes, the board creates a new `rubric_versions` row (incremented `version_number`, `is_active = true`) and deactivates the old; old `rubric_criteria` are never modified. Each `scores` row anchors to its `rubric_criterion_id` and `rubric_version_id` (copied from `score_submissions.rubric_version_id` at write), so joining `scores → rubric_criteria → rubric_versions` always returns the criterion name/weight/min/max/label as they were at scoring time. Live panel aggregations filter on the active version; prior-version scores appear in historical reports with a version label.

### 10.5 Blind-until-submitted enforcement (DM-29 — reconciliation A + B)
States per `(evaluator, candidate, stage)`: no `score_submissions` row + no scores = own blank form only; no submission + draft scores = own draft only; **submission row present** = own submitted scores + any other evaluator's submitted scores/notes/reactions for the same `(candidate, stage)`. **Identity is resolved through the security-definer helpers `current_member_id()` / `current_member_role()` (A2) — never `members.id = auth.uid()`.** The canonical RLS predicate (used on `scores`, `notes`, `reactions`):

```sql
-- SELECT visibility for a peer row R (scores/notes/reactions)
R.evaluator_id = current_member_id()            -- always see your own
OR current_member_role() = 'board'              -- board is never blinded
OR EXISTS (                                     -- you have submitted for (candidate, stage)
     SELECT 1 FROM public.score_submissions ss
     WHERE ss.candidate_id = R.candidate_id
       AND ss.stage        = R.stage
       AND ss.evaluator_id = current_member_id()
   )
```

Score editing/locking: a `BEFORE UPDATE` trigger on `scores`/`reactions`/`notes` permits the author's own edits until the **stage lock point** (D1 — the stage's hash decision is finalized; board-configurable). After lock, the trigger raises an exception (enforced even via `service_role`); board re-opening for edit is audited (`score_edit_reopened`).

### 10.6 RLS indexing (DM-31)
All FK columns and all columns used in RLS predicates are indexed. Critical: `members(user_id)` (every `current_member_id()`/`current_member_role()` resolution), `members(role)`, `score_submissions(candidate_id, evaluator_id, stage)` UNIQUE (blind EXISTS), `scores(evaluator_id)`, `scores(candidate_id, stage)`, `notes(author_id)`, `notes(candidate_id, stage) WHERE deleted_at IS NULL`, `reactions(evaluator_id)`, `coi_flags(member_id)`, `votes(voter_id)`, `votes(session_id, candidate_id, voter_id, created_at DESC)`, `decisions(session_id, candidate_id, created_at DESC)`, `candidates(cycle_id)`, `candidates(cycle_id, lower(email))` UNIQUE, `evaluator_assignments(cycle_id, stage, evaluator_id)`, `hash_session_participants(session_id)`, `audit_log(entity_type, entity_id)`/`(actor_id)`/`(created_at)`/`(cycle_id)`. Helper functions and policies use the `(SELECT current_member_id())` subquery pattern to evaluate once per statement.

## 11. Access control & security (Supabase RLS)

### 11.1 Foundational model

- **SEC-1. Default deny.** Every table is `ENABLE` + `FORCE ROW LEVEL SECURITY`. A request succeeds only when an explicit `PERMISSIVE` policy returns `TRUE`; otherwise zero rows (SELECT) or permission-denied (write). No table is left unprotected.
- **SEC-2. Four principals.** `board`, `recruitment_committee`, `general_member` (stored in `members.role`), and `anon` (unauthenticated; `auth.uid()` is `NULL`). Roles are never embedded in the JWT; role is resolved at query time via security-definer helpers (SEC-10) so a change takes effect on the next request.
- **SEC-3. Server-side-first mutation.** The Supabase **publishable/anon key is not used for any anonymous write**; the one public write path (`/apply`) is server-mediated by a Route Handler holding `SUPABASE_SERVICE_ROLE_KEY` in the Vercel environment (F2, SEC-21). The service-role key is never shipped to the browser or any client bundle. Authenticated internal queries use the user's JWT (anon key on the server with the cookie session), relying on RLS.

### 11.2 Authentication & signup gating

- **SEC-4. @umich.edu enforcement.** A Supabase Auth signup hook rejects any signup whose email is not `@umich.edu`, with a generic message ("Signup not permitted") that does not reveal which condition failed.
- **SEC-5. Invite allowlist (reconciliation I3).** The board-only `public.invite_allowlist` (columns `email`, `role`, `invited_by`, `expires_at`, `consumed_at`, `notes` — DM) is the authoritative set of permitted emails. The signup hook additionally verifies `NEW.email IN (SELECT email FROM invite_allowlist WHERE consumed_at IS NULL AND (expires_at IS NULL OR expires_at > now()))`. Both domain AND allowlist must pass. The table is board-only for SELECT/INSERT/UPDATE/DELETE.
- **SEC-6. Post-signup member row.** An `AFTER INSERT ON auth.users` `SECURITY DEFINER` trigger creates `public.members` with `role` taken from the matching allowlist row (default `general_member`) and `user_id = NEW.id` (the auth link, A1). The trigger sets `invite_allowlist.consumed_at = now()`.
- **SEC-7. Role never in JWT.** The JWT carries only `auth.uid()`; role is resolved via `current_member_role()` (SEC-10) so a demotion takes effect immediately.
- **SEC-8. Candidates are not auth users.** Applicants are rows in `public.candidates`, not `auth.users`; they hold no JWT and cannot authenticate into any internal surface.
- **SEC-9. MFA + middleware.** Board accounts SHOULD enroll Supabase TOTP MFA before Fall 2026 (MUST for v2). Next.js middleware on `/internal/*` checks the session and AAL, redirecting board users without AAL2 to enrollment.

### 11.3 Security-definer helper functions (reconciliation A2 — supersedes any `id = auth.uid()` resolver)

RLS on a table that must read `members` would recurse against `members`' own RLS. The fix is `SECURITY DEFINER STABLE` helpers (each `SET search_path = public`, owned by a migration/superuser role) that bypass RLS to break recursion. **The previous `get_my_role()` reading `WHERE id = auth.uid()` is WRONG and is replaced by the two helpers below (A2/A3).**

- **SEC-10. `current_member_id()`** → `SELECT id FROM public.members WHERE user_id = auth.uid()` (returns the caller's `members.id`; `NULL` when unauthenticated).
- **SEC-11. `current_member_role()`** → `SELECT role FROM public.members WHERE user_id = auth.uid()`. Convenience wrappers (same attributes): `is_board()` = `current_member_role() = 'board'`; `is_committee_or_above()` = `current_member_role() IN ('board','recruitment_committee')`; `is_member_or_above()` = `current_member_role() IS NOT NULL`. All policies use these, never inline subqueries against `members`.
- **SEC-12. `has_submitted_for(p_candidate_id uuid, p_stage candidate_stage)`** (blind-unlock predicate — reconciliation B) → `SELECT EXISTS (SELECT 1 FROM public.score_submissions ss WHERE ss.candidate_id = p_candidate_id AND ss.stage = p_stage AND ss.evaluator_id = current_member_id())`. **It keys on `score_submissions`, not a `scores.status` column.**
- **SEC-13. `session_is_open(p_session_id uuid)`** → `SELECT visibility = 'open' FROM public.hash_sessions WHERE id = p_session_id` (reconciliation I1 — column `visibility`).
- **SEC-14. `session_is_active(p_session_id uuid)`** → `SELECT is_active FROM public.hash_sessions WHERE id = p_session_id` (I1 — column `is_active`). Used in `votes` INSERT/UPDATE `WITH CHECK`.

### 11.4 RLS policy matrix (SEC-15)

`me` = `current_member_id()`; `board` = `is_board()`; `committee+` = `is_committee_or_above()`; `member+` = `is_member_or_above()`; `submitted(c,s)` = `has_submitted_for(candidate_id, stage)`. `—` = no policy (default deny).

**`invite_allowlist`** — board: SELECT/INSERT/UPDATE/DELETE; all others `—`.

**`members`**

| Op | board | committee | general_member | anon |
|---|---|---|---|---|
| SELECT | all | all | `id = me` OR `is_public` | `—` (public `/team` served via `v_team_public`/service-role) |
| INSERT | board (admin add) | — | post-signup trigger only | — |
| UPDATE | any; `WITH CHECK true` | `id = me`; `WITH CHECK (id = me AND role = OLD.role)` | `id = me`; `WITH CHECK (id = me AND role = OLD.role)` | — |
| DELETE | board | — | — | — |

The `role = OLD.role` check is the critical self-escalation mitigation (SEC-40).

**`candidates`** — board: SELECT all, INSERT (manual add), UPDATE any, DELETE. committee: SELECT all, UPDATE limited stage/status via Server Action. general_member: reads only `v_candidate_roster` (SEC-34). **anon: no policy at all — `/apply` writes are server-mediated (F2), so there is no anon INSERT (replaces the prior "anon `true` INSERT").**

**`application_questions`** — board: all writes + SELECT; committee: SELECT; others `—`.

**`application_responses`** — board: SELECT all (+ correction guarded by append-only trigger); committee: SELECT all (or stage-scoped via `evaluator_assignments`, OQ-9). **No anon INSERT — written by the server Route Handler with the service-role key (F2).** No UPDATE/DELETE (append-only).

**`rubric_versions` / `rubric_criteria`** — board: all writes + SELECT; committee: SELECT (evaluators must read rubric definitions); others `—`.

**`score_submissions`** — committee+: INSERT `WITH CHECK (evaluator_id = me)`; SELECT `USING (evaluator_id = me OR board)`. No UPDATE/DELETE (append-only).

**`scores`** (blind rule enforced here)

| Op | board | committee | others |
|---|---|---|---|
| SELECT | all | `USING (evaluator_id = me OR submitted(candidate_id, stage))` | — |
| INSERT | board | `committee+`; `WITH CHECK (evaluator_id = me)` | — |
| UPDATE | board | `USING (evaluator_id = me)`; permitted only before the stage lock point (D1), enforced by the `BEFORE UPDATE` trigger | — |
| DELETE | — | — | — |

**`notes`** — SELECT `USING (author_id = me OR submitted(candidate_id, stage) OR board)` and `deleted_at IS NULL` for non-board reads; INSERT `committee+` `WITH CHECK (author_id = me)`; UPDATE own pre-lock (board any) — **soft-delete sets `deleted_at` (D2), never a hard DELETE and never a separate "hidden" boolean**; DELETE `—`.

**`reactions`** — same blind rule as scores: SELECT `USING (evaluator_id = me OR submitted(candidate_id, stage) OR board)`; INSERT/UPDATE own pre-lock `WITH CHECK (evaluator_id = me)`; DELETE `—`.

**`coi_flags`** — committee+: INSERT/SELECT (`member_id = me` for own; visible to committee+ as disclosure); UPDATE `is_excluded_from_agg` board-only; DELETE `—`.

**`evaluator_assignments`** — board: all writes; committee+: SELECT (own assignments + roster for metrics); others `—`.

**`stage_transitions`** — committee+ INSERT (board for status changes) `WITH CHECK (actor_id = me)`; SELECT committee+; no UPDATE/DELETE (append-only).

**`hash_sessions`** — board: all writes (open/close, flip `visibility`); committee: `SELECT USING (is_active)` (I1); others `—`.

**`hash_session_participants`** — board: INSERT/DELETE/SELECT; committee: SELECT (own membership / roster); others `—`.

**`votes`** — SELECT `USING (voter_id = me OR session_is_open(session_id) OR board)` (I2); INSERT `committee+` `WITH CHECK (voter_id = me AND session_is_active(session_id) AND EXISTS participant row)`; no UPDATE/DELETE (append-only — a change is a new row, ATS-44). The `vote_counts` view (omits `voter_id`, I2) is the aggregate API surface for anonymous mode.

**`decisions`** (reconciliation E1 — **no UPDATE path**)

| Op | board | committee | others |
|---|---|---|---|
| SELECT | all | all | — |
| INSERT | board | — | — |
| UPDATE | **— (none; append-only)** | — | — |
| DELETE | — | — | — |

The prior board-UPDATE/`OLD.status`/`pending` policy is **removed (E1)**; a reversal is a new `decisions` row (E2), and `deny_mutation` forbids all UPDATE/DELETE including `service_role`.

**`audit_log`** — board: SELECT only. INSERT by `SECURITY DEFINER` triggers / service-role only; no UPDATE/DELETE for any role (append-only).

### 11.5 Blind-until-submitted: data-layer enforcement (SEC-16 – SEC-20)
- **SEC-16.** Enforced at the Postgres RLS layer; a raw authenticated PostgREST query is filtered identically to the UI. There is no application flag a caller can omit to gain visibility.
- **SEC-17.** `has_submitted_for()` (SEC-12) is the single authoritative gate, keyed on a `score_submissions` row for the caller (resolved via `current_member_id()`). A draft (no submission row) does not unlock.
- **SEC-18.** Submission is one atomic action that writes scores (+ optional reaction) and the `score_submissions` row; it cannot be undone by the evaluator. Editing scores before the stage lock point (D1) does not delete the submission row (B3); board re-opening is audited.
- **SEC-19.** `scores`/`reactions`/`notes` INSERT `WITH CHECK (evaluator_id|author_id = current_member_id())` prevents attribution spoofing.
- **SEC-20.** Notes and reactions use the identical `has_submitted_for()` gate.

### 11.6 The one public write path: `/apply` (SEC-21 – SEC-27 — reconciliation F2, L)
- **SEC-21.** The only public write is the server-mediated `/apply` Route Handler. **Anon holds no DB or Storage grant**; the handler performs all writes with the service-role key. No table allows anon INSERT/UPDATE/DELETE/SELECT.
- **SEC-22.** The handler validates the full payload against a Zod schema before any Supabase call; invalid payloads are rejected whole (no partial rows).
- **SEC-23. Turnstile (mandatory, L1).** The form embeds Cloudflare Turnstile (accessible audio/visual). The handler verifies `cf-turnstile-response` server-side before proceeding; missing/invalid token aborts before any DB call.
- **SEC-24. Rate limit (mandatory, L2 — no Upstash).** 5 submissions / IP / 24h enforced via the Postgres `apply_rate_limit` counter (DM-M8) checked/incremented in the same server transaction; over-limit returns HTTP 429 with `Retry-After`. Vercel firewall rules may supplement. (The prior Upstash Redis dependency is removed.)
- **SEC-25. Enumeration prevention (per-cycle uniqueness, C1).** `candidates` is UNIQUE `(cycle_id, lower(email))`. A duplicate within the same cycle yields a conflict the handler catches, returning the same generic confirmation as a first submission. A different cycle creates a new row (C2). There is no global unique on email (re-applicants supported).
- **SEC-26. No anon SELECT.** Anon cannot read `candidates`; post-submission confirmation is the handler's return value, not a DB read.
- **SEC-27. Resume upload (F1/F3).** The browser POSTs the file as multipart to the handler, which: validates Turnstile + rate limit; validates MIME **`application/pdf` only**; validates size **≤10 MB**; generates `resumes/{candidate_id}/{uuid}.pdf`; uploads to the **private** `resumes` bucket with the service-role client; stores the path in `candidates.resume_storage_path`. The browser never receives a Storage credential or pre-signed URL; there is no direct browser-to-Storage path.

### 11.7 Storage bucket policies (SEC-28 – SEC-33)
- **SEC-28. `resumes` bucket** — **private**; anon read/write denied; board/committee read via server-generated **signed URL, 1-hour TTL**; general_member denied; no member write; `list` board-only. Paths `resumes/{candidate_id}/{uuid}.pdf` are unguessable (server-generated UUID).
- **SEC-29. `member-photos` bucket** — private; served via a Route Handler that mints signed URLs server-side; member uploads own photo only (`member-photos/{me}/{uuid}.*`, `image/jpeg|png|webp`, ≤5 MB); board uploads any; `/team` uses signed URLs (24h TTL) for `is_public` photos.
- **SEC-30. `candidate-photos`** (future) — private; board/committee read via 1-hour signed URLs; all else denied; no anon write (not collected in v1).
- **SEC-31.** All buckets set `allowedMimeTypes` + `fileSizeLimit` in the Supabase dashboard as a second-order guard.
- **SEC-32.** All signed-URL generation runs in Route Handlers/Server Actions holding `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_*`, never in a client bundle).
- **SEC-33.** `list` is board-only; a committee member with a signed URL for one resume cannot enumerate other paths.

### 11.8 General-member surface (SEC-34 — reconciliation J)
General members never read the `candidates` base table (default deny). Their only surface is the view **`v_candidate_roster`** exposing ONLY `display_code` (C01), `full_name`, `year`, `major`, and a coarse status label (`Applied | In process | Closed`), **gated to cycles where `recruitment_cycles.is_open_rush = true` (J2)**. There is no `pronouns` column anywhere in the schema, and `candidate_status` has no `open_rush` value (open-rush is a cycle property, not a candidate status). The migration must `REVOKE SELECT ON public.candidates FROM authenticated` before re-adding role-specific policies so the view restriction cannot be bypassed. Derived fields (composite/normalized/controversy) are never base columns and are never exposed to members (I4).

### 11.9 Threat model (SEC-35 – SEC-40)
- **SEC-35. Candidate reads own evaluations** — candidates hold no JWT (`auth.uid()` NULL); all evaluation tables deny anon SELECT. Even if they later create a `@umich.edu` `general_member` account, those tables have no general-member SELECT policy; `v_candidate_roster` exposes no evaluation columns.
- **SEC-36. Committee peeks before submitting** — `has_submitted_for()` returns FALSE, so the SELECT policy reduces to `evaluator_id = me`; peer rows are filtered by Postgres on any access path (UI, PostgREST, RPC).
- **SEC-37. General member reads evaluation data** — no SELECT policy on `scores`/`notes`/`reactions`/`votes`/`hash_sessions`/`decisions`/`candidates` for general_member; zero rows everywhere; roster only via `v_candidate_roster`.
- **SEC-38. Anon enumerates candidates/resumes** — no anon SELECT (empty array, not 403); Turnstile + 5/IP/24h rate limit + generic duplicate message block scraping; private `resumes` bucket with no anon policy and no `list`.
- **SEC-39. Committee reads peer vote in anonymous hash** — `session_is_open()` FALSE → `votes` SELECT reduces to `voter_id = me`; `vote_counts` exposes counts without `voter_id`; opening a session is a deliberate, audited board action.
- **SEC-40. Self-escalation** — `members` UPDATE `WITH CHECK (role = OLD.role)` for non-board rejects role changes; role-update Server Actions gate on `is_board()`; the service-role key is server-only.

## 12. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | Two route groups: `app/(external)` (public, art-directed) and `app/(internal)` (gated). Server Components by default; `"use client"` only where interactivity is required. |
| Hosting | **Vercel** | Native Next.js host; Speed Insights enabled (NFR-25). |
| Backend | **Supabase** — Postgres + Auth + RLS + Storage | RLS is the access-control backbone (§11). Pro plan before the first live cycle for PITR (NFR-26). |
| Styling | **Tailwind CSS** wired to design tokens (DS-60/DS-61) | No CSS-in-JS runtime; tokens are the single source of truth. |
| Fonts | **`next/font`** — google for OFL faces, local for Archivo Expanded Black (DS-6, H2) | Display face declared in `app/(external)/layout.tsx` only. |
| Motion | **Lenis + GSAP/ScrollTrigger + custom cursor + type preloader** (external only) | `next/dynamic`/`useEffect`-deferred; code-split off the internal bundle (NFR-20/NFR-22). **No WebGL.** |
| Validation | **Zod** | Shared client/server schemas for `/apply` and internal forms (EX-51, SEC-22). |
| Anti-abuse | **Cloudflare Turnstile** + Postgres-backed rate limit (`apply_rate_limit`) | No Upstash dependency (L2). |
| CI | **GitHub Actions** | Lint, typecheck, Lighthouse CI, axe-core, RLS policy test harness; gates merges/deploys. |
| Error tracking | **Sentry** (free tier) or Vercel native | `Sentry.captureException` in error boundaries (NFR-25). |

The service-role key lives only in Vercel server env (`SUPABASE_SERVICE_ROLE_KEY`); only the publishable/anon key may reach the client, and it grants nothing because anon writes are server-mediated (SEC-3, EX-73).

---

## 13. Non-functional requirements (accessibility, performance, reliability)

### 13.1 Accessibility

- **NFR-1 — Conformance.** The external zone conforms to **WCAG 2.1 AA in full**, plus four WCAG 2.2 criteria achievable at negligible cost: 2.4.11 Focus Appearance (Min), 2.5.8 Target Size (Min), 3.3.7 Redundant Entry (`/apply` if multi-step), 3.3.8 Accessible Authentication (Min). The internal tool meets the same baseline plus the keyboard/live-region requirements (NFR-6–NFR-15). axe-core (`@axe-core/playwright`) runs on every UI PR and must report zero WCAG 2.1 AA violations before merge.
- **NFR-2 — Contrast budget (canonical contrast matrix; supports DS-49/G2).** Relative luminance: Ink 0.003 · Paper 0.856 · Maize 0.640 · Blue 0.020.

| Foreground | Background | Ratio | Normal ≥4.5 | Large/UI ≥3 | Ruling |
|---|---|---|:---:|:---:|---|
| Ink | Paper | 17.1:1 | PASS | PASS | Default body pair |
| Paper | Ink | 17.1:1 | PASS | PASS | Inverted sections |
| Ink | Maize | 13.0:1 | PASS | PASS | Ink text on maize fills |
| Maize | Ink | 13.0:1 | PASS | PASS | Maize on dark |
| Paper | Blue | 13.0:1 | PASS | PASS | Paper on optional blue headers |
| Maize | Blue | 9.9:1 | PASS | PASS | Maize accent on blue |
| Blue | Paper | 13.0:1 | PASS | PASS | Blue on paper |
| **Maize** | **Paper** | **1.31:1** | **FAIL** | **FAIL** | **PROHIBITED** |
| **Ink** | **Blue** | **1.32:1** | **FAIL** | **FAIL** | **PROHIBITED** |

Practical rule: **maize pairs only with ink or blue, never with paper** (DS-49).
- **NFR-3 — Maize restrictions.** Maize is non-compliant as foreground text or a UI boundary against paper-family surfaces (luminance > 0.30). Permitted: decorative fills where no text legibility depends on maize; active/hover fills on **ink** sections (ink text → 13.0:1); annotation marker dots/underlines/brackets as graphical elements beside ink text; **focus-ring color only on dark backgrounds** (maize-on-paper 1.31:1 fails 2.4.11/1.4.11 — the default ring is ink, DS-47a/G1).
- **NFR-4 — Focus appearance (reconciliation G1).** Every interactive element shows a ring that (1) encloses the full bounding box, (2) changes ≥3:1 from unfocused, (3) achieves ≥3:1 against adjacent backgrounds. **Standard implementation: `2px solid Ink` with 2px offset on paper sections (17.1:1); `2px solid Paper` on ink sections; `2px solid Paper` on blue sections. Maize rings are permitted only on dark (ink/blue) sections (DS-47a).** `outline: none` is prohibited unless replaced by a compliant indicator. Targets meet ≥24×24 CSS px (2.5.8); compact markers use `min-width/height: 44px` padding.
- **NFR-5 — Skip link (external).** "Skip to main content" is the first focusable element on every external page (visible on focus; ink-on-paper), pointing to `#main-content`.
- **NFR-6 — Focus order & modal trapping (internal).** Document-order focus; never on hidden elements; every modal (score entry, COI dialog, hash start/close) traps focus, returns focus on `Esc`/close via a `useFocusTrap` hook.
- **NFR-7 — Skip links (internal).** "Skip to candidate list" on list views; "Skip to scoring form" on detail views.
- **NFR-8 — Roving tabindex: hash queue.** `role="listbox"` with one row at `tabindex="0"`; Arrow Up/Down move, Home/End jump, Enter/Space opens the card, `Esc` returns focus; each `role="option"` row's accessible name includes name + sort metric ("Candidate C14, controversy score 0.82").
- **NFR-9 — Roving tabindex: score grids.** `role="grid"`; arrow keys navigate cells; the editable own-score cell is a native `<input type="number" min="1" max="5">` (integer, K1) with an associated `<label>` (or `role="slider"` with `aria-valuemin/max/now/text`).
- **NFR-10 — Annotation semantics.** Meaningful markers (`E01`, gallery `[01]`, candidate `C07`, footnote refs) carry computed names and are not `aria-hidden`; decorative chrome brackets (`[`/`]` around `Menu`/`Close`) are `aria-hidden="true"` with plain-text labels so SRs announce "Menu, button". The persistent meta line lives in `<footer role="contentinfo">`.
- **NFR-11 — Decorative elements.** Decorative images `alt=""` (prefer CSS `background-image`); the custom cursor node is `aria-hidden="true"` and non-focusable; the preloader overlay carries `role="status"` `aria-label="Loading MECG"` while visible and is removed from the DOM on dismiss (and is **skipped entirely under reduced motion**, H3); Lenis container never uses `role="application"`.
- **NFR-12 — Reduced-motion (defers to the canonical map DS-38/DS-39).** A single `motionAllowed` boolean (from `matchMedia('(prefers-reduced-motion: reduce)')`, observed on `change`) gates all GSAP timeline creation — timelines are **not instantiated** (not merely paused) when false. The global CSS reduced-motion baseline (`animation/transition-duration: 0.01ms !important; scroll-behavior: auto`) is present in addition to the JS gating. **The preloader is skipped entirely (not "shown 150ms") (H3).**
- **NFR-13 — `/apply` form a11y.** Visible `<label>` per input (`for`/`id`); required fields `aria-required="true"` + visible `*`; **resume input is `<input type="file" accept="application/pdf">` (PDF-only, F1)** with a visible label and drag-drop only as progressive enhancement; inline errors via `aria-describedby` with `role="alert"`; on validation failure focus moves to a `role="alert"` summary listing invalid fields as links; on success a `role="status"`/`aria-live="polite"` region announces **"Application submitted."** (the email-confirmation line appears only if that feature is enabled, O1/EX-65); Turnstile provides an audio/text alternative (3.3.8); 3.3.7 pre-populates earlier values if the form is multi-step.
- **NFR-14 — Internal scoring/voting forms.** Each criterion in a `<fieldset>`/`<legend>`; **1–5 discrete integer scores as radios** ("1 — Poor" … "5 — Exceptional") or a labeled slider; conviction reactions are four radios in a `<fieldset><legend>Overall conviction</legend>`; **blind-until-submitted means peer scores are absent from the DOM (not CSS-hidden, not comments) until the evaluator submits**; submission/COI confirmations via live regions.
- **NFR-15 — Live regions.** Present at load (rendered empty): vote cast (`polite` "Votes: n of quorum"), quorum reached (`polite`), decision (`assertive`), card updates (`polite` `aria-atomic="false"`), score submission (`status`/`polite`), validation errors (`assertive`), and **session opened/closed and the visibility-flip-to-open notification (`polite`)** — wiring the O4 banner + announcement for ATS-45.

### 13.2 Performance

- **NFR-16 — Lighthouse budgets (CI-gated).** External ≥85 mobile / ≥95 desktop; internal ≥80 mobile / ≥90 desktop (auth overhead + density allowance). Accessibility Lighthouse ≥90 all routes (secondary; axe-core is authoritative).
- **NFR-17 — Core Web Vitals.** LCP <2.5s external / <3.0s internal; CLS <0.05 both; INP <200ms both; TBT <200ms external / <300ms internal. The size-adjusted font fallback (NFR-18) protects the strict CLS budget given the large display type.
- **NFR-18 — Font loading (canonical contract is DS-6/H2).** Faces load via `next/font` — **google for the OFL faces, local for Archivo Expanded Black (self-hosting permitted, H2)**. Weights = the union actually used: **Space Grotesk 400/500/700, Space Mono 400/700, Archivo display 900, Archivo headings 600/700** (H1). `display: 'swap'`; `subsets: ['latin']`; the display face preloaded automatically by `next/font` (no manual preload tags). Display fonts declared in `app/(external)/layout.tsx` only.
- **NFR-19 — Images.** All public raster `<img>` → `next/image` (WebP/AVIF, responsive `srcSet`, intrinsic dimensions); LCP hero `priority`; gallery/portraits lazy; Trek lightbox uses an LQIP placeholder (static, not animated); Supabase Storage domain added to `images.remotePatterns`; source caps hero ≤2400px, gallery ≤1600px, portraits ≤800px; meaningful SVGs carry `<title>`/`alt`, decorative `aria-hidden`.
- **NFR-20 — Code-split public vs internal.** Motion libs (Lenis, GSAP, ScrollTrigger, cursor) are never imported at module level in `app/(internal)`. A `MotionProvider` in `app/(external)` dynamically imports them in `useEffect`; the cursor loads via `next/dynamic(..., { ssr: false })`. A post-build check confirms `"gsap"`/`"lenis"`/`"ScrollTrigger"` appear in no internal chunk.
- **NFR-21 — Rendering strategy.** `/` `/placement` `/team` = ISR (`revalidate 3600`); `/trek` `/recruitment` `/services` `/about` `/contact` = SSG; `/apply` = dynamic (`force-dynamic`, never cached); `/internal/*` = dynamic (`force-dynamic`, `no-store`, never CDN-cached — verified post-deploy).
- **NFR-22 — Motion bundle cost.** ~65 KB (Lenis ~10 + GSAP core+ScrollTrigger ~55) must not load on the internal critical path and is deferred for external until after LCP. Import only used GSAP modules (never `gsap/all`). External first-load critical JS ≤250 KB gzipped (verified via Coverage on cold cache).

### 13.3 Reliability & observability

- **NFR-23 — Append-only / soft-delete matrix (canonical; aligned to DM-3/DM-4).**

| Table | Permitted | Prohibited | Enforcement |
|---|---|---|---|
| `audit_log` | INSERT (triggers/service-role) | UPDATE, DELETE | `deny_mutation` + board-only SELECT |
| `votes` | INSERT while session active | UPDATE, DELETE (change = new row) | `deny_mutation`; INSERT `WITH CHECK session_is_active` |
| `decisions` | INSERT (board) | UPDATE, DELETE (reversal = new row) | `deny_mutation`; **no UPDATE policy (E1)** |
| `score_submissions`, `stage_transitions`, `application_responses` | INSERT | UPDATE, DELETE | `deny_mutation` |
| `scores` / `reactions` | INSERT; UPDATE by owner **until stage lock point (D1)** | DELETE; UPDATE after lock | `BEFORE UPDATE` lock trigger keyed on stage hash finalization |
| `notes` | INSERT; UPDATE by author pre-lock | hard DELETE | **soft-delete via `deleted_at` (D2)**; filter `deleted_at IS NULL` |

(The prior "15-minute notes window" and "hidden boolean" are removed; one lock model and one `deleted_at` apply — D1/D2.)
- **NFR-24 — No silent failures.** All Supabase calls use `{ data, error }`; non-null `error` is logged (`console.error`) and returns a structured 4xx/5xx. React Error Boundaries wrap internal pages with a reference code + retry. The `/apply` handler explicitly handles the upload-fail-after-insert partial state (retry ≤2, else delete the orphan candidate row and return failure — never a 200 with incomplete data). RLS rejections are distinguished from empty result sets and logged.
- **NFR-25 — Logging/monitoring.** Vercel log drain + `console.error` for errors; Sentry (or Vercel native) for client errors; Vercel Speed Insights for field CWV. Mandatory structured events: application submitted, score submitted, hash session opened/closed, decision recorded, RLS violation (each with the documented fields).
- **NFR-26 — Backup & recovery.** Supabase **Pro** before the first cycle; **PITR ≥7 days** during recruitment windows; a named board tech lead runs a verified test restore in a non-production project ≥2 weeks before the cycle, documented in the repo. Storage (resumes) is exported as a local archive at cycle end (not covered by PITR). Recovery priority: Critical (`candidates`, `scores`, `notes`, `reactions`, `votes`, `decisions`, `audit_log`) = PITR, zero loss; Important (`members`, `application_responses`, `rubric_criteria`, `hash_sessions`) = daily backup; Recoverable (portraits, placement assets) = re-uploadable; Resumes = manual export.
- **NFR-27 — Resume/PII retention (reconciliation O5).** Resumes and candidate PII are retained through the cycle **+ 12 months**, then purged by a scheduled job (the board may export before purge). This is a data-minimization requirement (see RISK-8, OQ-14).

---

## 14. Content requirements (dependency on MECG)

The platform can be code-complete and still **fail to launch** without this MECG-owned content. Items marked **BLOCKER** must be delivered before the dependent phase exits; target delivery is **≤4 weeks before the cycle opens**. Missing a blocker converts the dependent phase to "launch-with-placeholder," a MET-10 failure escalated to the owner.

| ID | Content item | Spec / format | Blocks | Status |
|---|---|---|---|---|
| **CON-1** | Member & Trek photography | Monochrome-ready, ≥2000px long edge, consistent portrait crop (e.g. 4:5), neutral backgrounds, owned/licensed | PH-1 (Team), PH-2 (Trek, Placement highlights) | BLOCKER for PH-2; required for PH-1 Team |
| **CON-2** | Placement data + logo permissions | Companies (company/role/member/term); written permission/fair-use per logo; logo files (SVG preferred) | PH-2 logo wall (highest-value page); PH-1 Services | BLOCKER for PH-2 — OQ-2 |
| **CON-3** | Real impact stats | Actual numbers (members, projects, majors, placements, alumni) + source/owner + refresh plan so they never revert to `0` | PH-1 Home; MET-10 | BLOCKER for PH-1 Home (fixes broken zeros) |
| **CON-4** | Sharper copy | President's welcome with named clients/outcomes; mission/pillars; sanitized service outcomes; FAQ; meta/footer text | PH-1 (Home, About, Services, Recruitment) | BLOCKER for PH-1 credibility |
| **CON-5** | Real rubric criteria + weights | The actual Speed Dating / Group Case / Interview sheets: criteria, scales, **weights**, min evaluators per stage, reaction conventions | PH-3 rubric config (Appendix A is dev-only) | BLOCKER for PH-3 — OQ-3 |
| **CON-6** | Recruitment timeline + calendar links | Confirmed Fall 2026 stage dates (E01–E0n), RSVP links, application open/close | PH-1 Recruitment; PH-3 `/apply` window | BLOCKER for PH-1 Recruitment and the cycle window |
| **CON-7** | Brand/logo assets + usage constraints | MECG logo files; U-M / CoE brand-usage + color rules (esp. maize/blue); favicon/OG image | PH-0 tokens/branding; PH-1 all pages | BLOCKER for final branding — OQ-1 |
| **CON-8** | Internal user roster + allowlist | Email allowlist of board + committee with role; general members to grant profile access | PH-0 auth gating; PH-3 roles | BLOCKER for PH-0 auth go-live |

## 15. Phased delivery

Six phases (0–5). Today is 2026-06-08; the cycle deadline is the start of Fall 2026 recruitment (assume early September 2026) — roughly one summer.

**Critical path (deadline-driving):** **PH-0 → PH-3 → PH-4**, plus the `/apply` intake (built in PH-3) and the `/recruitment` page (in PH-1). Everything an applicant touches to *apply* and everything the committee touches to *evaluate and decide* is on the critical path. The art-directed showcase pages (Placement, Trek) and final motion polish are **off** it.

| ID | Phase | Key deliverables | Exit criteria | Depends on | Gates Fall 2026? |
|---|---|---|---|---|---|
| **PH-0** | Foundations | Next.js+TS repo; Vercel project; Supabase (Postgres/Auth/RLS/Storage); design tokens + Tailwind; font loading (DS-6); CI (lint, typecheck, Lighthouse-CI, axe, **RLS test harness**); base migrations for all §10 tables incl. new tables (M1–M8); `@umich.edu`/allowlist gating; seed + reset scripts | Deploys to Vercel; allowlisted board user logs in; **default-deny RLS verified by automated test**; seed populates a demo dataset | None | **YES — blocks everything** |
| **PH-1** | External core | Home (real stats, no zeros), About/Pillars, Services, **Recruitment/Join (E01–E0n + CTA to /apply)**, Team (`is_public`), Contact; IA + nav; responsive 320px+; OG/Twitter; ISR | All pages render real content (CON-*); timeline accurate; MET-8/MET-9 pass | PH-0; CON-1..CON-6 | **PARTIAL — `/recruitment` gates applicant acquisition; rest strongly desired for credibility** |
| **PH-2** | Showcase pages | Placement (logo wall + highlights from member profiles + `placement_features` curation); Trek indexed gallery + lightbox | Placement renders real placements + permitted logos; Trek complete | PH-1; member data; CON-1/CON-2 | **NO — high-value but not deadline-critical** |
| **PH-3** | Internal ATS core | `/apply` server-mediated intake → `candidates` + resume (only public write path); candidate profile; configurable weighted rubrics; **blind-until-submitted (UI + RLS via `score_submissions`)**; reactions; stage-tagged notes; general-member roster view; role/permission enforcement; evaluator assignments | Candidate applies end-to-end; committee scores Speed Dating/Group Case/Interview; blind passes RLS/API tests; general member sees roster but **no** scores/notes/reactions/hash | PH-0; **CON-5 (real rubrics)** | **YES — core deadline driver** |
| **PH-4** | Hash + fairness | Score normalization (sample-stddev z alongside raw); COI flag/exclude; controversy; **Hash live deliberation** (controversy-first queue; Advance/Cut/Discuss; anonymous-by-default + per-session open toggle + flip notification; quorum from `hash_session_participants`); immutable decision log; append-only audit | A full hash session runs end-to-end on seed data; votes/decisions append-only and attributed (board-only); anonymity toggle verified per session | PH-3 | **YES — needed for the decision stage** |
| **PH-5** | Polish | Lenis, GSAP reveals, custom cursor, type preloader (external only); reduced-motion paths; perf/a11y hardening; copy/QA | MET-8/MET-9 met; reduced-motion verified; no WebGL | PH-1/PH-2 | **NO — can ship after the cycle** |

**Launch blockers:** PH-0 (all), PH-3 (all, incl. `/apply` + real rubrics CON-5), PH-4 (all), PH-1 `/recruitment`, and content blockers CON-3 + CON-5. **Nice-to-have (can slip):** PH-2, PH-5 motion, PH-1 Services/Contact refinement. **Cut order under schedule compression:** PH-5 → PH-2 → non-recruitment PH-1. The recruitment funnel and ATS are never cut.

---

## 16. Risks & mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **RISK-1** | Art-direction credibility looks amateur | Med | High | Lock the AIM-inspired type/annotation system in PH-0; ship PH-1 real content before motion; owner design review before PH-5; "tasteful 80%," no WebGL |
| **RISK-2** | Motion unmaintainable by future boards | Med | Med | Isolate motion in a small documented component set; reduced-motion fallbacks; PH-5 is cuttable; document every effect |
| **RISK-3** | Weak content — placeholder zeros / generic copy ship | Med | High | Hard launch checklist (MET-10) gating CON-3/CON-4; EX-21 build guard; no-placeholder rule at go-live |
| **RISK-4** | Data leakage to candidates/unauthorized members | Med | **Critical** | See RISK-8; default-deny RLS; blind enforced in RLS not just UI; automated RLS test suite in CI |
| **RISK-5** | Evaluator adoption — committee reverts to Google Docs | Med | High | Build for scanning speed (no internal motion); pilot with real evaluators in PH-3; chair mandates in-app scoring; MET-2 per stage |
| **RISK-6** | Volunteer turnover / handoff loss | High | Med | Seed scripts, README runbook, onboarding dry-run (MET-11); see RISK-10 |
| **RISK-7** | Sync fragility (member→placement / candidate→profile derivations) | Med | Med | Derive composite/normalized/controversy in views with tests; manual curation override on Placement; seed covers edge cases |
| **RISK-8** | **RLS misconfiguration leaking PII** | Med | **Critical** | Default-deny every table; security-definer helpers (`current_member_id`/`current_member_role`); **automated RLS test suite per table/role in CI (blocks deploy)**; private buckets + signed URLs; pre-launch pen spot-check; MET-6 = 0 |
| **RISK-9** | Font licensing (Archivo Expanded / Bricolage / Space Grotesk / Space Mono) | Low | Med | Confirm each web license before PH-1; prefer self-hosted OFL; record in Appendix B; tie to CON-7 |
| **RISK-10** | Single-maintainer bus factor | High | High | Document in README/MEMORY.md; seed/reset scripts; recruit a second contributor before the cycle; onboarding dry-run (MET-11) is a launch criterion |
| **RISK-11** | Supabase tier limits (Storage, DB size, pause, connections) during the surge | Med | High | Estimate resume volume × size; Storage quotas/cleanup (NFR-27); paid-tier upgrade trigger before applications open; load-test `/apply` (MET-7) |
| **RISK-12** | Scope creep into PH-3/4 before external ships; art-direction creep delaying the ATS | High | High | Enforce phase gating; PH-2/PH-5 cannot start until PH-3/PH-4 hit exit; owner sign-off to reorder; documented cut order |
| **RISK-13** | Content arrives late (esp. CON-3, CON-5, CON-2) | High | High | Issue intake template at PH-0; weekly content status with owner; Appendix A is dev-only; escalate slipped blockers immediately |

---

## 17. Open questions / decisions log

Per the locked decisions, most prior questions are resolved. Remaining items are grouped as **genuinely open** (need a human decision), **deferred** (a v1 scope choice the board should ratify), and **resolved**.

### Genuinely open (need a human decision)

| ID | Question | Why open | Needed by |
|---|---|---|---|
| **OQ-1** | Brand/logo constraints — MECG / CoE / U-M logo-usage and color rules (esp. maize `#FFCB05`, blue `#00274C`)? | Depends on official U-M/CoE brand guidelines; affects token finalization + footer/branding | Before PH-1 final branding (CON-7) |
| **OQ-2** | Client-logo permission — do we have rights to display each client/employer logo on Placement and Services? | Per-company legal/relationship call | Before PH-2 logo wall (CON-2) |
| **OQ-3** | Real rubric criteria, scales, weights, min-evaluator counts per stage | Lives in MECG's scoring Google Docs; Appendix A is a placeholder | Before PH-3 exit (CON-5) |

### Deferred (v1 scope choices; ratify before the cycle)

| ID | Item | v1 position | Note |
|---|---|---|---|
| **OQ-7** | Re-applicant identity-match rule + whether prior-cycle outcomes may be revealed | New cycle-scoped row; board-only neutral badge; viewing prior scores is a logged board action (ATS-55/C2) | Confirm email-exact vs fuzzy match |
| **OQ-8** | MFA as a hard prerequisite for board accounts | SHOULD for v1, MUST for v2 (SEC-9) | Confirm whether Fall 2026 requires AAL2-blocking middleware |
| **OQ-9** | Stage-scoped committee access to `application_responses`/scores | Committee SELECT-all in v1; `evaluator_assignments` (M2) supports stage-scoping if required | Confirm whether to add the predicate |
| **OQ-10** | Hash quorum definition + default | `hash_sessions.quorum_threshold`, board-set; `hash_session_participants` enables fraction-of-eligible (ATS-46) | Confirm absolute vs fraction + numeric default |
| **OQ-11** | Applicant confirmation email | **Not asserted in success copy unless enabled** (O1); success copy = "Application submitted." External send is a hard-stop owner decision | Decide provider + approval before enabling |
| **OQ-12** | Applicant self-withdrawal | No authenticated applicant path in v1; withdrawal = email → board sets `withdrawn` (O2/ATS-36) | Self-service deferred to a future scoped public action |
| **OQ-13** | Resume antivirus/malware scanning | Out of v1 scope; type/size limits + private-bucket isolation (EX-58) | Confirm acceptable for v1 |
| **OQ-14** | Resume/PII retention lifecycle | Retain cycle + 12 months, then scheduled purge; board export before purge (NFR-27/O5) | Confirm window + export workflow owner |
| **OQ-15** | Hash tie-resolution default | No auto-decide; default convert to "Discuss more" + re-vote, or logged board override (ATS-47) | Confirm default |
| **OQ-16** | Coarse member-visible status labels | Default `Applied / In process / Closed` (J1) | Confirm the set |

### Resolved (per locked decisions)

| ID | Question | Resolution |
|---|---|---|
| **OQ-4** | General-member visibility of candidates | Members CAN view the open-rush roster (names/basic info only) via `v_candidate_roster`; NEVER scores, notes, reactions, or hash (J1/J2) |
| **OQ-5** | Hash vote visibility | Anonymous by default; board may flip a session to open per-session (ATS-45) |
| **OQ-6** | Application intake mechanism | Native form → `candidates` + `application_responses`; resume to private Storage; server-mediated; the only public write path (F2) |
| **OQ-17** | Stack / hosting / backend | Next.js App Router + TS on Vercel; Supabase (Postgres/Auth/RLS/Storage); Tailwind; Lenis/GSAP; no WebGL |
| **OQ-18** | Color system | Monochrome (ink `#0A0A0A` / paper `#F2EEE4`) + maize `#FFCB05` accent only; blue `#00274C` reserved for sparing internal use |
| **OQ-19** | Deliverable of this effort | A finalized PRD document only (no code in this engagement) |

## 18. Goal traceability matrix

Goals G1–G6 are verbatim from §3.1. Each maps to the requirement IDs that satisfy it; the final column flags any genuine gap. (This corrects the critic's inferred goals against the real G1–G6, per reconciliation N1.)

| Goal | Satisfied by | Coverage |
|---|---|---|
| **G1.** Distinctive, type-forward, art-directed public site signaling precision/competence | DS-1–DS-61 (full design system); EX-1–EX-18 (shell, kinetic type, annotation chrome), EX-19–EX-23 (zero-proofed impact stats — directly fixes the broken `0` counters), EX-44 (single-source pillars), EX-67–EX-74 (perf/a11y/empty-state polish); NFR-2–NFR-4 (contrast/focus), NFR-16–NFR-22 (perf); MET-8, MET-10; PH-1, PH-5; CON-1, CON-3, CON-4, CON-7 | **Covered.** Design↔a11y conflicts (focus ring, font weights/loading, preloader) are reconciled (G1/H, Appendix C). |
| **G2.** Recruiting weapon: placement page showing where members work | EX-24–EX-34 (derivation + curation + empty states + logo fallback), EX-32 (teaser parity); DM-M4 `placement_features`, DM-M5 `placement_consent`, DM-30 `v_placement_public`; ATS-38–ATS-39 (member profile feeds placement); MET-10; PH-2; CON-2 | **Covered.** Curation/consent schema gaps closed (M4/M5). |
| **G3.** Replace Google Docs with a structured ATS (profiles, scoring, notes, reactions, voting, hash) | ATS-5–ATS-9 (versioned weighted rubrics), ATS-16–ATS-20 (reactions/notes), ATS-32–ATS-37 (profile/aggregation/controversy), ATS-41–ATS-49 (hash, votes, decisions, quorum, audit); DM (scores/notes/reactions/`score_submissions`/votes/decisions/rubric_versions/`evaluator_assignments`/`hash_session_participants`/`stage_transitions`), DM-25–DM-28 (derived views); SEC-15 matrix; MET-1, MET-5; PH-3, PH-4; CON-5 | **Covered.** Evaluator-assignment + hash-participant gaps closed (M2/M3). |
| **G4.** Strict RBAC — evaluation data never exposed to candidates/unauthorized members | ATS-1–ATS-4 (default-deny, roster-only members), ATS-57 (board-only audit); SEC-1–SEC-40 (full RLS model, helpers, threat model), SEC-34 `v_candidate_roster` (J), SEC-21–SEC-33 (server-mediated intake + Storage privacy); EX-6, EX-59–EX-64, EX-73; DM-3/DM-4 (append-only/soft-delete), DM-29 (blind enforcement), DM-31 (RLS indexes); MET-6; PH-0 (RLS test harness), PH-3 | **Covered.** Auth-join (A) and blind-mechanism (B) contradictions resolved; the candidate_list/`open_rush` phantom-column issue fixed (J/I4). |
| **G5.** Reduce bias / improve fairness (blind-until-submitted, normalization, COI, anonymous hash) | ATS-10–ATS-15 (blind), ATS-21–ATS-25 (sample-stddev normalization), ATS-26–ATS-31 (COI), ATS-37 (controversy), ATS-45 (anonymous hash + flip notification); DM-26/DM-27 (`STDDEV_SAMP`), DM-29 (single canonical blind mechanism); SEC-12, SEC-16–SEC-20, SEC-39; NFR-14 (blind in DOM); MET-4; PH-4 | **Covered.** Blind mechanism unified to `score_submissions` (B); stddev unified to sample/n−1 (K2); 15-min vs lock-point resolved to one lock model (D). |
| **G6.** Maintainable by a rotating volunteer board | DS-36/DS-51 (lint-enforced tokens/components), DS-52–DS-58 (strict internal inheritance); NFR-18/NFR-20/NFR-22 (font/code-split discipline), NFR-23–NFR-27 (append-only/error/logging/backup/retention); PH-0 (seed/reset/runbook, CI), MET-11; RISK-2, RISK-6, RISK-10 | **Covered at the ops level.** The README/onboarding artifact itself has no dedicated requirement ID beyond MET-11's measurement — recommend authoring it as a PH-0 deliverable (already listed). |

**Cross-goal note:** the single biggest pre-reconciliation traceability hole the critic flagged — no evaluator-assignment model behind MET-2/MET-3 — is now closed by `evaluator_assignments` (DM-M2). No goal is left genuinely uncovered.

---

## Appendix A — Placeholder rubric defaults

> **Dev-only placeholders.** Not launch-acceptable; the real criteria/scales/weights come from CON-5 (OQ-3). All scales are **integer 1–5** (K1).

- **Speed Dating:** Communication · Energy/presence · Genuine interest.
- **Group Case:** Structure/problem-solving · Contribution · Teamwork · Presence/communication (weighted).
- **Interview:** Analytical/casing · Communication · Motivation/fit · Culture (weighted).

Defaults pending CON-5: `MIN_N_FOR_NORM = 3`, `MIN_EVALUATORS_PER_STAGE = 2` (MET-3 targets ≥3 distinct evaluators for completeness), conviction scale fixed at Strong Yes/Yes/No/Strong No (ATS-16).

---

## Appendix B — Asset / font references

**Typography (loaded weights = union actually used, H1; loaded via `next/font`, H2):**

| Role | Typeface | Weights | Loader | Zone |
|---|---|---|---|---|
| Display / hero | Archivo Expanded (Black) / Bricolage Grotesque (alt) | 900 | `next/font/local` (Archivo) / `next/font/google` (Bricolage) | External only |
| Headings | Archivo | 600, 700 | `next/font/google` | External (+ internal `i-h*`) |
| Body / UI | Space Grotesk / Inter | 400, 500, 700 | `next/font/google` | Both |
| Mono / annotation | Space Mono | 400, 700 | `next/font/google` | Both |

`display: swap`; `subsets: ['latin']`; display face preloaded; display fonts declared in `app/(external)/layout.tsx` only (NFR-18). Licensing: Space Grotesk, Space Mono, Bricolage, Inter, Archivo are OFL/open and self-hostable; confirm the Archivo Expanded "Expanded" stretch resolution at build (RISK-9; self-hosting via `next/font/local` is the chosen path, H2).

**Color tokens:** `--ink #0A0A0A` · `--paper #F2EEE4` · `--maize #FFCB05` (accent only; never on paper as text — DS-49/NFR-2) · `--blue #00274C` (reserved, internal only). Full contrast matrix in NFR-2.

**Motion libraries:** Lenis (~10 KB gz) + GSAP core + ScrollTrigger (~55 KB gz), external only, deferred off the critical path (NFR-22). No WebGL. GSAP SplitText (per-character reveals) requires a paid GSAP license — clip-path/mask reveals on whole text blocks avoid it (confirm motion approach, RISK-9 / a11y open issue).

**Storage buckets:** `resumes` (private, PDF-only ≤10MB, signed URLs ≤1h), `member-photos` (private, jpeg/png/webp ≤5MB), `candidate-photos` (private, future). OG images: per-route 1200×630 + a default brand fallback.

---

## Appendix C — Reconciliation log

Every contradiction (C#) and gap (X#) the adversarial critic found, with the one-line resolution applied and the governing reconciliation decision (A–O). The synthesized PRD reflects each resolution throughout; nothing below remains contradictory in the body.

### Contradictions resolved (18)

| # | Contradiction (domains) | Resolution | Decision |
|---|---|---|---|
| C1 | Blind mechanism: `scores.status` (RLS) vs `score_submissions` table (data) | Canonical = append-only `score_submissions`; no `status` column on `scores`; one EXISTS predicate (ATS-10–15, DM-29, SEC-12) | **B** |
| C2 | Auth join: `members.id = auth.uid()` (RLS) vs separate `user_id` (data) | `members.id` is PK; `user_id` is the auth link; all identity via `current_member_id()`/`current_member_role()` (SEC-10/11, DM-1, DM-29) | **A** |
| C3 | Candidate email uniqueness: global UNIQUE(email) vs per-cycle | Per-cycle `UNIQUE(cycle_id, lower(email))`; re-applicants get a new cycle-scoped row (candidates table, SEC-25, ATS-55) | **C** |
| C4 | Decisions mutability: RLS board-UPDATE vs append-only `deny_mutation` | `decisions` is append-only; no UPDATE policy; reversal = new row; `decision_value = accepted/rejected/waitlisted` (E1/E2, ATS-48, SEC-15) | **E** |
| C5 | Resume file type: PDF-only (RLS) vs PDF/DOCX (ATS/external/a11y) | PDF-only ≤10MB everywhere; a11y `accept="application/pdf"` (F1, EX-55, ATS-59, NFR-13, SEC-27) | **F** |
| C6 | Resume write path: anon Storage/table write vs service-role | Server-mediated Route Handler with service-role; no anon DB/Storage grant (F2, EX-59/EX-60, SEC-21/SEC-27) | **F** |
| C7 | Maize focus ring (design) vs ink focus ring (a11y) | Default ring = ink (2px, 2px offset); maize ring only on dark backgrounds (G1, DS-47a, NFR-4) | **G** |
| C8 | Font weights loaded: 400/500/700 (design) vs 400/500 + 400 (a11y) | Union of weights actually used: SG 400/500/700, SM 400/700, Archivo 900 + 600/700 (H1, DS-5, NFR-18) | **H** |
| C9 | Font loading: local allowed (design) vs google-only (a11y) | `next/font/google` for OFL faces + `next/font/local` for Archivo display (H2, DS-6, NFR-18) | **H** |
| C10 | Preloader under reduced motion: skipped (design/external) vs shown 150ms (a11y) | Skipped entirely under reduced motion (H3, DS-38, EX-14, NFR-11/NFR-12) | **H** |
| C11 | Notes soft-delete: `hidden` boolean (RLS) vs `deleted_at` (data/a11y) | Single `deleted_at` column; no `hidden` boolean (D2, notes table, SEC-15, NFR-23) | **D** |
| C12 | Notes edit window: 15 min (a11y) vs until lock point (ATS) | One lock model: editable until stage hash finalization; 15-min removed (D1, ATS-50, NFR-23) | **D** |
| C13 | Z-score stddev: sample n−1 (ATS) vs population (data) | Sample standard deviation (`STDDEV_SAMP`, n−1); n=1/zero-variance fallbacks (K2, ATS-21/23, DM-26/27) | **K** |
| C14 | Hash-session schema: `vote_visibility`/`status` (RLS) vs `visibility`/`is_active` (data) | `visibility` + `is_active` + `started_at`/`ended_at`; helpers `session_is_open`/`session_is_active` (I1, hash_sessions table, SEC-13/14) | **I** |
| C15 | Votes identity column: `evaluator_id` (RLS) vs `voter_id` (data) | `voter_id` everywhere; `vote_counts` view omits it (I2, votes table, SEC-15/39) | **I** |
| C16 | candidate_list view: `pronouns`/`open_rush` phantom columns | `v_candidate_roster` exposes only display_code/full_name/year/major/coarse status; no `pronouns`; gated to `is_open_rush` cycles; no `open_rush` status value (J1/J2, SEC-34, DM-5/DM-30) | **J** |
| C17 | Derived fields as base columns (RLS) vs views (data) | composite/normalized/controversy live in `v_score_composite`/`v_score_normalized`/`v_candidate_controversy`; resume column is `resume_storage_path` (I4/F3, DM-25–28/30) | **I** |
| C18 | Invite allowlist: `expires_at`/`used_at` (RLS) vs `consumed_at` (data) | Columns `email`, `role`, `invited_by`, `expires_at`, `consumed_at`; validity predicate stated (I3, invite_allowlist table, SEC-5) | **I** |

### Gaps closed (13)

| # | Gap | Resolution | Decision |
|---|---|---|---|
| X1 | G1–G6 never enumerated | Authored verbatim from source §3.1 (§3, §18) | **N** |
| X2 | Evaluator-to-stage/candidate assignment model missing | New `evaluator_assignments` table (DM-M2); powers MET-2/MET-3 + optional stage-scoped access | **M2** |
| X3 | Hash eligible-voter/participant set unbacked | New `hash_session_participants` table (DM-M3); quorum = distinct voters ÷ eligible (ATS-46) | **M3** |
| X4 | Placement curation override has no schema | New `placement_features` table (DM-M4, EX-25) | **M4** |
| X5 | Placement consent not separate from `is_public` | New `members.placement_consent` column (DM-M5, EX-26, ATS-39) | **M5** |
| X6 | Confirmation email promised but unbuilt | Success copy = "Application submitted."; email line only when enabled; external send is a hard-stop OQ-11 (EX-65, NFR-13) | **O1** |
| X7 | Applicant self-withdrawal unspecified | No authenticated applicant path in v1; withdrawal = email → board sets `withdrawn`; deferred OQ-12 (ATS-36, §3.2) | **O2** |
| X8 | Per-cycle application questions unconfigurable | New `application_questions` table (DM-M6); `application_responses` snapshots `question_text` | **M6** |
| X9 | Rate-limit infra (Upstash) outside locked stack | Postgres-backed `apply_rate_limit` counter; 5/IP/24h in-transaction; no Upstash (L2, DM-M8, SEC-24, EX-61) | **L** |
| X10 | Internal-zone IA/routes underspecified | `/internal/*` route map documented (O3, §9.0.1) | **O3** |
| X11 | Session-flip-to-open notification not wired | Banner + ARIA live-region announcement to all participants (O4, ATS-45, NFR-15) | **O4** |
| X12 | Resume/PII retention lifecycle unspecified | Retain cycle + 12 months, then scheduled purge; board export before purge (O5, NFR-27, OQ-14) | **O5** |
| X13 | Score granularity unreconciled (half-points vs integer) | Integer 1–5 raw scores; forms use integer inputs / 1–5 radios (K1, ATS-5/6, scores table, NFR-9/NFR-14) | **K1** |

### De-duplication (O6)
Each cross-cutting rule now has one canonical home, referenced by ID elsewhere: blind rule → §9.3/DM-29; append-only/soft-delete matrix → NFR-23 (aligned to DM-3/DM-4); reduced-motion map → DS-38/DS-39; `/apply` abuse → EX-61/SEC-23–24; resume constraints → EX-55/SEC-27; font loading → DS-6/NFR-18; maize/contrast → DS-47a–DS-49/NFR-2; impact-stats zero-proofing → EX-19–EX-23; pillars single source → EX-44; Storage privacy → SEC-28.

---

*End of document — MECG Digital Platform PRD v1.0 (Reconciled).*









