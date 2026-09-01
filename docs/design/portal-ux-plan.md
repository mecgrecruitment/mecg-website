# Portal UI/UX plan — admin, member, applicant

Scope: the authenticated portal (`src/app/admin`, `src/app/member`, `src/app/applicant`, `src/app/apply`, `src/app/checkin`, auth screens) plus the shared design system it sits on (`src/app/globals.css`, `src/components/*`). Marketing pages excluded — they already conform to `docs/DESIGN.md`.

Method: six read-only design/a11y reviews run in parallel against the real code and `docs/DESIGN.md`, cross-checked against an inventory of every admin API route, DB column, and RPC actually available, so "usefulness" claims below are backed by data and endpoints that exist today, not guesses. No code was changed producing this plan.

Every item below has a `file:line` citation in the six source reviews. This document is the merged, deduplicated, prioritized version. Effort tags: S (under a day), M (a few days), L (a week+).

---

## 1. The one root cause behind a third of these findings

`src/components/section-label.tsx:2` throws away its `number` prop (`void number`) and renders a plain sans `<p>` instead of the mono `NN / LABEL` grammar `docs/DESIGN.md` §1.6 calls mandatory on every section of every page. All 12 real call sites in the app render non-compliant output today. Fix this one component first — it's a single-file, mechanical change, and it's a prerequisite for half the "add a SectionLabel" recommendations spread across every other section of this plan.

```tsx
// src/components/section-label.tsx
export default function SectionLabel({ number, children, className = "" }: { number: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}>
      <span className="text-mecg-orange-ink">{number}</span> / {children}
    </p>
  );
}
```
(On a dark surface, the number span should use `text-mecg-orange` instead — thread a `dark?: boolean` prop or let the caller override via `className`.)

---

## 2. Foundation layer — do before touching individual pages

These are cross-cutting fixes in `globals.css` and the shared components. Doing them first means every downstream page fix in sections 4-7 lands on a corrected substrate instead of needing a second pass later.

### 2.1 Focus ring contrast — BLOCKER, WCAG 1.4.11 / 2.4.13
`globals.css:60-67` sets a global `outline: 2px solid #fe904d` on every focusable element, and `.field-control:focus` (`globals.css:146-148`), `form-field.tsx:25`, `apply/application-form.tsx:24`, `member/evaluation-form.tsx:151,165`, `admin/pipeline-board.tsx:253` all reuse raw orange as a focus box-shadow. Measured: **2.25:1 against white/paper/`#f5f4ef`**, against a 3:1 floor for non-text UI. This is the same failing ratio `docs/DESIGN.md` already bans for orange *text* — nobody checked it for the focus ring. On navy it's fine (8.57:1).
**Fix:** on light surfaces, swap to `var(--color-mecg-orange-ink)` (6.25:1) or a double ring (`box-shadow: 0 0 0 2px white, 0 0 0 4px var(--color-mecg-orange-ink)`). Keep raw orange only on navy surfaces. **[M]**

### 2.2 Navy/white alpha floor is routinely undercut
`docs/DESIGN.md` claims `navy/60` on white and `white/55` on navy as floors. Measured reality: `navy/60` does pass (5.11:1) but 189 occurrences across 20+ files use `/35`-`/55`, all between 2.31:1 and 4.30:1 — below the 4.5:1 requirement. Worst offenders: `form-field.tsx:18` (Required tag, 2.67:1), `admin/applications/[id]/page.tsx:109-158` (24 field labels, 3.11:1), `portal-shell.tsx:34,66,125` (nav links, 4.30:1, a near-miss). On navy, `white/45` (used at `admin/page.tsx:174`, `member/page.tsx:141`) measures exactly 4.50:1 — no margin — and `white/35` (`portal-shell.tsx:114`) is 3.16:1, a real fail.
**Fix:** bulk-replace `/35`, `/40`, `/45`, `/50` to `/60`+ on white; on the two tinted backgrounds (`#f5f4ef`, `#f4f1ec`) `/60` only clears by 0.4-0.5, so standardize on `/65` there. On navy, treat `white/50` as the real floor, not `/45`. This is mostly mechanical find-and-replace. **[L]**

