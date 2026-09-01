# SECTION 6 audit — public marketing site (SEO, performance, accessibility)

## Verdict

The marketing surface (home, work, work/[slug], team, join, contact) is well-structured at the document level — one `<h1>` per page, sequential heading order, a real robots.txt/sitemap pair, next/font with `display: swap`, and `next/image` used everywhere with no raw `<img>` tags — but it ships three concrete defects that undercut both SEO and WCAG 2.2 AA: every non-home page inherits the homepage's static Open Graph/Twitter title and description because child routes never declare their own `openGraph`/`twitter` objects (Next.js does not synthesize these from a page's plain `title`/`description`); the sitewide `focus-visible` ring color (`mecg-orange` on white) sits at roughly 2.25:1 contrast against light surfaces, which the project's own `docs/DESIGN.md` documents as a known-failing combination yet still ships as the default focus indicator on every button, input, and link outside dark sections; and `robots.ts` disallows the admin/member/applicant/apply/api/auth-form surface but omits `/checkin` and `/auth`, both of which carry bearer tokens in the URL and default to `index: true` via the root layout with no per-route `noindex` override. There is no structured data anywhere in the app (`grep` for `ld+json`/`schema.org` returns nothing), and no skip link exists despite a sticky full-width header on every page. Content-pipeline integrity is solid: `scripts/export-public-projects.mjs` fails closed (throws) on missing approvals and strips every unapproved field, and `PUBLIC_PROJECTS` is currently empty, so `/work/[slug]` has zero live routes today. Image handling is correct in principle (all through `next/image`, aspect-ratio boxes reserve space, hero has `priority`) but the source JPEGs in `public/mecg/` and `public/board/` are 150–860 KB uncompressed originals that depend entirely on the Vercel image optimizer being present at runtime to avoid shipping multi-hundred-KB payloads.

## Per-route metadata table

| Route | File | title | description | canonical | openGraph | twitter | robots |
|---|---|---|---|---|---|---|---|
| `/` | (no page; 301 → `/home` in `next.config.ts:48`) | — | — | — | — | — | n/a |
| `/home` | `src/app/(marketing)/home/page.tsx:9-13` | "Michigan Engineering Consulting Group" | own | `/home` | **inherited from root** (same string, coincidentally matches) | inherited | inherited (`index:true`) |
| `/team` | `src/app/(marketing)/team/page.tsx:8-12` | "Our Team" → renders "Our Team \| MECG" | own | `/team` | **inherited root OG** — title/description do NOT update | inherited (stale) | inherited |
| `/work` | `src/app/(marketing)/work/page.tsx:11-15` | "Client Services" | own | `/work` | **inherited root OG** (stale) | inherited (stale) | inherited |
| `/work/[slug]` | `src/app/(marketing)/work/[slug]/page.tsx:20-31` | `project.title`, or `{}` if slug not found | `project.decision` | `` `/work/${slug}` `` | **not set at all** — inherits root OG unconditionally | inherited | inherited |
| `/join` | `src/app/(marketing)/join/page.tsx:19-23` | "Join Our Team" | own | `/join` | **inherited root OG** (stale) | inherited (stale) | inherited |
| `/contact` | `src/app/(marketing)/contact/page.tsx:7-11` | "Contact Us" | own | `/contact` | **inherited root OG** (stale) | inherited (stale) | inherited |

Root defaults live in `src/app/layout.tsx:18-40`: `title.template = "%s | MECG"`, static `openGraph`/`twitter` blocks pointing at `/opengraph-image` (a single generic image, `src/app/opengraph-image.tsx`), and `robots: { index: true, follow: true }` applied to every page that doesn't override it.

`generateMetadata` on `/work/[slug]` (`src/app/(marketing)/work/[slug]/page.tsx:20-31`) exists and returns `{}` for an unknown slug; because `dynamicParams = false` (line 14) and `generateStaticParams` (line 16-18) only pre-renders approved slugs, an unknown slug 404s before `generateMetadata`/the page body ever run, so the `{}` fallback is effectively dead code but harmless.

