# MECG Design Philosophy — Precision Instrument

The single sentence: **the site is an engineering document — numbered sections, mono-set data, hairline structure, one accent used surgically — because a mechanical engineering consulting group should demonstrate rigor, not assert it.**

Decision record (2026-08-22): three directions were evaluated — precision spec-sheet, work-first editorial, kinetic motion. Precision Instrument won because it finishes what the work page already started and it is the one aesthetic business clubs (Apex, 180DC) structurally cannot claim. Work-first editorial lost because the photo inventory has zero project artifacts today (see §7). Kinetic lost as a base for maintenance risk, but its zero-cost details were grafted in (gear ratios, motion tokens, unified splash exit).

## 1. Principles

1. **If it's data, it's mono; if it's prose, it's sans.** The UI face (`--font-ui`) for everything readable. The numeric face (`--font-numeric`, exposed as `font-mono` and the `.tabular` class) only for machine-ish text: section numbers, stat values, metadata, captions. Never mono body copy.
   - **Public site:** unchanged. Mono uppercase labels, figure captions and statuses are the engineering-document identity and stay.
   - **Signed-in workspace (2026-09-02):** narrower. Inside `/member`, `/admin`, `/apply` and the applicant portal, mono is reserved for *figures* (`.tabular`), applicant and candidate codes, timestamps and ids. Chrome (nav pills, section labels, status chips, table headers, field markers) is sans, sentence case, minimum 12px. 141 of 193 `font-mono` uses were 10-11px all-caps chrome, which read as a third typeface and cost legibility in the screen people use every week. Neither "Montserrat" nor "Geist Mono" was ever actually loaded; both tokens were renamed to say what they are.
2. **One accent, two inks.** `mecg-orange #fe904d` for fills and for text on navy. `mecg-orange-ink #a83e0b` for orange text on white/paper (6.2:1, WCAG AA). Never raw orange text on a light background — it fails contrast at 2.25:1. Focus rings follow the same floor and are covered separately below (Tokens, "Focus ring").
3. **Numbers over adjectives.** Every credibility claim is a figure or a named client. No "passionate", no "excellence", no "Welcome to".
4. **Proof before people.** Home order: hero, stats, clients, featured engagement, semester spec, people, alumni, CTA.
5. **Two audiences, one CTA each.** "Discuss a project" (clients) and "Join MECG" (students). Never more than these two actions per view.
6. **One label grammar.** `NN[.N] / LABEL`, number in orange (ink on light, orange on dark). Every section on every page is numbered, including home. `SectionLabel` is the only way to write one. On the public site it sets in mono, ~11px, uppercase, tracking 0.16em; in the workspace it sets in sans at 12px sentence case (`.section-label`), per principle 1.
7. **Motion clarifies state, never delays work.** Use `--t-control` / `--t-detent` at 150ms for hover, focus, press, and selected-state feedback; use `--t-panel` at 200ms only when direction or disclosure helps explain a state change. Workspace routes, routine lists, notices, and sections render immediately—no page entrances, blur, stagger, or looping decoration. Real numbers render server-side and never count up from zero.
8. **Real artifacts, never stock.** Photos get a hairline frame (`outline-mecg-navy/10` on light, `outline-white/12` on dark) and a mono figure caption: `FIG. NN — PLACE, CONTEXT`. Empty proof gets a status line (`STATUS / CASE STUDY PENDING CLIENT APPROVAL`), never an apology sentence.
9. **Square, not pill.** Buttons are 2px radius: `.button-primary` (filled orange, navy text), `.button-secondary` (outline on light), `.button-dark` (outline on dark). Cards square or `rounded-2xl` max; nothing at `rounded-[2rem]`. Scoped exception: the portal's elevated outer card — `portal-shell.tsx`, `workspace-state.tsx`, `/apply`, `/applicant` — uses `rounded-[28px]` with a heavy shadow, centralized as a single utility class, reserved for the single outermost card of a full-bleed auth/workspace screen; content cards inside a workspace still stay `rounded-2xl` and hairline.
10. **Hairlines are the structure.** `border-mecg-navy/10` on light, `border-white/12` on dark, `gap-px` grids on tinted backgrounds. No shadows for structure.
11. **Never render a storage value.** Database enums (`DECISION_LOCK`, `NEEDS_INFO`, `FROZEN`, `RECUSED`) are storage, not sentences, and they used to reach the screen raw in every workspace header and status chip. Every user-visible status goes through a helper in `src/lib/labels.ts`, which maps each enum to a plain phrase and title-cases anything unmapped so a new value degrades gracefully. Where a `<select>` offers enum options, the `value` stays the exact enum string and only the visible text is humanized. Screen names follow the same rule: prefer what a first-week member would call the thing ("Applicants", "Application review", "Emails & texts") over the internal name ("Pipeline", "Blind screening", "Delivery"). "Hash" is the deliberate exception, it is the club's own word, and it carries a one-line explainer.