### 2.3 `docs/DESIGN.md` amendments (write these once, then the rest of the plan cites a doc that's actually true)
- §2 a11y floors: change "text on white >= navy/60" to also state the tinted-surface floor is `/65`; change "text on navy >= white/55" to `white/50` as the real minimum.
- §1.2: extend "never raw orange text on light background" to also cover "or raw orange as a focus indicator on a light surface" — specify `mecg-orange-ink` for light-surface focus rings.
- §1.9/§2: document the portal's own container as a recorded exception, not a violation:
  > Portal container: `max-w-7xl` (`PortalShell`, `WorkspaceLoading`/`WorkspaceError`, every `/admin`, `/member`, `/apply` shell). Distinct from marketing's `max-w-6xl px-6`; not a violation.
- §1.9/§1.10: document the portal's elevated outer card as a recorded exception rather than forcing conformance (see 2.4 below) — add:
  > Portal auth/workspace outer cards (`portal-shell.tsx`, `workspace-state.tsx`, `/apply`, `/applicant`) are the one documented exception: `rounded-[28px]` with `shadow-[0_24px_80px_rgba(7,13,31,0.09),inset_0_0_0_1px_rgba(7,13,31,0.05)]`, centralized as a single utility class — reserved for the single outermost card of a full-bleed auth/workspace screen. Content cards inside a workspace stay `rounded-2xl` and hairline per rule 10.
**[S, but judgment-heavy — this is doc-writing]**

### 2.4 The `rounded-[28px]` + heavy-shadow card, decided
8 sites duplicate the identical string `shadow-[0_24px_80px_rgba(7,13,31,0.09),inset_0_0_0_1px_rgba(7,13,31,0.05)]` + `rounded-[28px]`: `portal-shell.tsx:77,132`, `workspace-state.tsx:33`, `apply/loading.tsx:4`, `apply/error.tsx:12`, `apply/application-form.tsx:318`, `apply/page.tsx:143`, `applicant/error.tsx:12`. Recommendation from the design-system review: **keep the visual, stop the duplication.** Forcing these down to `rounded-2xl` would visibly shrink the single highest-visibility surface class (login, apply, workspace loading/error) for no functional gain, and `.surface-card` — the doc's nominal answer — has zero real consumers to defend. Fold the repeated string into one class (retire or repurpose `.surface-card`) and record it as the documented exception in 2.3. **[M, mechanical]**

