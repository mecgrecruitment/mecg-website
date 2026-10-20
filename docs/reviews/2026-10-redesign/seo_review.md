# Independent technical SEO review

Date: 2026-10-16. Read-only source audit by an AI specialist; not user research.
Scope: robots, sitemap, metadata, structured data; read `docs/DESIGN.md`.
Only this report was written. Findings reflect the source snapshot, not deployed HTML or Search Console.

## Top 3 findings

### 1. Confirmed — nonmarketing pages lack an explicit indexing exclusion (P1)
- Evidence: `src/app/layout.tsx:31` defaults every route to `index: true`.
  `src/app/login/[[...login]]/page.tsx:11`, `src/app/apply/page.tsx:22`,
  and `src/app/access-denied/page.tsx:5` override only the title.
- `src/app/robots.ts:8` blocks crawling of login/apply/workspace URLs;
  `/access-denied` is not blocked and renders ordinary page content.
- Impact: crawl blocking does not guarantee URL exclusion from search; the crawlable
  access-denied page also inherits an affirmative indexing directive. This is an
  indexing-policy defect, not evidence of private content exposure or actual indexing.
- Recommendation: scope `noindex` to utility/auth/workspace routes; keep authentication.
  For public utility pages that must disappear from search, permit crawlers to read
  the exclusion rather than relying solely on robots disallow.
- Reference: [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

### 2. Confirmed — case-study Twitter image URL omits its generated image ID (P2)
- Evidence: `src/app/(marketing)/work/[slug]/page.tsx:43` explicitly sets
  `/work/${slug}/opengraph-image`; its image module exports `generateImageMetadata`
  with slug IDs at `src/app/(marketing)/work/[slug]/opengraph-image.tsx:8-9`.
- Installed framework evidence: `node_modules/next/dist/esm/build/webpack/loaders/next-metadata-route-loader.js:129-143`
  selects an image by metadata ID and returns 404 when no matching ID exists.
- Impact: the explicit Twitter image points at an address lacking the required ID.
  File-based Open Graph discovery can supply the correct OG address independently;
  do not assume that makes the explicitly configured Twitter address valid.
- Recommendation: use one image per slug without `generateImageMetadata`, or construct
  the ID-bearing image URL consistently. Verify emitted Twitter/OG URLs return images.
- Reference: [Next image conventions](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image).

### 3. Hypothesis — database publication can advertise case-study URLs that 404 (P2)
- Evidence: `src/app/(marketing)/work/[slug]/page.tsx:15-18` disables dynamic params
  and enumerates slugs at build time. `src/app/sitemap.ts:9` obtains slugs separately;
  `src/lib/projects/public-projects.ts:58-69,85-86` reads live database content with fallback.
- Trigger: a new project is published after a build, without rebuilding routes.
  Whenever the sitemap or work listing reads that newer data, its new slug can lack
  a generated page. Sitemap caching may instead leave the project undiscoverable.
- Unverified: whether publishing always triggers a deployment; no production failure claimed.
- Recommendation: document/enforce rebuild-on-publish, or support new slugs at runtime
  with an intentional refresh policy shared by pages, listings, images, and sitemap.
- Acceptance: publish a new slug in an isolated environment and verify listing, sitemap,
  canonical page (200), and social image agree before public discovery.

## Other inspected evidence

- Robots declares the correct sitemap host; sitemap includes the five public routes
  and project slugs (`src/app/robots.ts:7-10`, `src/app/sitemap.ts:5-9`).
- `/` permanently redirects to `/home`; its canonical is `/home`, so that pairing is
  internally consistent (`next.config.ts:87`, `src/app/(marketing)/home/page.tsx:15`).
- Organization JSON-LD has name, URL, existing SVG logo, and social profiles
  (`src/app/layout.tsx:34-43`); breadcrumbs exist on work and case-study pages
  (`src/app/(marketing)/work/page.tsx:23-29`, `src/app/(marketing)/work/[slug]/page.tsx:54-61`).
- JSON-LD serialization escapes script-breaking characters (`src/lib/json-ld.ts:4-8`).
  No confirmed structured-data defect found; rich-result eligibility was not tested.
