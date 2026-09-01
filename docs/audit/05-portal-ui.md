# Section 5 Audit — Authenticated Portal UI

Scope: `src/app/admin/**`, `src/app/member/**`, `src/app/applicant/**`, `src/app/apply/**`, `src/app/checkin/[token]/**`, `src/components/**` (portal-relevant), `src/app/layout.tsx`, `src/app/globals.css`. Marketing group excluded per instructions.

## Verdict

This is an unusually disciplined codebase for an internal tool: server components fetch narrowly-shaped rows and hand client components only the fields they render (no full-record leakage found anywhere), almost every data-fetching page already parallelizes independent queries with `Promise.all`, every mutation form has a `pending` guard plus a visible error/success notice via the shared `OperationNotice` component, and the two most complex client flows (`application-form.tsx`, `pipeline-board.tsx`) have complete and correct hook dependency arrays with no derived-state-in-effect antipatterns. Accessibility is well above the median for this kind of admin tool: labels are consistently associated, focus is actively managed after step changes and confirmation flows (`apply/application-form.tsx`, `applicant/actions.tsx`), and the applicant dossier's tab widget is a textbook WAI-ARIA implementation. The real problems are narrower: two error boundaries call a prop that Next.js never passes (a genuine "Try again" button that throws), one full-screen keyboard-only deliberation tool gives screen-reader users zero feedback as they page through applicants, one detail page issues an avoidable data-fetching waterfall, and roughly twenty components hand-roll the same fetch/pending/error/success control flow that begs to be one shared hook.

## Component table