## Image inventory

| File | Dimensions | Format | Size | Used via | Verdict |
|---|---|---|---|---|---|
| `public/mecg/community-formal-pair.jpeg` | 1277×1600 | baseline JPEG | 860K | `next/image`, home + join carousel | Oversized source; fine only if Next's image optimizer runs at request time |
| `public/mecg/members-professional.jpeg` | 1600×1126 | baseline JPEG | 696K | `next/image`, home hero (`priority`) | LCP candidate — largest source feeding the most performance-critical image on the site |
| `public/mecg/community-green-day.jpeg` | 2048×1536 | progressive JPEG | 528K | carousel | Oversized source |
| `public/mecg/community-maize-day.jpeg` | 2048×1530 | progressive JPEG | 496K | carousel | Oversized source |
| `public/mecg/members-chicago-professional.jpeg` | 1600×1200 | baseline JPEG | 364K | carousel | Oversized source |
| `public/mecg/members-board-professional.jpeg` | 1600×1200 | baseline JPEG | 360K | carousel | Oversized source |
| `public/board/luciano.jpeg` | 1368×2048 | baseline JPEG | 320K | `next/image`, team | Oversized source |
| `public/about/president.jpg` | 1200×1600 | baseline JPEG, iPhone EXIF+GPS | 316K | `next/image`, home | Oversized source; also carries **GPS EXIF data** (see finding) |
| `public/board/abby.jpeg` | 1066×1600 | baseline JPEG | 308K | team | Oversized source |
| `public/board/jandy.jpeg` | 1290×1822 | baseline JPEG | 288K | team | Oversized source |
| `public/mecg/community-formal-group.jpeg` | 2048×1536 | progressive JPEG | 260K | carousel | Oversized source |
| `public/board/sumedha.jpeg`, `angela.jpeg` | 1066×1600 | baseline JPEG | 252K each | team | Oversized source |
| `public/board/maya.jpeg` | 1152×1624 | baseline JPEG | 240K | team | Oversized source |
| `public/board/selena.jpeg`, `nandini.jpeg` | ~1000×1400 | baseline JPEG | 204K each | team | Oversized source |
| `public/board/blake.jpeg` | 1066×1600 | baseline JPEG | 192K | team | Oversized source |
| `public/board/annie-new.jpeg` | 900×1600 | baseline JPEG | 168K | team | Oversized source |
| `public/images/clients/michigan-creamery.png`, `homeschool-connections.png` | 500×500 RGBA | PNG | 140K each | `next/image`, work/ClientProjectGrid | Should be re-exported as WebP/optimized PNG — logos this flat compress far smaller |
| `public/images/clients/frankel-jewish-academy.png`, `fired-and-fused.png`, `the-store-house.png`, `lynkr.png`, `legendary-sports-xperiences.png`, `the-probate-pro.png`, `dani-plan.png` | 500×500 RGBA | PNG | 28K–64K | same | Acceptable, minor headroom |
| `public/images/clients/red-hawk-golf-club.png`, `glo-skin-spa.png` | 225×225, 8-bit indexed | PNG | 16K, 4.0K | same | Fine |
| `public/images/clients/koops-automation.jpg`, `gypsy-spirits.jpg`, `here-here-market.jpg` | 200×200 | JPEG | 8.0K each | same | Fine |
| `public/images/clients/general-motors.svg` | vector | SVG | 4.0K | same | Fine |
| `public/logos/mecg-white.svg`, `mecg-color.svg` | vector | SVG | 16K each | header/footer | Fine |
| `src/app/icon.png` | 196×196 | PNG | 12K | favicon | Fine |
| `src/app/apple-icon.png` | 180×180 | PNG | 12K | apple touch icon | Fine |

