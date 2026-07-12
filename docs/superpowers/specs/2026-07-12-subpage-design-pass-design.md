# Subpage design pass — client logos, interactive timeline, misc polish

Date: 2026-07-12

## Context

The external marketing pages (`app/(external)/*`) share one consistent design
system: navy/orange "engineering blueprint" aesthetic, `panel`/`sheet`/
`annotation`/`display` utility classes, and a GSAP + ScrollTrigger + Lenis
motion system (`app/(external)/components/MotionProvider.tsx`) exposing
`data-reveal`, `data-split`, `data-parallax`, `data-hud-gear`, `data-counter`,
and `data-magnetic` primitives.

Two gaps were identified against that system:

- `client-services/page.tsx` explicitly excludes company logos/photos
  ("Logos and photos are intentionally excluded from this section for now"),
  even though `clients` in `src/lib/site-content.ts` lists 17 real past
  clients.
- `prospective-members/page.tsx` has a "Recruitment Timeline" section that is
  a static 3-column card grid, not an actual timeline, despite
  `recruitmentEvents` in `src/lib/site-content.ts` carrying real chronological
  data (code, title, date, time, location, body).

This pass closes both gaps and applies smaller polish across `about`,
`our-team`, and `contact`. No new dependencies — every addition below reuses
GSAP/Lenis/`sharp` (all already installed) and existing motion primitives.

## Scope

In scope:
1. `client-services` — real company logos on the client grid.
2. `prospective-members` — interactive scroll-scrubbed timeline.
3. `client-services` — mini version of the same timeline component applied
   to the existing 4-step `projectTimeline` (Meet/Scope/Build/Share).
4. `about` — stats strip using the existing (currently unused) `data-counter`
   primitive.
5. `our-team` — sticky section-jump tabs.
6. `contact` — fix two pre-existing CSS typos that currently break layout
   and focus state.

Explicitly out of scope:
- `trek` — page is marked "in drafting / coming soon" with no real stops
  data. No fabricated content will be added.
- `socials` — already has a photo ribbon; no changes requested.
- Any change to `app/internal`, `app/portal`, `app/apply`, `app/auth`
  (auth/portal surfaces, unrelated to public marketing pages).

## 1. Client logos (`client-services`)

**Sourcing:** For each of the 17 entries in `clients` (`src/lib/
site-content.ts`), find and download one usable logo image (official site,
press kit, or Wikipedia/Wikimedia Commons) into `public/images/clients/
<slug>.<ext>`. Some entries are small local businesses (e.g. "Fired and
Fused", "Here Here Market") and may not have a clean, freely-usable logo
available — those fall back to the current typographic card (index/term/name,
no image), never a broken `<img>` or a fabricated mark.

**Data model:** Add an optional `logo?: string` field to each `clients`
entry in `src/lib/site-content.ts`, pointing at the downloaded asset (or
omitted if none was found).

**Normalization:** A one-off Node script (`scripts/format-client-logos.mjs`,
run once, not part of the build) uses `sharp` to:
- trim surrounding whitespace/transparency on each source image,
- pad the result onto a consistent square canvas,
- export as `.webp` into `public/images/clients/`.

This exists so a high-res vector-derived PNG (e.g. General Motors) and a
scrappy screenshot-quality logo (e.g. a local restaurant's Squarespace export)
render at the same visual weight in the grid — not to hide legibility, just
to normalize crop/margins.

**Grid treatment:** Client cards in the existing
`grid gap-3 sm:grid-cols-2 lg:grid-cols-4` grid gain a logo tile above the
current index/term/name text. Default state: grayscale + dimmed opacity.
Hover: full color, card lifts — same interaction language as `MemberCard` on
`our-team` (`hover:-translate-y-1 hover:border-[var(--orange)]/45`). Cards
with no `logo` render exactly as they do today.

## 2. Interactive timeline (`prospective-members`)

Replace the static `recruitmentEvents` card grid with a scroll-scrubbed
vertical spine:

- A vertical rail (reusing the `dim-rule`/`--paper-rule` token already used
  elsewhere for divider lines) runs down the section.
- A marker travels down the rail tied to scroll progress within the section,
  using the same ScrollTrigger-driven progress mechanism that already powers
  `data-hud-gear`.
- Each `recruitmentEvents` entry becomes a node on the rail: outlined by
  default, fills solid `--orange` once the scroll marker passes it.
- Clicking/tapping a node expands its date/time/location/body inline
  (reusing the `<details>`-driven expand pattern already used for `services`
  on the same page's sibling `client-services` page, for consistency).
- Mobile (`<md`): same vertical spine, just narrower — no separate mobile
  variant needed since it's already a single-column, top-to-bottom layout.

## 3. Mini timeline (`client-services`)

The existing 4-step `projectTimeline` (Meet → Scope → Build → Share) gets
the same rail/marker visual treatment in a horizontal, non-scroll-scrubbed
form (4 fixed steps, no scroll-linked animation needed at that length) so the
site has one consistent "timeline" visual language instead of two unrelated
ones.

## 4. Stats strip (`about`)

Add a small stats row to `about/page.tsx` using the existing `data-counter`
primitive (numeric roll-up-from-0 on scroll-into-view), currently defined in
`MotionProvider.tsx` but unused anywhere on the site. Figures (years running,
number of clients served, number of semesters) are derived from data already
in `src/lib/site-content.ts` (`clients.length`, founding year 2023) — no new
data source invented.

## 5. Section-jump tabs (`our-team`)

Add a small sticky tab row (Exec Board / PMs / APMs / Strategic Leads /
Analysts) above the member sections, scrolling to the relevant section on
click (native `scrollIntoView`, no new dependency). Purely a navigation aid;
the existing `MemberCard` grid and section structure are unchanged.

## 6. Bug fixes (`contact`)

Two pre-existing typos in `contact/page.tsx`:
- `lg:grid-col.15fr_0.85fr]` → `lg:grid-cols-[1.15fr_0.85fr]` (currently
  breaks the two-column form/aside layout — falls back to default single
  column behavior).
- `cus:border-[var(--orange)]/70` → `focus:border-[var(--orange)]/70`
  (currently means form inputs never show a focus border).

## Testing / verification

- `npm run build` (or project's equivalent) succeeds with no type errors
  after the `clients` data model change.
- Visual check in a running dev server: client-services logo grid, both
  timelines, about stats strip, our-team tabs, contact layout — light/dark
  is not a concern here (site is single dark theme throughout).
- No `next/image` remote-pattern errors — all logo/photo assets are local
  under `public/images/`.