| Component | Client/Server | Should it be? | Over-fetches? | A11y blockers |
|---|---|---|---|---|
| `admin/page.tsx` | Server | Yes | No — scoped `select()`s, `Promise.all` | None |
| `admin/pipeline-board.tsx` | Client | Yes (search/filter state) | No — receives shaped rows only | None |
| `admin/pipeline-status-form.tsx` | Client | Yes | No | None |
| `admin/rush-controls.tsx` | Client | Yes | No | None |
| `admin/round-board.tsx` | Server | Yes | No | None |
| `admin/round-assignment-form.tsx` | Client | Yes | No | None |
| `admin/decision-form.tsx` | Client (4 exports) | Yes | No | None |
| `admin/board-nav.tsx` | Server | Yes (thin wrapper) | No | None |
| `admin/setup-form.tsx` | Client | Yes | No | None |
| `admin/error.tsx` | Client | Yes (Next contract) | n/a | Logs error correctly |
| `admin/loading.tsx` | Server | Yes | n/a | None |
| `admin/login/page.tsx` | Server | Yes (redirect stub) | n/a | None |
| `admin/hash/page.tsx` | Server | Yes | No | None |
| `admin/hash/deliberate/page.tsx` | Server | Yes | No | None |
| `admin/hash/deliberate/deliberation-deck.tsx` | Client | Yes (keyboard paging) | No | **Blocker** — index change not announced |
| `admin/groups/page.tsx` | Server | Yes | No | None |
| `admin/groups/group-forms.tsx` | Client | Yes | No | None |
| `admin/events/[id]/page.tsx` | Server | Yes | **Waterfall** — 5 sequential independent queries | None |
| `admin/events/[id]/grading-toggle.tsx` | Client | Yes | No | None |
| `admin/events/[id]/rotate-button.tsx` | Client | Yes | No | Token exposed in URL (see MEDIUM finding) |
| `admin/events/[id]/slot-form.tsx` | Client | Yes | No | None |
| `admin/events/new/page.tsx` | Server | Yes | No | None |
| `admin/events/new/event-form.tsx` | Client | Yes | No | None |
| `admin/screening/page.tsx` | Server | Yes | No | None |
| `admin/screening/screening-controls.tsx` | Client | Yes | No | Checkbox pills use `sr-only` input, fine |
| `admin/screening/packet-action.tsx` | Client | Yes (dirty-state guard) | No | None |
| `admin/applications/[id]/page.tsx` | Server | Yes | No — gates decision/eval queries by permission before fetching | None |
| `admin/applications/[id]/tabs.tsx` | Client | Yes | No | None — exemplary ARIA tab pattern |
| `admin/speed-dating/page.tsx`, `admin/group-case/page.tsx` | Server | Yes (thin wrappers) | No | None |
| `member/page.tsx` | Server | Yes | No | None |
| `member/evaluation-form.tsx` | Client | Yes | No | Custom radiogroup lacks arrow-key model (MEDIUM) |
| `member/buddy-slot-form.tsx` | Client | Yes (`useSyncExternalStore` for clock) | No | None |
| `member/conflict-form.tsx` | Client | Yes | No | None |
| `member/password-form.tsx` | Client | Yes | No | None |
| `member/error.tsx` | Client | Yes | n/a | Does not log error (inconsistent) |
| `member/event/page.tsx` | Server | Yes | No | None |
| `member/event/impression-form.tsx` | Client | Yes | No | Same radiogroup pattern (MEDIUM) |
| `member/screening/page.tsx`, `[assignmentId]/page.tsx` | Server | Yes | No | None |
| `member/screening/[assignmentId]/screening-review-form.tsx` | Client | Yes | No | Same radiogroup pattern (MEDIUM) |
| `applicant/page.tsx` | Server | Yes | No | None |
| `applicant/actions.tsx` | Client (4 exports) | Yes | No | Excellent focus management |
| `applicant/status-refresh.tsx` | Client | Yes (visibility/polling) | No | None |
| `applicant/error.tsx` | Client | Yes | n/a | **Bug** — wrong prop name |
| `apply/page.tsx` | Server | Yes | No | None |
| `apply/application-form.tsx` | Client | Yes (heavy local state, autosave) | No | None — best-in-class focus/error handling |
| `apply/applicant-signup-form.tsx` | Client | Yes | No | None |
| `apply/error.tsx` | Client | Yes | n/a | **Bug** — wrong prop name |
| `checkin/[token]/page.tsx` | Server | Yes | No | None |
| `checkin/[token]/checkin-form.tsx` | Client | Yes | No | None |
| `components/form-field.tsx` | Server-safe | Yes | n/a | Style anchor — correct |
| `components/portal-shell.tsx` | Server-safe | Yes | n/a | Style anchor — correct |
| `components/workspace-state.tsx` | Mixed | Yes | n/a | None |
| `components/operation-notice.tsx` | Server-safe | Yes | n/a | Correct `role`/`aria-live` split |
| `components/logout-button.tsx` | Client | Yes | No | None |
| `components/pill-nav.tsx` | Client | Yes (measures DOM for indicator) | No | None |
| `components/section-label.tsx` | Server-safe | Yes | n/a | Dead `number` prop (LOW) |

## Findings

### CRITICAL: error boundaries call a prop Next.js never passes

File: `src/app/applicant/error.tsx:5,15`
File: `src/app/apply/error.tsx:5,15`

Both components are declared `export default function XError({ error, retry }: { error: ...; retry: () => void })` and wire `onClick={retry}` on the "Try again" button. Next.js's `error.tsx` convention passes `{ error, reset }` — there is no `retry` prop. `retry` is always `undefined` here, so clicking "Try again" on either the applicant portal or apply-flow error screen throws `TypeError: retry is not a function` in the browser, on the one screen whose entire job is recovery. Compare with `src/app/admin/error.tsx:6` and `src/app/member/error.tsx:5`, which both correctly destructure `reset`.

Symptom: an applicant or prospective applicant who hits any render error on `/applicant` or `/apply` sees the friendly retry screen, clicks "Try again," and gets a silent client-side crash instead of a reload — they must hard-refresh or close the tab to recover.

Fix: rename the destructured prop (and the `onClick` handler) from `retry` to `reset` in both files, matching `admin/error.tsx` and `member/error.tsx`.

### HIGH: avoidable data-fetching waterfall on the event detail page

File: `src/app/admin/events/[id]/page.tsx:19-38`