## 2. Tokens

| Token | Value | Role |
|---|---|---|
| `mecg-navy` | `#070d1f` | Primary text, dark surfaces |
| `mecg-blue` | `#3f63af` | Headings, logo, ≤12% tints |
| `mecg-orange` | `#fe904d` | Fills; text on dark only |
| `mecg-orange-ink` | `#a83e0b` | Orange text on light surfaces |
| `paper` | `#f4f1ec` | Mats behind logos/images |

Type scale: display `text-5xl sm:text-7xl` weight 600 tight tracking; section head `text-4xl sm:text-5xl`; body 16–18px `text-mecg-navy/60`+; mono label 11–12px uppercase tracking `0.16em`; all numerals `tabular-nums`. Containers `max-w-6xl px-6`; sections `py-16 sm:py-20`; bands `py-10`. Portal container: `max-w-7xl` (`PortalShell`, `WorkspaceLoading`/`WorkspaceError`, every authenticated `/admin`, `/member`, `/apply` shell) — an intentional second value, distinct from marketing's `max-w-6xl px-6`, not a violation.

Accessibility floors (audited): text on white/paper surfaces needs `text-mecg-navy/60` as a floor on pure white, but `/65` on the tinted surfaces `#f5f4ef` and `#f4f1ec` (60 only clears 4.5:1 by a 0.4–0.5 margin there); text on navy ≥ `text-white/50` (measured: `/45` sits at exactly 4.50:1, no margin; `/50` gives real headroom); interactive targets ≥ 44px; every field carries its own `focus-visible` ring.

Focus ring (audited 2026-09-01): default `:focus-visible` outline is `mecg-navy`, not `mecg-orange` — orange is 2.25:1 on white and 2.58:1 on the `mecg-blue` section fill, both under the 3:1 WCAG 2.2 SC 1.4.11 floor for a non-text indicator; navy clears 3:1 on white (19.33:1), paper (17.16:1), and the `mecg-blue` fill (3.33:1). Navy drops to ~1:1 on the site's opaque navy surfaces (header, footer, `tone="navy"` sections), so `globals.css` overrides those back to orange (8.57:1 on navy).

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

Motion is implemented with CSS only; no animation or 3D runtime is installed. Do not add one for routine interface feedback. shadcn/ui remains the fallback base for complex form UI.

## 7. Open debt (owner: board, not code)

- **Artifact sprint**: the site has zero project artifacts (no CAD, deliverable spreads, on-site photos). ~10 frames per semester — redacted decision-brief covers, two slide spreads per approvable client, one working-session shoot — would unlock the work-first proof layer. Until then, the question is the artifact (typographic case rows).
- Client approval for publishing case-study results (Legendary Sports, Glo realistic; GM unlikely).
- `mecg-pictures/` is a culture archive, not a portfolio: ~6–8 of ~60 frames are publishable (join/team culture strip only).