No raw `<img>` tags exist anywhere under `src/app/(marketing)` or `src/components` (`grep -rn "<img"` returns nothing) — every image goes through `next/image`, which means the byte sizes above are **source** sizes, not necessarily wire sizes; actual delivered bytes depend on Next's built-in image optimizer (no `images.unoptimized` in `next.config.ts`) resizing/re-encoding to the `sizes` requested. That optimizer is a runtime dependency, not a build-time guarantee — see finding below.

## Findings

### [HIGH] Every marketing page except the homepage ships the wrong Open Graph/Twitter card
`src/app/(marketing)/team/page.tsx:8-12`, `work/page.tsx:11-15`, `work/[slug]/page.tsx:20-31`, `join/page.tsx:19-23`, `contact/page.tsx:7-11`; root defaults in `src/app/layout.tsx:26-38`.
Only `title`, `description`, and `alternates.canonical` are set per route. None of the five child routes declare their own `openGraph` or `twitter` metadata objects. Next.js metadata inheritance does not synthesize `openGraph.title`/`openGraph.description` from a page's plain `title`/`description` — it inherits the parent's `openGraph` object verbatim when a route doesn't declare its own. Result: sharing `/team`, `/work`, any `/work/[slug]` case study, `/join`, or `/contact` on Slack/iMessage/LinkedIn/Twitter shows the card "Michigan Engineering Consulting Group — Pro-bono, student-led consulting at the University of Michigan" instead of the actual page content, and a future published case study's social card will say nothing about the client or project.
Fix: add `openGraph: { title, description }` and `twitter: { title, description }` to each route's `metadata`/`generateMetadata`, mirroring the plain `title`/`description` already computed there.