The event lookup and permission check (lines 19-27) are correctly sequential (the permission check needs `event.cycle_id`). But everything after that — `event_slots` (29), `checkins` (31), `member_checkins` count (33), `event_impressions` (35), and `applications` (37) — is independent of every other query in that list and is currently awaited one at a time. That is four extra network round-trips of pure latency on every load of this page.

Symptom: the event detail page (attendance, QR code, RSVP slots) is visibly slower to render than it needs to be, and gets slower linearly as Supabase round-trip time grows (e.g., under load or from a distant region).

Fix: wrap the five independent queries (lines 29-38) in a single `Promise.all`, matching the pattern already used correctly in `admin/page.tsx:75-86`, `admin/round-board.tsx:30-42`, and `admin/applications/[id]/page.tsx:132-147`.

### HIGH: deliberation deck gives screen-reader users no feedback as they page

File: `src/app/admin/hash/deliberate/deliberation-deck.tsx:16-95`

This is the primary UI for the Hash panel's final deliberation: arrow keys (or the Previous/Next buttons) swap the entire applicant card — name, score, round breakdowns, impressions, decision — via `setIndex`. None of the changing content is inside an `aria-live` region, and focus never moves. A sighted user visually sees the new applicant appear; a screen-reader user who presses ArrowRight hears nothing change at all, because the DOM update happens outside any live region and outside the current focus point (`window` keydown listener, not a focused, live element).

Symptom: a Hash panel member using a screen reader cannot use keyboard paging to review applicants — they have no way to know when the card has advanced or what it now shows without manually re-navigating the whole page each time.

Fix: wrap the card's changing content (or at minimum a summary line, e.g. "`{index+1} of {entries.length}: {entry.name}`") in `<div role="status" aria-live="polite" aria-atomic="true">`, matching the pattern already used correctly in `admin/applications/[id]/tabs.tsx` region labeling and `components/operation-notice.tsx`.

### MEDIUM: custom rating "radiogroup" doesn't implement the expected keyboard model

File: `src/app/member/evaluation-form.tsx:119-144`
File: `src/app/member/event/impression-form.tsx:59-83`
File: `src/app/member/screening/[assignmentId]/screening-review-form.tsx:87-111`

All three rating widgets use `role="radiogroup"` with `role="radio"` buttons — correct roles, correctly labeled, keyboard-reachable via Tab. But the WAI-ARIA Authoring Practices radiogroup pattern additionally expects arrow-key movement between options with a single roving tab stop; here every option is its own tab stop (a 6-option criterion, e.g. `evaluation-form.tsx`, costs 6 separate Tab presses). A screen reader announcing "radio group, 6 items" sets that expectation and then doesn't meet it, which is disorienting rather than blocking — this is a papercut, not a WCAG failure, since the interaction is still fully keyboard-operable.

Fix: either add roving `tabIndex`/arrow-key handling per the APG radiogroup pattern, or drop `role="radiogroup"`/`role="radio"` in favor of a plain `aria-pressed` toggle-button group (which sets no such expectation) — the latter is the smaller diff given three call sites.

### MEDIUM: ~20 components hand-roll the same fetch/pending/error/success control flow

Representative locations: `admin/rush-controls.tsx:88-109`, `admin/groups/group-forms.tsx:17-26` + `148-164`, `admin/screening/screening-controls.tsx:24-46`, `admin/screening/packet-action.tsx:25-67`, `admin/decision-form.tsx` (all four exports), `admin/events/[id]/grading-toggle.tsx:13-36`, `admin/events/[id]/rotate-button.tsx:13-33`, `admin/events/[id]/slot-form.tsx:13-39`, `admin/events/new/event-form.tsx:36-58`, `admin/pipeline-status-form.tsx:25-54`, `admin/round-assignment-form.tsx:23-53`, `member/conflict-form.tsx:13-34`, `member/buddy-slot-form.tsx:31-67`, `member/password-form.tsx:10-33`, `admin/setup-form.tsx:14-37`, `apply/applicant-signup-form.tsx:26-55`, `member/evaluation-form.tsx:42-97`, `member/event/impression-form.tsx:28-54`, `member/screening/.../screening-review-form.tsx:29-46`, `checkin/[token]/checkin-form.tsx:11-31`, `applicant/actions.tsx` (all four exports).

