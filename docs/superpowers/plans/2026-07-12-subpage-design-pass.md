# Subpage Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real company logos to the client-services grid, replace the static recruitment-events grid with an interactive scroll-scrubbed timeline (reused in miniature on client-services), and apply smaller polish to about/our-team/contact — all inside the existing GSAP/Lenis motion system and navy/orange design tokens, no new dependencies.

**Architecture:** One new shared `Timeline` component (two render variants: `scroll` and `static`) backed by one new declarative motion primitive (`[data-timeline]`) added to the existing centralized `MotionProvider.tsx`. Company logos are plain static assets referenced from `src/lib/site-content.ts`, rendered with `next/image`. All other changes are page-local markup/CSS edits.

**Tech Stack:** Next.js (App Router), Tailwind v4 (`app/globals.css` `@theme`), GSAP + ScrollTrigger + SplitText + Lenis (`app/(external)/components/MotionProvider.tsx`), `next/image`. No new packages.

## Global Constraints

- No new npm dependencies. `sharp` is only an **optional** transitive dependency of `next` (see `package-lock.json` — `next`'s `optionalDependencies`), not a declared project dependency; do not `import` it. Logo visual consistency is handled with CSS (`object-contain` in a fixed, padded, light chip), not an offline image-processing script.
- Dark navy/orange theme only — no light/dark mode branching anywhere in this plan.
- Do not touch `app/internal`, `app/portal`, `app/apply`, `app/auth`, or `app/(external)/trek` / `app/(external)/socials`. Out of scope per the approved design spec (`docs/superpowers/specs/2026-07-12-subpage-design-pass-design.md`).
- Do not fabricate data. Every figure, date, or fact rendered must trace to `src/lib/site-content.ts`, `src/lib/team-members.json`, or existing page copy. If a company logo can't be found, the client card falls back to its current no-logo treatment — never a broken image, never a placeholder mark standing in for a real company.
- **No test framework exists in this repo** (no jest/vitest/playwright — confirmed via `package.json` scripts and a repo-wide search for `*.test.*`/`*.spec.*`). Per-task verification is: `npm run lint`, and where noted `npm run build`, plus a manual check in `npm run dev` described in the task. Do not add a test framework as part of this plan.
- Every new interactive/motion primitive must degrade to a valid static state under `prefers-reduced-motion: reduce` and no-JS — this is the existing site-wide contract documented at the top of `MotionProvider.tsx`. Don't break it.

---

### Task 1: Fix pre-existing CSS typos on the contact page

**Files:**
- Modify: `app/(external)/contact/page.tsx:10` and `app/(external)/contact/page.tsx:32`

**Interfaces:** None — self-contained, no dependents.

- [ ] **Step 1: Fix the broken two-column grid class**

In `app/(external)/contact/page.tsx`, line 32 currently reads:

```tsx
        <div className="container grid gap-5 lg:grid-col.15fr_0.85fr]">
```

Change to:

```tsx
        <div className="container grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
```

- [ ] **Step 2: Fix the broken focus-state class**

Line 10 currently reads:

```tsx
const inputClasses =
  "focus-ring w-full rounded-[0.85rem] border border-white/12 bg-white/[0.045] px-5 py-4 text-base text-white placeholder:text-white/35 outline-none transition-colors cus:border-[var(--orange)]/70";
```

Change `cus:border-` to `focus:border-`:

```tsx
const inputClasses =
  "focus-ring w-full rounded-[0.85rem] border border-white/12 bg-white/[0.045] px-5 py-4 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--orange)]/70";
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors.

Run `npm run dev`, open `/contact`. Confirm the form and the "Direct line"/"Elsewhere" cards render as two columns on a viewport ≥1024px wide, and that clicking into any input shows an orange focus border.

- [ ] **Step 4: Commit**

```bash
git add app/\(external\)/contact/page.tsx
git commit -m "fix(contact): correct grid-cols and focus-state class typos"
```

---

### Task 2: Add timeline CSS primitives

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: CSS classes `.timeline-marker`, `.timeline-node-dot`, `.timeline-node--active`, and attribute selector `[data-timeline-track]` — consumed by the `Timeline` component (Task 4) and the `MotionProvider` timeline logic (Task 3).

- [ ] **Step 1: Insert the timeline CSS block**

In `app/globals.css`, find this existing block (ends at line 276):

```css
.gear-svg {
  animation: spin 28s linear infinite;
  transform-origin: 50% 50%;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

Insert immediately after it (before the `/* Scroll reveals (DS-39b/c) ... */` comment):

```css

/* Interactive timeline — vertical (scroll-scrubbed) or horizontal (static)
 * rail with nodes, always rendered on `.sheet` (paper) sections. Marker
 * travel + node fill are driven by [data-timeline] in MotionProvider.tsx.
 * Under reduced motion / no-JS, [data-timeline]'s ScrollTriggers never run
 * (gated the same way as every other primitive in MotionProvider), so nodes
 * simply render in their default unfilled-ring state — never broken. */
[data-timeline-track] {
  background: var(--paper-rule);
  border-radius: 1px;
}

.timeline-marker {
  position: absolute;
  top: 0;
  left: 50%;
  width: 0.65rem;
  height: 0.65rem;
  margin-left: -0.325rem;
  border-radius: 50%;
  background: var(--orange);
  box-shadow: 0 0 14px rgba(245, 130, 58, 0.55);
}

.timeline-node-dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  border: 2px solid var(--paper-rule);
  background: var(--paper);
  transition: background 0.3s ease, border-color 0.3s ease;
}

.timeline-node--active .timeline-node-dot,
.timeline-node-dot.timeline-node--active {
  background: var(--orange);
  border-color: var(--orange);
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no new errors (this is a CSS-only change; lint covers JS/TS, so this step mainly confirms the file wasn't left in a broken state — follow with a build).

Run: `npm run build`
Expected: build succeeds (confirms `app/globals.css` still parses under Tailwind v4).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(styles): add interactive-timeline CSS primitives"
```

---

### Task 3: Add scroll-scrubbed timeline behavior to MotionProvider

**Files:**
- Modify: `app/(external)/components/MotionProvider.tsx`

**Interfaces:**
- Consumes: CSS classes from Task 2 (`.timeline-marker`, `.timeline-node--active`).
- Produces: declarative attribute contract `[data-timeline]` (container), `[data-timeline-track]` (rail element, must be `position: relative` and contain a `[data-timeline-marker]` child), `[data-timeline-marker]` (the traveling dot), `[data-timeline-node]` (each node, gains `.timeline-node--active` as the scroll marker passes it). Consumed by the `Timeline` component in Task 4.

- [ ] **Step 1: Add the timeline block to MotionProvider's `mm.add` callback**

In `app/(external)/components/MotionProvider.tsx`, find this existing block (ends at line 199):

```tsx
      // Parallax drift — scrubbed, fraction of viewport height.
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const amount = parseFloat(el.dataset.parallax || "0.15");
        gsap.fromTo(
          el,
          { y: () => amount * window.innerHeight * 0.5 },
          {
            y: () => -amount * window.innerHeight * 0.5,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });
```

Insert immediately after it (before the `// Stat roll-ups` comment):

```tsx

      // Interactive timeline: the marker travels down [data-timeline-track]
      // scrubbed to the container's scroll position; each [data-timeline-node]
      // gains .timeline-node--active as it crosses viewport center.
      document.querySelectorAll<HTMLElement>("[data-timeline]").forEach((container) => {
        const track = container.querySelector<HTMLElement>("[data-timeline-track]");
        const marker = container.querySelector<HTMLElement>("[data-timeline-marker]");
        const nodes = container.querySelectorAll<HTMLElement>("[data-timeline-node]");
        if (!track || !marker) return;

        const setY = gsap.quickSetter(marker, "y", "px");
        ScrollTrigger.create({
          trigger: container,
          start: "top center",
          end: "bottom center",
          scrub: true,
          onUpdate: (self) => {
            setY(self.progress * Math.max(track.offsetHeight - marker.offsetHeight, 0));
          },
        });

        nodes.forEach((node) => {
          ScrollTrigger.create({
            trigger: node,
            start: "top center",
            toggleClass: { targets: node, className: "timeline-node--active" },
          });
        });
      });
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/\(external\)/components/MotionProvider.tsx
git commit -m "feat(motion): add data-timeline scroll-scrub primitive"
```

---

### Task 4: Build the shared Timeline component

**Files:**
- Create: `app/(external)/components/Timeline.tsx`

**Interfaces:**
- Consumes: `[data-timeline]` contract from Task 3; CSS classes from Task 2.
- Produces: `export type TimelineItem = { id: string; index: string; title: string; meta?: string; body: string }` and `export function Timeline({ items, variant }: { items: TimelineItem[]; variant: "scroll" | "static" })`. Consumed by Task 5 (`prospective-members`) and Task 6 (`client-services`).

- [ ] **Step 1: Write the component**

Create `app/(external)/components/Timeline.tsx`:

```tsx
export type TimelineItem = {
  id: string;
  index: string;
  title: string;
  meta?: string;
  body: string;
};

export function Timeline({
  items,
  variant,
}: {
  items: TimelineItem[];
  variant: "scroll" | "static";
}) {
  if (variant === "static") {
    return (
      <div className="grid gap-10 md:grid-cols-4" data-reveal-group>
        {items.map((item) => (
          <article key={item.id} className="relative" data-reveal>
            <span className="timeline-node-dot timeline-node--active mb-5 inline-block" aria-hidden="true" />
            <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
              {item.index}
            </p>
            <h3 className="font-display mt-4 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
              {item.title}
            </h3>
            <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2px_1fr] gap-7" data-timeline>
      <div className="relative" data-timeline-track>
        <div className="timeline-marker" data-timeline-marker aria-hidden="true" />
      </div>

      <ol className="grid gap-8" data-reveal-group>
        {items.map((item) => (
          <li key={item.id} data-timeline-node data-reveal>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-3">
                <span className="timeline-node-dot" aria-hidden="true" />
                <span className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                  {item.index}
                </span>
                <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-[var(--navy-950)] md:text-2xl">
                  {item.title}
                </span>
              </summary>
              {item.meta ? (
                <p className="mt-2 pl-[1.6rem] text-sm font-bold uppercase tracking-[0.12em] text-[var(--on-paper-muted)]">
                  {item.meta}
                </p>
              ) : null}
              <p className="mt-3 pl-[1.6rem] leading-relaxed text-[var(--on-paper-muted)]">
                {item.body}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(external\)/components/Timeline.tsx
git commit -m "feat(components): add shared Timeline component (scroll + static variants)"
```

---

### Task 5: Wire the interactive timeline into prospective-members

**Files:**
- Modify: `app/(external)/prospective-members/page.tsx:1-71`

**Interfaces:**
- Consumes: `Timeline`, `TimelineItem` from Task 4; `recruitmentEvents` from `src/lib/site-content.ts` (existing, fields `code`, `title`, `type`, `date`, `time`, `location`, `body`).

- [ ] **Step 1: Replace the static recruitment-events grid**

In `app/(external)/prospective-members/page.tsx`, add the import:

```tsx
import { Timeline } from "../components/Timeline";
```

Replace the whole "Recruitment Timeline" `<section>` (currently lines 44-71):

```tsx
      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Recruitment Timeline
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            Meet us. Apply. Interview.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-reveal-group>
            {recruitmentEvents.map((event) => (
              <article key={event.code} className="rounded-[1rem] border border-[var(--paper-rule)] p-6" data-reveal>
                <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                  {event.code} — {event.type}
                </p>
                <h3 className="font-disay mt-5 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {event.title}
                </h3>
                <p className="mt-3 text-sm font-bold uppercase tracking-[0.12em] text-[var(--on-paper-muted)]">
                  {event.date} · {event.time}
                </p>
                <p className="mt-2 text-sm text-[var(--on-paper-muted)]">{event.location}</p>
                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">{event.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
```

with:

```tsx
      <section className="sheet px-5 py-20 md:px-8 md:py-28">
        <div className="container">
          <p className="annotation !text-[rgba(5,9,20,0.45)]" data-reveal>
            Recruitment Timeline
          </p>
          <h2 className="display mt-5 max-w-4xl text-5xl uppercase text-[var(--navy-950)] md:text-7xl" data-split>
            Meet us. Apply. Interview.
          </h2>

          <div className="mt-12 max-w-3xl">
            <Timeline
              variant="scroll"
              items={recruitmentEvents.map((event) => ({
                id: event.code,
                index: event.code,
                title: event.title,
                meta: `${event.type} · ${event.date} · ${event.time}`,
                body: `${event.location}. ${event.body}`,
              }))}
            />
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new errors (in particular, confirm `recruitmentEvents` is still imported at the top of the file — it already is, alongside `faqs`).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `/prospective-members`. Scroll through the "Recruitment Timeline" section. Confirm: a vertical rail with a traveling marker dot appears to the left of the event list, each event's dot fills orange as it's scrolled past, and clicking an event's title expands its type/date/time/location/body.

- [ ] **Step 4: Commit**

```bash
git add app/\(external\)/prospective-members/page.tsx
git commit -m "feat(prospective-members): replace static event grid with interactive timeline"
```

---

### Task 6: Apply the mini timeline to client-services' project timeline

**Files:**
- Modify: `app/(external)/client-services/page.tsx:1-95`

**Interfaces:**
- Consumes: `Timeline`, `TimelineItem` from Task 4; `projectTimeline` from `src/lib/site-content.ts` (existing, fields `step`, `title`, `body`).

- [ ] **Step 1: Replace the projectTimeline grid**

In `app/(external)/client-services/page.tsx`, add the import:

```tsx
import { Timeline } from "../components/Timeline";
```

Replace this block (currently lines 73-95):

```tsx
          <div className="mt-14 grid gap-10 md:grid-cols-4" data-reveal-group>
            {projectTimeline.map((item, i) => (
              <article key={item.step} className="relative" data-reveal>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                    Step {item.step}
                  </p>

                  {i < projectTimeline.length - 1 ? (
                    <span className="dim-rule hidden flex-1 !bg-[var(--paper-rule)] md:block" />
                  ) : null}
                </div>

                <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
                  {item.title}
              </h3>

                <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
```

with:

```tsx
          <div className="mt-14">
            <Timeline
              variant="static"
              items={projectTimeline.map((item) => ({
                id: item.step,
                index: `Step ${item.step}`,
                title: item.title,
                body: item.body,
              }))}
            />
          </div>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no new errors. Confirm `projectTimeline` is still imported (it already is, in the existing `@/lib/site-content` import at the top of the file).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `/client-services`. Confirm the "From first call to final deliverable" section shows 4 steps in a row (desktop) with a filled dot above each, and the `projectExpectations` grid directly below is unaffected.

- [ ] **Step 4: Commit**

```bash
git add app/\(external\)/client-services/page.tsx
git commit -m "feat(client-services): apply shared timeline component to project steps"
```

---

### Task 7: Source and add real company logos to the client grid

**Files:**
- Modify: `src/lib/site-content.ts:111-129` (the `clients` array)
- Modify: `app/(external)/client-services/page.tsx` (client card markup)
- Create: `public/images/clients/<slug>.<ext>` — one file per company a usable logo was found for
- Create: `public/images/clients/SOURCES.md` — traceability manifest

This task is research-heavy (17 independent lookups) rather than deterministic code — the exact image URLs can't be known until each company is looked up live. What's fixed and non-negotiable: the output path convention, the fallback rule, and the manifest format below.

**Interfaces:** None — self-contained (the grid rendering in Step 3 only depends on `clients`, already imported in `client-services/page.tsx`).

- [ ] **Step 1: Source one logo per company**

The 17 entries (from `src/lib/site-content.ts`, `clients`): Amstron, General Motors, LSX, Koops Automation, Gypsy Spirits, Here Here Market, Red Hawk Golf Club, Glo Skin Spa, Legendary Sports Xperiences, Lynkr, Frankel Jewish Academy, Dani Plan, Fired and Fused, The Probate Pro, Michigan Creamery, Homeschool Connections, The Store House.

For each company:
1. Find its official website (or, failing that, a verifiable press/brand-kit page) via web search.
2. Locate a clean logo image on that site — prefer SVG or a transparent-background PNG at reasonable resolution; avoid screenshots, favicons under 64px, or low-quality social-media exports.
3. Download it to `public/images/clients/source/<slug>.<ext>`, where `<slug>` is the company name lowercased, spaces/punctuation replaced with `-` (e.g. "Legendary Sports Xperiences" → `legendary-sports-xperiences`, "General Motors" → `general-motors`).
4. If no clean, confidently-attributable logo can be found after a reasonable search, skip — do not use a stock/generic mark, do not guess.
5. Append one line to `public/images/clients/SOURCES.md` (create the file with a `# Client logo sources` heading if it doesn't exist yet) recording the outcome:
   ```
   - General Motors — public/images/clients/general-motors.svg — sourced from https://<official-url>
   - Fired and Fused — no usable logo found, falls back to typographic card
   ```

- [ ] **Step 2: Add the `logo` field to `clients`**

For every company where Step 1 found a usable logo, edit its entry in `src/lib/site-content.ts` (`clients`, lines 111-129) to add a `logo` field pointing at the public path (note: the asset lives at `public/images/clients/<slug>.<ext>`, which Next.js serves at `/images/clients/<slug>.<ext>`):

```ts
export const clients = [
  { name: "Amstron", term: "Past Project", logo: "/images/clients/amstron.svg" },
  { name: "General Motors", term: "Past Project", logo: "/images/clients/general-motors.svg" },
  { name: "LSX", term: "Past Project" },
  // ...one line per entry; omit `logo` entirely for any company Step 1 skipped
];
```

Do not add empty/placeholder `logo` fields for skipped companies — omit the key entirely, matching the existing optional-field pattern used elsewhere in this file (e.g. `TeamMember.image` in `our-team/page.tsx`).

- [ ] **Step 3: Render the logo in the client grid**

In `app/(external)/client-services/page.tsx`, add the import:

```tsx
import Image from "next/image";
```

Replace the client card block (currently lines 141-157):

```tsx
            {clients.map((client, index) => (
              <article
                key={client.name}
                className="panel card-hover rounded-[1.35rem] p-6"
                data-reveal
              >
                <p className="font-mono text-sm font-bold text-[var(--orange)]">
                  {String(index + 1).padStart(2, "0")}
                </p>

                <p className="annotation mt-10">{client.term}</p>

                <h3 className="font-display mt-3 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {client.name}
                </h3>
              </article>
            ))}
```

with:

```tsx
            {clients.map((client, index) => (
              <article
                key={client.name}
                className="group panel card-hover rounded-[1.35rem] p-6"
                data-reveal
              >
                {client.logo ? (
                  <div className="relative h-16 w-full overflow-hidden rounded-[0.85rem] bg-white/92 p-3">
                    <Image
                      src={client.logo}
                      alt={`${client.name} logo`}
                      fill
                      sizes="200px"
                      className="object-contain grayscale transition duration-300 group-hover:grayscale-0"
                    />
                  </div>
                ) : (
                  <p className="font-mono text-sm font-bold text-[var(--orange)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                )}

                <p className="annotation mt-10">{client.term}</p>

                <h3 className="font-display mt-3 text-2xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {client.name}
                </h3>
              </article>
            ))}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds — this also validates every `client.logo` path resolves to a real file under `public/images/clients/` (a missing file won't fail the build, since these are plain `<img>`-backed static paths, so also visually confirm in Step 5).

- [ ] **Step 5: Manual check**

Run `npm run dev`, open `/client-services`, scroll to "Client-facing experience." Confirm: every company with a sourced logo shows it on a light chip, grayscale by default, full color on hover; every company without one still shows its original numbered-index card exactly as before (no broken images, no layout gaps).

- [ ] **Step 6: Commit**

```bash
git add src/lib/site-content.ts "app/(external)/client-services/page.tsx" public/images/clients
git commit -m "feat(client-services): add sourced company logos to the client grid"
```

---

### Task 8: Add a stats strip to the about page

**Files:**
- Modify: `app/(external)/about/page.tsx:1-83`

**Interfaces:**
- Consumes: `clients` from `src/lib/site-content.ts` (for `clients.length`); `data-counter` primitive (already implemented in `MotionProvider.tsx`, unused elsewhere in the codebase until now).

- [ ] **Step 1: Add the import and stats section**

In `app/(external)/about/page.tsx`, add the import alongside the existing `Image` import:

```tsx
import Image from "next/image";
import { clients } from "@/lib/site-content";
```

Insert a new `<section>` immediately after the closing `</section>` of the "Four Pillars" block (currently ending at line 83) and before the President's Welcome section (currently starting at line 85):

```tsx
      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <div className="grid gap-8 rounded-[1.5rem] border border-white/10 bg-[#122033]/60 p-8 sm:grid-cols-2 md:p-10">
          <div data-reveal>
            <p className="stat text-5xl font-black text-white md:text-6xl" data-counter>
              {clients.length}+
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
              Client projects delivered
            </p>
          </div>
          <div data-reveal>
            <p className="stat text-5xl font-black text-white md:text-6xl">2023</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
              Founded
            </p>
          </div>
        </div>
      </section>
```

Note: only the first stat uses `data-counter` (numeric roll-up 0 → 17, keeping the `+` suffix, per the existing regex in `MotionProvider.tsx`: `/^([\d,]+)(.*)$/`). The founding year is rendered as plain static text, not `data-counter` — `MotionProvider`'s roll-up formats the animated number with `toLocaleString("en-US")`, which would render "2,023" (thousands separator) instead of "2023" for a 4-digit non-quantity value.

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `/about`. Scroll to just below the Four Pillars grid. Confirm a two-stat strip appears, and "17+" animates up from 0 the first time it scrolls into view (reload the page to see it fresh), while "2023" appears as plain static text without animating or gaining a comma.

- [ ] **Step 4: Commit**

```bash
git add app/\(external\)/about/page.tsx
git commit -m "feat(about): add stats strip using the existing data-counter primitive"
```

---

### Task 9: Add sticky section-jump tabs to our-team

**Files:**
- Modify: `app/(external)/our-team/page.tsx:14-96`

**Interfaces:** None — self-contained (uses native anchor links + `scroll-behavior: smooth`, already global in `app/globals.css:147`; no new client-side JS).

- [ ] **Step 1: Add a `slug` to each section definition**

In `app/(external)/our-team/page.tsx`, replace the `sections` array (currently lines 14-41):

```tsx
const sections = [
  {
    title: "Executive Board",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("president") || role.includes("vp");
    }),
  },
  {
    title: "Project Managers",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("project manager") && !role.includes("assistant");
    }),
  },
  {
    title: "Assistant Project Managers",
    people: people.filter((person) => person.role.toLowerCase().includes("assistant project manager")),
  },
  {
    title: "Strategic Leads",
    people: people.filter((person) => person.role.toLowerCase().includes("strategic lead")),
  },
  {
    title: "Analysts",
    people: people.filter((person) => person.role.toLowerCase().includes("analyst")),
  },
];
```

with:

```tsx
const sections = [
  {
    title: "Executive Board",
    slug: "executive-board",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("president") || role.includes("vp");
    }),
  },
  {
    title: "Project Managers",
    slug: "project-managers",
    people: people.filter((person) => {
      const role = person.role.toLowerCase();
      return role.includes("project manager") && !role.includes("assistant");
    }),
  },
  {
    title: "Assistant Project Managers",
    slug: "assistant-project-managers",
    people: people.filter((person) => person.role.toLowerCase().includes("assistant project manager")),
  },
  {
    title: "Strategic Leads",
    slug: "strategic-leads",
    people: people.filter((person) => person.role.toLowerCase().includes("strategic lead")),
  },
  {
    title: "Analysts",
    slug: "analysts",
    people: people.filter((person) => person.role.toLowerCase().includes("analyst")),
  },
];
```

- [ ] **Step 2: Add the tab nav and wire section ids**

Replace `OurTeamPage` (currently lines 71-96):

```tsx
export default function OurTeamPage() {
  return (
    <main className="grid gap-16 pb-16 pt-24 md:pt-32">
      

      {sections.map((section, index) =>
        section.people.length > 0 ? (
          <section key={section.title} className="mx-auto w-full max-w-7xl px-6 md:px-16">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
              Fig. {String(index + 1).padStart(2, "0")} — {section.title}
            </p>
            <h2 className="font-display mt-5 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
              {section.title}
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {section.people.map((member) => (
                <MemberCard key={`${member.name}-${member.role}`} member={member} />
              ))}
            </div>
          </section>
        ) : null
      )}
    </main>
  );
}
```

with:

```tsx
export default function OurTeamPage() {
  const visibleSections = sections.filter((section) => section.people.length > 0);

  return (
    <main className="grid gap-16 pb-16 pt-24 md:pt-32">
      {visibleSections.length > 1 ? (
        <nav
          aria-label="Jump to section"
          className="sticky top-20 z-30 mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-6 md:px-16"
        >
          {visibleSections.map((section) => (
            <a
              key={section.slug}
              href={`#${section.slug}`}
              className="focus-ring rounded-full border border-white/10 bg-[#0c1626]/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/60 backdrop-blur-md transition hover:border-[var(--orange)]/45 hover:text-white"
            >
              {section.title}
            </a>
          ))}
        </nav>
      ) : null}

      {visibleSections.map((section, index) => (
        <section
          key={section.title}
          id={section.slug}
          className="mx-auto w-full max-w-7xl scroll-mt-28 px-6 md:px-16"
        >
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
            Fig. {String(index + 1).padStart(2, "0")} — {section.title}
          </p>
          <h2 className="font-display mt-5 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
            {section.title}
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.people.map((member) => (
              <MemberCard key={`${member.name}-${member.role}`} member={member} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/our-team`. Confirm a row of pill tabs appears below the header and stays pinned while scrolling; clicking a tab smooth-scrolls to that section without the fixed site header covering its heading.

- [ ] **Step 5: Commit**

```bash
git add app/\(external\)/our-team/page.tsx
git commit -m "feat(our-team): add sticky section-jump tabs"
```

---

## Task Order & Dependencies

1 (independent) → 2 → 3 → 4 (needs 2, 3) → 5, 6 (each needs 4; independent of each other) → 7 (independent of 2-6) → 8 (independent) → 9 (independent).

Tasks 1, 7, 8, 9 have no dependency on the timeline work and can run in parallel with it. Tasks 5 and 6 both depend on Task 4 but not on each other.