### [HIGH] Focus-visible ring fails non-text contrast on every light surface, contradicting the project's own documented floor
`src/app/globals.css:60-67` sets `outline: 2px solid var(--color-mecg-orange)` (`#fe904d`) for `:focus-visible` on every button, link, input, select, and textarea, with no override for light backgrounds. Computed contrast of `#fe904d` against white (`#ffffff`) is **≈2.25:1**, below the 3:1 minimum WCAG 2.2 SC 1.4.11 (Non-text Contrast) requires for a focus indicator's boundary against its adjacent color. `docs/DESIGN.md:12` explicitly documents this exact number — "it fails contrast at 2.25:1" — as the reason raw orange text is banned on light backgrounds, but the same color is still the default focus ring color, and light-surface components (`.button-secondary`, `.field-control` inputs, `text-link`, nav links in the footer's white-on-navy... actually all body-section buttons/inputs on `bg-white`/`bg-paper`/`bg-mecg-blue/[0.07]` sections) inherit it unchanged. Keyboard users tabbing through `/contact`'s form, `/work`'s cards, or the header's nav on any white section get a focus ring that is measurably harder to see than the site's own accessibility floor allows.
Fix: add a light-surface focus token, e.g. `outline-color: var(--color-mecg-navy)` (which is ≈8.6:1 against orange... against white it's ~19:1) inside a selector scoped to light backgrounds, or switch the global focus ring to `mecg-navy` (works on both, since navy-on-orange-button and navy-on-white both clear 3:1) and keep orange only for dark-surface overrides.

### [HIGH] `robots.ts` does not disallow the two remaining token-bearing routes; they default to indexable
`src/app/robots.ts:3-11` disallows `/admin`, `/member`, `/applicant`, `/apply`, `/api`, `/login`, `/forgot-password`, `/reset-password`, but not `/checkin/[token]` (`src/app/checkin/[token]/page.tsx`) or `/auth/callback` (`src/app/auth/callback/route.ts`). Both carry per-recipient tokens in the URL. Neither route sets `robots: { index: false }` in its own metadata (checked directly — `src/app/checkin/[token]/page.tsx:6` only sets `title`), so they inherit the root layout's `robots: { index: true, follow: true }` (`src/app/layout.tsx:39`). A check-in link forwarded, screenshotted, or scraped from an email client's link-preview crawler is both crawlable and indexable today.
Fix: add `/checkin` and `/auth` to the `disallow` array in `robots.ts`, and set `robots: { index: false, follow: false }` directly on `checkin/[token]/page.tsx` and any other token-bearing route as defense in depth (robots.txt only blocks crawling, not indexing of a URL discovered via an external link).

### [MEDIUM] No skip link on any marketing page
`src/app/(marketing)/layout.tsx:1-12`, `src/components/site-header.tsx`. The header is `sticky top-0` with a full nav (4 links + login + apply) on every page, and there is no "Skip to main content" link anywhere in the codebase (`grep -i skip` across components/layout returns nothing). WCAG 2.2 AA requires 2.4.1 Bypass Blocks (a Level A success criterion required for AA conformance). Keyboard and screen-reader users must tab through the entire header on every page load before reaching page content.
Fix: add a visually-hidden-until-focused skip link as the first focusable element in `src/app/(marketing)/layout.tsx`, targeting a `id="main-content"` (or similar) added to each page's `<main>`.

### [MEDIUM] No structured data anywhere on the site
Searched the full `src/` tree for `ld+json`, `schema.org`, and `JsonLd` — zero matches. There is no `Organization`/`EducationalOrganization` schema on the homepage or root layout, and no `BreadcrumbList` on `/work/[slug]` case-study pages, despite those pages having an obvious breadcrumb-shaped nav (`Client Services > {project.title}`, already rendered as a "← Back to client work" link at `src/app/(marketing)/work/[slug]/page.tsx:102`).
Fix: add an `Organization` (or `EducationalOrganization`) JSON-LD block in `src/app/layout.tsx` with `name`, `url`, `logo`, `sameAs` (the Instagram/LinkedIn URLs already in `src/components/site-footer.tsx:32-33`), and a `BreadcrumbList` block on `/work/[slug]` and `/work`.

### [MEDIUM] Text below the project's own documented contrast floor in three components
`docs/DESIGN.md:20` states the audited floor as "text on white ≥ `text-mecg-navy/60`". Three places in scope go below it:
- `src/app/(marketing)/work/page.tsx:61` — `<dt className="text-sm text-mecg-navy/55">` for the "Cost/Length/Team/Confidentiality" labels. Computed contrast of navy-at-55%-over-white ≈ **4.30:1**, below the 4.5:1 AA minimum for 14px (`text-sm`) text (and below the site's own /60 floor).
- `src/components/project-card.tsx:7` — `text-mecg-navy/45` for the industry/semester eyebrow tag (10.4px mono). Computed contrast ≈ **3.11:1** — fails AA normal-text contrast outright.
- `src/components/client-project-grid.tsx:98` — `text-mecg-navy/45` for the "MECG engagement" label. Same ≈3.11:1 failure.
Fix: bump all three to at least `/60` (per the project's own floor) — `/60` measures ≈5.11:1, which clears 4.5:1 with margin.

### [MEDIUM] Marketing forms have no per-field error association, unlike the shared `FormField` component
`src/app/(marketing)/contact/contact-form.tsx:40-44`, `src/app/(marketing)/join/interest-form.tsx:52-99`. Both forms build raw `<label>text<input/></label>` pairs directly instead of reusing `src/components/form-field.tsx`, which already implements `aria-invalid`/`aria-describedby`/hint+error wiring for exactly this purpose (used by `apply`, `login`, `forgot-password`, `reset-password` forms). The marketing forms surface only a single generic `aria-live="polite"` status paragraph at the bottom of the form (`contact-form.tsx:48`, `interest-form.tsx:107`) with no `role="alert"`, and no way to know which field a server-side validation error refers to. A user who fails server validation (e.g. message length) has no indication which input to fix beyond re-reading the whole form.
Fix: route these two forms through `FormField`, and use `role="alert"` (or `aria-live="assertive"`) for the error-state message instead of a flat `aria-live="polite"` used for both success and failure.

### [LOW] `generateMetadata` returning `{}` for missing `/work/[slug]` is unreachable given `dynamicParams = false`
`src/app/(marketing)/work/[slug]/page.tsx:14,20-24`. Because `dynamicParams = false` and `generateStaticParams` (currently returning `[]`, since `PUBLIC_PROJECTS` is empty) is the sole source of valid slugs, any request for an unknown slug 404s before `generateMetadata` or the page body run. The `if (!project) return {}` branch is dead code today. Not a bug, but worth knowing it provides no actual safety net — the real guarantee is `dynamicParams = false`.

### [LOW] Team page's first headshot uses `loading="eager"` instead of `priority`
`src/app/(marketing)/team/page.tsx:26` — `loading={index === 0 ? "eager" : "lazy"}` with no `priority` prop. On `/team`, that first board photo is the likely LCP element, but only `priority` triggers Next's `fetchpriority="high"` + `<link rel="preload">` treatment; `loading="eager"` alone just disables native lazy-loading without the preload hint.
Fix: `priority={index === 0}` instead of (or in addition to) the `loading` prop.

### [LOW] `public/about/president.jpg` carries GPS EXIF metadata
`file` output for `public/about/president.jpg` shows `GPS-Data` embedded (captured on an iPhone 15 Pro Max). This file is served as-is from `/public`, and Next's image optimizer does not strip EXIF on all output formats/paths reliably in every configuration. Shipping a personal photo with embedded GPS coordinates on a public page is a minor privacy leak independent of any SEO/perf concern.
Fix: strip EXIF (`exiftool -all= public/about/president.jpg` or re-export flattened) before committing source photos.

### [LOW] `PhotoCarousel` gives no programmatic indication of position
`src/components/photo-carousel.tsx:21-42`. The prev/next buttons are keyboard-operable and labeled, but there's no `aria-live` region or visible "3 of 7" indicator, so screen-reader and low-vision users get no feedback on carousel position after activating a button.
Fix: add a visually-hidden `aria-live="polite"` status node updated on scroll, or a visible slide counter.

### [LOW] Dead/duplicated content constants
`src/lib/site-content.ts:1-6` exports `STATS` and `:174-182` exports `CLIENT_FAQS`; neither is imported anywhere under `src/app/(marketing)` or `src/components` (`grep` confirms zero usages). Not a bug, but worth pruning or wiring in — the homepage's own design doc (`docs/DESIGN.md` principle 4, "Proof before people... stats, clients...") suggests `STATS` was meant to render and doesn't.

## Content pipeline integrity (item 7) — no findings

`scripts/export-public-projects.mjs:39-70` (`releaseProject`) fails closed: it requires `record.status === "publishable"`, a non-empty `boardApprovedAt` and `clientApprovedAt` string (throws otherwise), and every emitted field must independently carry `approved: true` via `approvedText`/`approvedItems` — array items that are present but not individually approved are silently filtered out rather than leaking through. The output object is built from an explicit allowlist of keys (line 54-68); nothing outside that allowlist (e.g. `sourceFiles`, `notes` seen in the review record shape used by the test) can reach `serializePublicProjects`. `scripts/export-public-projects.test.mjs:32-73` directly asserts draft/review-status records produce `[]`, that unapproved sub-fields are dropped, and that the string `"PRIVATE"` never appears in the serialized output. `src/content/projects.public.ts` (the generated file actually imported by the app) is currently `PUBLIC_PROJECTS = []`, and `src/lib/projects/public-projects.ts` and the sitemap/generateStaticParams both derive directly from that array — there is no separate/parallel data source that could leak an unpublished project into `/work` or `/work/[slug]`.

## Responsive behavior (item 8) — no findings

No fixed pixel widths outside safe contexts were found; the few `w-[...]`/`max-w-[...]` occurrences in scope are viewport-relative (`w-[82vw]`, `sm:w-[64vw]`) or upper-bound caps (`max-w-[90rem]`, `max-w-xl`) that don't force horizontal overflow on narrow viewports. The mobile nav (`site-header.tsx:49-67`) and header's `min-h-18`/`max-w-[90rem]` container degrade correctly with `px-6`/`sm:px-10` padding at all widths tested by inspection.