Every one of these repeats: `setPending(true); setError(""); setSuccess?.(""); try { fetch → check response.ok → setError(body?.error) } catch { setError(fallback) } finally { setPending(false) }`. This is the single largest concrete duplication in the portal — not a card/table/pill duplication (those are already reasonably consolidated via `OperationNotice` and `FormField`), but a control-flow duplication that increases the odds a future edit fixes an error-handling bug in one of the twenty copies and not the other nineteen.

Fix: extract one hook, e.g. `useAction<TPayload>(url: string)` returning `{ pending, error, success, run }`, built on the same `OperationNotice`-shaped state these components already produce. This is a mechanical refactor with no behavior change and a large line-count reduction.

### LOW: three separate copies of the same `initials()` helper

File: `src/app/admin/pipeline-board.tsx:31-38`
File: `src/app/admin/round-board.tsx:11-18`
File: `src/app/admin/groups/group-forms.tsx:8-15`

Byte-for-byte identical function (split name, take first two initials, uppercase). Small, but it is the kind of copy that silently drifts (e.g. a future locale fix applied to one and not the others).

Fix: move to `src/lib` (or a small `components` util) and import in all three.

### LOW: `SectionLabel`'s `number` prop is dead

File: `src/components/section-label.tsx:1-4`

The component explicitly discards its `number` prop (`void number;`) and never renders it, yet every call site (`admin/page.tsx`, `admin/pipeline-board.tsx`, `member/page.tsx`, `member/event/page.tsx`) still passes `number="01"` etc. Harmless, but it's dead code at every call site and suggests a numbering treatment that was removed from the design without cleaning up the API.

Fix: drop the prop from the component signature and all call sites, or reinstate the numeral in the markup if it was an intentional design element that regressed.

### LOW: rotated check-in token is carried in the URL query string

File: `src/app/admin/events/[id]/rotate-button.tsx:27`
File: `src/app/admin/events/new/event-form.tsx:52`

Both flows put the raw, one-time-displayed check-in token into `router.replace`/`router.push` as a `?token=` query parameter rather than, e.g., returning it via a client-side state value or a short-lived server-rendered flash. The code already shows awareness of the sensitivity (`admin/events/[id]/page.tsx:126-128`'s comment about only showing the raw token on creation/rotation), but a URL is more exposure-prone than in-memory state: it lands in browser history and could appear in server/proxy access logs if this app ever sits behind a logging reverse proxy.

Fix: pass the freshly-rotated token through client component state (e.g., a local `useState` populated directly from the fetch response) instead of round-tripping it through the URL.

## Non-findings worth recording

- No `dangerouslySetInnerHTML` anywhere in scope.
- Every `href`/`src` built from user data (LinkedIn URL, resume path) is validated through an `http(s)`-only allowlist (`admin/applications/[id]/page.tsx:19-27`, reused for both dossier branches) before being used in an anchor.
- No client component receives an unfiltered database row; every server component maps rows down to the exact fields the client component renders.
- No `useOptimistic`/`startTransition` usage anywhere, so there is no "optimistic update that never reconciles on error" risk — all mutations are pessimistic with a `pending` state and a `router.refresh()` on success, which is the correct, if slightly less snappy, choice for a moderation-heavy admin tool.
- `pipeline-board.tsx`, `round-board.tsx`, and `hash/page.tsx` all render "boards" that are entirely click/select-driven (no drag-and-drop), so they are keyboard-operable by construction — the review flagged in the task brief as a risk area did not materialize.
- The two named style anchors (`form-field.tsx`, `portal-shell.tsx`) are correctly reused everywhere a labeled input or full-page shell is needed; no component reimplements their job.
