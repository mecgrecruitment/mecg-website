# Public-route performance review — 2026-10-16

Independent AI specialist code audit; not a user study. Read-only review of
`docs/DESIGN.md`, marketing routes, shared client components, and public data clients.
Source snapshot only: concurrent implementations may change these findings.
No production traces, browser profiling, build analysis, or synthetic scores.

## Top 3 evidenced improvements

1. **Correct image scheduling and slot sizes.**
   Confirmed: `src/components/photo-carousel.tsx:49` makes the first image eager
   wherever the component appears, including the final homepage section
   (`src/app/(marketing)/home/page.tsx:129-130`) and the join page gallery
   (`src/app/(marketing)/join/page.tsx:118`). This defeats viewport-based lazy
   loading for those images. Default the gallery to lazy; allow explicit eager
   loading only for a gallery actually used above the fold.
   Confirmed: `src/app/(marketing)/team/page.tsx:26-31` uses five desktop columns
   but advertises each image as `25vw`; the section is capped at `max-w-6xl`
   (`src/components/marketing-section.tsx:32-35`). Supply sizes matching the
   five-column width, gaps, padding, and container cap. The fixed `38rem` gallery
   hint also exceeds its `max-w-xl` slide cap (`photo-carousel.tsx:44-50`).
   Expected benefit: fewer early image requests and smaller selected derivatives;
   actual transferred bytes and LCP effect require a network trace.

2. **Bound project RPC latency before fallback.**
   Confirmed: `src/lib/projects/public-projects.ts:15-24` creates a separate
   Supabase client without `global.fetch: fetchWithDeadline`; its awaited RPC
   (`:58-69`) reaches fallback only after the request errors or throws.
   The existing public client already supplies that deadline
   (`src/lib/supabase/public.ts:6-11`; `src/lib/supabase/timeout.ts:6-17`).
   Reuse the bounded client while preserving the existing local-content fallback.
   `/work` awaits this RPC before returning its page (`src/app/(marketing)/work/page.tsx:32-35`);
   project static params and metadata also call the loader
   (`src/app/(marketing)/work/[slug]/page.tsx:17-23`).
   Expected benefit: bounded waiting during dependency failure, especially during
   prerendering; this is not evidence that every cached visit hits Supabase.

3. **Reduce auth work in the public shell after profiling.**
   Confirmed architecture: when Clerk is configured, the root layout wraps all
   routes in `ClerkProvider` and mounts `SessionKeepalive`
   (`src/app/layout.tsx:46-62`). The entire public header is a client component
   importing Clerk hooks (`src/components/site-header.tsx:1-7`), although most
   of its content is static navigation. Keepalive registers three wake listeners
   (`src/components/session-keepalive.tsx:10-23`).
   Profile an anonymous production visit, then consider a server-rendered header
   with small menu/auth islands and route-scoped auth infrastructure. Preserve
   signed-in navigation and wake-refresh behavior wherever sessions are used.
   Bundle size and CPU savings are hypotheses, not measured defects; moving a
   provider alone does not remove Clerk while the header still imports its hooks.

## Other hypotheses and safeguards

- `next.config.ts` redirects `/` to `/home`: an extra initial navigation for root
  arrivals. Measure its contribution before changing canonical URLs or routing.
- Project metadata and body both load projects (`work/[slug]/page.tsx:23,50`).
  Check actual RPC counts before adding memoization; no duplicate-call timing was measured.
- Sticky header blur (`site-header.tsx:75`) could increase scroll paint cost on
  slower phones; inspect a performance trace before removing the treatment.
- Preserve existing strengths: homepage hero has `preload` and `sizes="100vw"`
  (`home/page.tsx:35-41`); image wrappers reserve aspect ratios; public recruitment
  pages declare 60-second revalidation (`home/page.tsx:10`, `join/page.tsx:25`).
- Marketing bypasses Clerk middleware (`src/proxy.ts:83-98`); do not report an
  auth-server round trip on every marketing request. No such trace was collected.
- Verify changes with a production build: cold/warm anonymous requests to `/`,
  `/home`, `/team`, `/join`, `/work`, and one case study; inspect cache headers,
  image request widths/bytes, JS chunks, LCP element, and scroll/interaction work.