Also apply while touching this class: `member/page.tsx:120,226` use a different but same-species violation, `rounded-[22px]` + `shadow-[0_18px_50px_rgba(7,13,31,0.16)]` — bring these onto the same consolidated class or drop to `rounded-2xl` + `ring-1 ring-white/12` (it's a navy surface, not the light outer-card case). `admin/page.tsx:158` and `admin/pipeline-board.tsx:325` also carry stray oversized radii — same fix.

### 2.5 Hardcoded hex outside `globals.css`
9 files leak raw hex that duplicate or invent tokens: `#f5f4ef` (9x — this is the portal background and isn't a `@theme` token at all despite being used everywhere), `#111a32` (2x, `admin/page.tsx:146`, `member/page.tsx:146` — unnamed "raised navy" surface), plus stray restatements of `#fe904d`/`#070d1f`. **Fix:** add `--color-mecg-paper-workspace: #f5f4ef` (or similar) to the `@theme` block since it's load-bearing across the entire portal shell and deserves a name; for `#111a32`, either add `--color-mecg-navy-raised` (justified — the dashboard needs a second dark plane and no token provides one) or replace with `bg-white/[0.04]`/`bg-white/5` layered on the navy parent (no new token, recommended default). **[S/M]**

### 2.6 Motion vocabulary — extend, don't add tokens
The three existing tokens (`--t-detent` 150ms, `--t-shift` 420ms, `--t-seat` 700ms) already cover every interaction surface found in the portal once mapped explicitly:

| Interaction | Token | What it communicates |
|---|---|---|
| Button press, field focus, row hover, panel/tab change, status-pill swap | `--t-detent` | Same element changed state |
| View toggle (list <-> pipeline), filtered result swap, form step change | `--t-shift` | Same dataset, re-cut or advanced |
| Notice/toast entry, skeleton to content | `--t-shift`, opacity+translate | Something new arrived |
| List reorder (pipeline board drag) | `--t-shift` w/ `--ease-seat` | Judgment-heavy (FLIP-style), low priority |
| Route/page transition | View Transitions API, feature-detected, no-op fallback | Zero-dependency native option; Chrome/Edge/Safari 18+, no Firefox yet |

Concrete gaps to close: `pill-nav.tsx:44` uses `duration-200` (untokenized near-miss of `--t-detent`) — correct to `duration-[--t-detent] ease-[--ease-detent]`, drop the indicator's decorative shadow. `pill-nav.tsx:59` uses bare `duration-150 ease-out` — same fix, reference the token. `pipeline-board.tsx:264,272` use unnamed `transition-colors` — add the token. `OperationNotice` currently has zero transition on entry despite being a state-change component — give it `--t-shift` opacity+translate.

**Reduced motion is already a single global kill-switch** (`globals.css:246-259`, `*,*::before,*::after` forced to `0.01ms`) — stronger than most of the per-component `motion-reduce:` classes scattered around, which are redundant. Two files are the real gap: `applicant/loading.tsx:4` and `apply/loading.tsx:4` use `animate-pulse` with **no** `motion-reduce:animate-none` guard (their sibling `workspace-state.tsx:6,7,10` has it). This is also a literal violation of the doc's own "nothing loops" rule, not just an a11y nit. **[S]**

Also replace `animate-pulse` (a loop) in `workspace-state.tsx:6,7,10` itself with a static `bg-mecg-navy/[0.06]` block — DESIGN.md explicitly bans looping decorative animation; the global reduced-motion rule papers over it for some users but the rule shouldn't need papering over. **[S]**

### 2.7 Missing primitives (3+ duplicated call sites each — build these, nothing more speculative)
- **StatTile** — `font-mono text-2xl font-semibold tabular-nums` value + label. 5 sites: `member/page.tsx:140`, `admin/round-board.tsx:107`, `admin/hash/page.tsx:134`, `admin/page.tsx:173`, `admin/groups/group-forms.tsx:175`.
- **StatusPill** — tone-driven mono chip. 10+ sites across `round-board.tsx`, `pipeline-board.tsx`, `hash/page.tsx`, `groups/group-forms.tsx`, `applications/[id]/page.tsx`, `screening/page.tsx`, `member/page.tsx`.
- **SegmentedControl** — the toggle-button pattern in all three rating widgets plus tabs. 6+ sites.
These absorb a large share of the per-page fixes below once built — build them in this phase, then apply during the page passes. **[M each]**

---

## 3. Accessibility — beyond the foundation layer

Everything in §2.1/§2.2 is the biggest lever. Remaining findings, by severity:

**SERIOUS**
- `applicant/status-refresh.tsx:32-39` polls every 60s via `router.refresh()` with no live region beyond a static caption — a released decision or changed RSVP count is never announced. `applicant/actions.tsx:36,75` call `router.replace()` after RSVP/buddy actions with no focus management. **Fix:** persistent `aria-live="polite"` region present before the mutation; move focus to the new status banner on success, matching the pattern `application-form.tsx:174-177` already does correctly for step changes. **[M]**
- `apply/application-form.tsx:325` sticky bottom bar (`sm:static` only) can cover a focused field on mobile — no `scroll-padding-bottom` set (SC 2.4.11). **Fix:** add `scroll-padding-bottom` sized to the bar, or `scroll-margin-bottom` on the last field per step. **[S]**
- Already known and tracked, not re-scoped here: `applicant/error.tsx` / `apply/error.tsx` destructure `retry` instead of Next's `reset` — "Try again" throws. `admin/hash/deliberate/deliberation-deck.tsx` changes cards on arrow-key with no `aria-live`. The three rating widgets use `role="radiogroup"` without roving-tabindex arrow-key support.

**MODERATE**
- `login-form.tsx:56,60` render errors as `role="alert"` but never set `aria-invalid`/`aria-describedby` on the fields, and never move focus to the error (contrast with `application-form.tsx:122`, which does this correctly). **[S]**
- `admin/rush-controls.tsx:305` round-status pill is 30px tall against the doc's own stated 44px floor (still clears WCAG's actual 24px minimum, SC 2.5.8, but contradicts the house rule). **[S]**

---

## 4. Admin — command center (`admin/page.tsx`, `pipeline-board.tsx`, `round-board.tsx`, `rush-controls.tsx`, `board-nav.tsx`, forms)

**Headline problem:** nothing operational is above the fold at 1440x900. Header + nav + stat panel + "Needs attention" band consume ~635px before the applicant roster starts, against ~780px of usable viewport.

Top fixes, ranked:
1. **Reclaim the fold** — collapse "Needs attention" (`page.tsx:200-223`) from a card grid to a `gap-px` hairline row (matches the doc's own structural idiom), trim panel padding (`:160,:170`). Recovers ~120px, enough to show 3 roster rows instead of 0. **[M]**
2. **Make the attention numbers actionable** — the three tiles (`:210-218`) are inert `<div>`s even though `PipelineBoard` already holds `resumeFilter`/`statusFilter` state (`pipeline-board.tsx:216-217`) that would answer a click exactly. Turn each into a `<Link>` with a `?filter=` param the board reads via `useSearchParams`. **[S/M]**
3. **De-duplicate the pipeline board DOM** — `pipeline-board.tsx:293-320` (mobile accordion) and `:321-351` (desktop columns) render every applicant **twice**, and the desktop 6-column layout (`auto-cols-[248px]`) needs 1548px inside a ~1200px box, so it horizontally scrolls at every real viewport. Render the stage list once; `sm:auto-cols-[minmax(190px,1fr)]` fits 6 stages without scrolling and halves the client component count. **[M]**
4. **Sub-44px controls on the most-repeated interactive elements in the product** — `pipeline-status-form.tsx:69,78` overrides `.operation-control` down to 36px on the per-applicant status select (rendered up to 4x per applicant across views). `rush-controls.tsx:237,241,272,276` sit at 40px, `rush-controls.tsx:305,309` at 30px, on cycle/round-state controls. Delete the overriding `min-h-*` classes — the base classes already supply 44px. **[S]**
5. **Link the built, permission-gated, unused export** — `GET /api/admin/export?cycleId=` exists, is gated on the `EXPORT` permission, streams `rush-attendance.csv`, and has **zero UI entry point**. One `.button-secondary` anchor. **[S]**

Other confirmed, cited fixes (see `docs/audit/05-portal-ui.md` for the two error-boundary and one waterfall finding already tracked separately): duplicate `<SectionLabel>`+`<h2>` pairs (`page.tsx:242-243`, `pipeline-board.tsx:241-242`) once `SectionLabel` can carry the heading itself; bespoke white pill button at `page.tsx:185` to `.button-light`; unify `admin/page.tsx` and `round-board.tsx` on the same `max-w-7xl` (currently `7xl` vs `6xl`, a real inconsistency between two pages an admin toggles between); round board has **zero** `SectionLabel` calls at all.

**Usefulness gaps, tier 1 (data already fetched or one query away, no backend work):**
- Evaluation coverage on the dashboard — `evaluation_assignments.status` is BOARD-readable; `round-board.tsx:57-67` already computes exactly this, it just never reaches the command center.
- RSVP fill — `slot_rsvps` + `event_slots.capacity` exist and are read nowhere in `src/`. "12/24 RSVPs" is a two-join query away.
- Cycle-wide activity feed — `audit_events` has `cycle_id` directly and is currently queried only per-application. A `.eq("cycle_id").order("created_at",{ascending:false}).limit(8)` gives "who changed what," the single highest-value missing panel for a shared console.
- Decision funnel ("3 pending, 1 awaiting second approval") — `decisions` + `decision_approvals` already joined elsewhere in the codebase.
- Per-evaluator load on the round board ("who has 8 open forms") — same `assignments` array already in memory, just needs a `groupBy`.
- Uncovered-applicant worklist under the "covered twice" stat — `assignmentCounts` (`round-board.tsx:57-65`) already computes it.

**Usefulness gaps, tier 2 (need a new RPC/endpoint — confirmed absent from `/api/admin/**`):**
- No update/cancel for events, no rubric/round CRUD, no bulk status change, no evaluator unassign, no decision withdraw/supersede, no membership revoke. Any UI built on these needs backend work first; do not build the button before the endpoint.

---

## 5. Admin — deep screens (applicant dossier, screening, Hash deliberation, groups, events)

The dossier is the single most-read screen in the system; the deliberation deck runs on a projector in a live room; screening is bulk triage. (Full per-file findings are in the source review; headline items below.)

- **Applicant dossier** — scrutinized for scan order and scroll cost per a decision. `admin/applications/[id]/page.tsx:109-158` is also where 24 of the contrast failures in §2.2 live (field labels at `navy/45`), so this screen gets a double win from the foundation pass.
- **Hash deliberation deck** — full-screen, keyboard-paged, used live on a projector. Already tracked: no `aria-live` on card change (§3). Design ask: whatever transition is added for the card swap must be non-looping and use `--t-shift`/`--ease-seat`, large type, and zero ambiguity about position in the stack (`N of M`).
- **Screening** — bulk triage throughput. Assess keystrokes-per-applicant; the shared `useAction`-style hook proposed in `docs/audit/05-portal-ui.md` (fetch/pending/error/success, ~20 duplicated call sites) directly speeds this up since screening actions are exactly that pattern repeated.
- **Events** — `admin/events/[id]/page.tsx` has the documented fetch waterfall (`docs/audit/05-portal-ui.md`, already tracked); not re-scoped here.

---

## 6. Member portal

**Headline problem:** members are unpaid volunteers doing a chore on a phone, often standing up right after an event. The screens should make the duty obvious, short, and clearly finished — several currently do the opposite by rendering every open form fully expanded at once.

Top fixes, ranked:
1. **Live-event grading roster renders every ungraded applicant's full form open simultaneously** — `member/event/page.tsx:63-80`. With a few dozen checked-in applicants this is a very long stack of expanded forms on the exact screen most likely to be used standing up on a phone. Collapse ungraded rows behind `<details>` (already used for graded ones at `:66-75`), auto-open only the nearest one. **[M]**
2. **Score anchor meanings are invisible on touch** — all three rating widgets (`evaluation-form.tsx:138`, `impression-form.tsx:77`, `screening-review-form.tsx:98`) rely on the `title` attribute, which does nothing on a touchscreen, for the sentence explaining what "3" vs "4" means. Render the selected anchor's sentence below the grid in `text-xs text-mecg-navy/55` to `/65` per §2.2. **[S]**
3. **Overview and live-event banners use drop shadows + a hardcoded hex** (`member/page.tsx:120,146,226`) — folds into the §2.4/§2.5 foundation fixes.
4. **Recusal panel introduces an off-system amber accent** — `screening-review-form.tsx:153-167` uses `amber-50/900/950`, a second accent color the doc explicitly bans ("more than one accent per view"). Replace with `mecg-orange/[0.08]` background + `mecg-orange-ink` text — same semantic weight, one accent. **[S]**
5. **Declaring a conflict is a single unconfirmed click** despite copy stating the action is irreversible and voids existing evaluation work (`conflict-form.tsx:40-49`). Add `window.confirm(...)` before the fetch call — native, zero new UI. **[S]**

Rating-widget pattern, assessed as one component across all three files: selection state is genuinely unmistakable (solid fill vs. hairline outline) and press feedback correctly uses `--t-detent`. Three inconsistencies to fix in one pass: (a) anchor visibility above, (b) mobile column count — `evaluation-form.tsx:119` wraps to `grid-cols-3` under 640px, the other two stay fixed `grid-cols-5`, narrowing hit targets on small phones; (c) `impression-form.tsx:96` tag chips use `rounded-full`, the literal "square, not pill" anti-pattern — bring to `rounded-xl` minimum, matching the rating tiles in the same file.

Also: password form has no "confirm new password" field (`password-form.tsx:49`) — a typo is undetectable until next login; add the field and a client-side match check. Screening queue/detail pages have zero `SectionLabel` calls and render `assignment_status` in sans instead of mono (`screening/page.tsx:27`).

**Usefulness gaps:** none found beyond presentation. `buddy_slots` genuinely has no booking/claim column in the schema (verified against `database.types.ts`), so "did this slot get booked" is not a UI gap, it's a real DB limitation — do not build that without a schema change.

---

## 7. Applicant, apply flow, check-in, auth

**Headline problem:** the applicant status portal is checked anxiously, multiple times a day, and currently opens on "Welcome, {name}." — the literal "Welcome to..." pattern `docs/DESIGN.md`'s own anti-pattern list bans by name — instead of answering "where do I stand."

Top fixes, ranked:
1. **`applicant/page.tsx:130-137`** — replace the greeting hero with status-forward copy: title becomes the application's own headline (derived from `display_status` or the outcome card's headline), name moves to the mono eyebrow line. Also move `StatusStepper` into the hero band so it's visible without scrolling on a 375x667 viewport — today it sits below the hero, which alone consumes a third to half of a phone screen. Same fix in `applicant/actions.tsx:156` ("Welcome to MECG." on offer acceptance to "You're in." or similarly data-forward). **[M]**
2. **`apply/application-form.tsx`** — the highest-stakes screen in the product is also the only one that bypasses the button token system: `:320,:383` hand-roll `rounded-xl bg-mecg-navy`/`bg-mecg-orange` buttons instead of `.button-dark`/`.button-primary`. On mobile (`:293-294`, no reorder below `lg`), the navy progress rail renders **above** the actual form fields — a status widget opens before any input field does. Add `order-1 lg:order-2` / `order-2 lg:order-1` to fix the mobile order; swap in the button classes. **[M]**
3. **`portal-shell.tsx`'s default split-shell aside is hardcoded "one account for everything" copy**, wrong on `forgot-password`, `reset-password`, `checkin/[token]`, and `access-denied` — all four should call `PortalShell centered` instead of falling through to the default variant with an irrelevant navy aside. Login is the one screen where the aside is actually on-topic; even there, `login/page.tsx:17` and the aside (`portal-shell.tsx:110-112`) currently say the same thing twice. **[S]**
4. Foundation §2.4 applies directly here — `portal-shell.tsx:77,132` is the shell nearly this entire scope renders inside.
5. **`checkin/[token]/page.tsx:14-20`** renders the full split-screen shell with a marketing aside for a task that needs to complete in under 10 seconds on a phone in a crowded room. Switch to `centered`. Also: `checkin-form.tsx:22-24` dead-ends an unauthenticated scan with a plain error string and no sign-in link — add one, even without return-to support. **[S]**

Also: `apply/page.tsx:107-112` never calls the already-built `applicationCycleStatus()` (`src/lib/public-recruitment.ts:55-93`), so an anonymous visitor who lands here after the cycle closes sees "begin the application" — actively wrong, and the fix already exists in a lib file, just isn't called. Status pill at `apply/page.tsx:116` is `rounded-full` (pill anti-pattern). Six forms across this scope hand-roll `role="alert"`/`role="status"` markup instead of the existing `OperationNotice` component (`login-form.tsx:56,60`, `applicant-signup-form.tsx:71-72`, `forgot-password-form.tsx:42-43`, `reset-password-form.tsx:48`, `checkin-form.tsx:34,37,43`, `apply/page.tsx:122-132`) — same "don't invent a parallel system" principle the doc already applies to buttons and cards.

**Usefulness gaps, tier 1:**
- Applicant status portal has no "what's next" line — `applicant_schedule()` already returns `rsvps`/`openSlots` and the page already fetches it (`applicant/page.tsx:119-122`), but it's buried in a schedule section further down instead of surfaced as one line under the stepper.
- Check-in could show "Checking in as {email}" before the tap — `currentUser()` is already used elsewhere and is one call away; `event_for_token` alone doesn't carry a name, but the session does.

**Usefulness gaps, tier 2:** none identified — apply/applicant/checkin already surface everything their backing RPCs return.

---

## 8. Recommended phase order

Ordered so each phase either unblocks the next one or is independently shippable without waiting on a bigger pass.

1. **Foundation (§2)** — `SectionLabel` fix, focus-ring contrast, navy/white alpha sweep, `docs/DESIGN.md` amendments, the `rounded-[28px]` card consolidation, hardcoded-hex sweep, motion token cleanup, the three missing primitives (StatTile, StatusPill, SegmentedControl). Everything downstream reads better once this lands, and several page-level "fixes" below are literally "apply the foundation-layer change here."
2. **Accessibility blockers (§3)** — live regions on applicant polling/RSVP, sticky-bar scroll-padding, error-field `aria-invalid`/focus.
3. **Admin command center (§4)** — fold reclaim, actionable attention tiles, pipeline board de-dup, 44px control fixes, export link. This is the screen admins live in during a meeting; it's the highest-traffic surface in the portal.
4. **Member portal (§6)** — collapse-by-default grading forms, visible rating anchors, recusal accent fix, conflict confirm. Small, high-value, low-risk changes.
5. **Applicant/apply flow (§7)** — status-forward hero, mobile form-field ordering, shell variant corrections. Highest-stakes external-facing screen; worth doing carefully rather than first.
6. **Admin deep screens (§5)** — dossier, Hash deck, screening, events. Larger and more judgment-heavy; sequence last among the four page passes since it benefits most from the primitives built in phase 1.
7. **Usefulness tier 1, cross-cutting** — evaluation coverage, RSVP fill, activity feed, decision funnel, per-evaluator load, "what's next" line. All pure additions on top of existing queries; can be interleaved with 3-6 wherever it's cheapest to add per screen.
8. **Usefulness tier 2** — anything needing a new RPC or schema change (event edit/cancel, membership revoke, evaluator unassign, decision withdraw). Out of scope for a UI pass; flag for a separate backend-planning conversation before building any UI against it.

Not in this plan: the marketing site (already conforms to `docs/DESIGN.md`), and the four items already tracked in `docs/audit/05-portal-ui.md` (error-boundary `retry`/`reset` bug, deliberation-deck live region, radiogroup roving-tabindex, dead `SectionLabel` `number` prop — the last one is §1 above, now scoped as a fix rather than a bug report).
