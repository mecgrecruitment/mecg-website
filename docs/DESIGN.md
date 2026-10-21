# MECG Design Philosophy — Open studio

Current direction (October 17, 2026): **MECG is an open engineering studio: different disciplines, real people, and clear reasoning around useful client work.** The user chose to evolve blue/orange with a bolder personality, then asked to continue with the recommended direction. [Research and exploration](research/2026-10-mecg-design/DIRECTION.md) record the evidence and alternatives.

## 0. Tokens (October 20, 2026)

This table is the whole palette. It supersedes every colour, radius and shadow value in the sections below. `npm run lint` runs `scripts/design-tokens.mjs`, which fails on a class that has a token equivalent or on a raw colour in an arbitrary value. `node scripts/design-tokens.mjs --fix` rewrites the classes it can.

| Role | Class | Value | Use |
|---|---|---|---|
| Ink | `text-mecg-navy` | `#070d1f` | Primary text on light surfaces |
| Muted | `text-muted` | `#52627c` | All secondary text: metadata, captions, helper copy. 6.2:1 on white. Navy below 60% opacity failed 4.5:1, and 203 classes used it |
| On dark | `text-white`, `text-white/70` | | Primary and secondary text on navy, deep blue and the blue rail |
| Line | `border-line`, `divide-line`, `inset-ring-line` | navy 12% | Hairlines and panel edges |
| Strong line | `*-line-strong` | navy 22% | Control and chip edges. Hover may step to `inset-ring-mecg-navy/40` |
| Wash | `bg-wash` | navy 4% | Quiet inset fills |
| Tints | `bg-mecg-blue/10`, `bg-mecg-orange/15`, `bg-white/10` | | Selected, attention and on-dark fills, one step each |
| Status | `text-danger`, `bg-danger-wash`, `text-success`, `bg-success-wash`, `text-warning`, `bg-warning-wash`, `border-warning-edge` | Tailwind red-700, emerald-800, amber-900 | Errors, confirmations, cautions. No other red, green or amber shades |
| Brand | `mecg-blue`, `mecg-orange`, `mecg-orange-ink`, `public-*` | see `globals.css` | Unchanged |
| Elevation | `shadow-lift`, `shadow-pop`, `shadow-xs` | | Lifted cards, popovers and menus, and a field's 1px drop |

Radius: `rounded-md` 6px chips, `rounded-lg` 8px controls, `rounded-xl` 12px panels, `rounded-full` badges and avatars. The `.surface-card` 28px outer card is the one exception. Type: nothing under 12px (`text-xs`), and no half-pixel steps. The public steps (13, 15, 17) and workspace steps (12, 14, 16) stay as the October 19 and 20 decisions set them. Edges are Tailwind `inset-ring`, not `shadow-[inset…]`, so they compose with elevation and focus rings. There is one paper, the cool `bg-paper` (#f5f8fd). The warm `#f5f4ef` workspace paper is retired. HTML email in `src/lib/email.ts` keeps its inline colours because email clients do not read the stylesheet.

The following current rules supersede conflicting historical rules below:

- Public reference pass (October 19, 2026, [research](research/2026-10-reference-moves.md), [critique](reviews/2026-10-reference-pass/CRITIQUE.md)): the owner supplied poster and aura references.
  - **Display face.** Public pages now self-host Archivo (SIL OFL, `src/app/fonts/`) as `--font-display`, loaded through `src/app/fonts/display.ts` in the marketing layout and, since the workspace refresh below, the admin and member layouts. Every public h1 and h2 and the `.display-face` question text use it, with word-spacing 0.1em. Body text stays on the system stack. This supersedes "No new font download" for public pages only.
  - **Poster word.** Each poster page has one `.poster-word` sized in container units to fill the column, crossed by one real image or object: home "MECG" (orange, one line across the full width; the PwC photo fills the whole hero behind it, blurred 6px and tinted blue, fading to solid blue at the stats. Hero copy is only the headline line and two actions. `home-hero-motion.tsx` adds the interactions: scrolling sharpens the photo and spreads the letters, a pointer opens a sharp lens and tilts the letters by depth (phone tilt on Android), hovering a letter fills it with the sharp photo, and the stats count up as they enter the screen. Reduce Motion keeps only the pointer lens and letter fill), Team "Our Team" (board portraits), Join "Join Our Team" (maize-and-blue photo). Poster words may wrap, so translated text never scrolls the page sideways.
  - **Colour.** Orange is the hot colour of the poster word on blue as well as of actions.
  - **Home questions.** The home question explorer is an index of five rows with the active row inverted to ink, beside a lit question panel.
  - **Not permitted.** Generated people, cut-outs, grain or colour edits on members' photos, and looping motion.
- Workspace refresh (October 20, 2026, owner asked for a bold refresh of the admin portal; three directions were compared on the Recruitment screen and "blue rail" won over a poster header band and a navy desk). This supersedes the white sidebar and blue page titles below for every sidebar-bearing screen, member pages included:
  - **Blue rail.** The 240px sidebar is brand blue end to end. Links are `#e6edfc`, group labels `#c9d7f5`. The current page is a white tab with blue text, a 3px orange inner edge and an orange dot. The cycle name sits under the logo; the cohort switcher, when there is one, sits in a translucent box with a white select and a white focus ring. The account avatar is orange.
  - **Titles.** Page titles (`.workspace-page-header h1`, `.workspace-title`) use Archivo at 44px (36px under 640px), weight 750, 88% width, navy. Large section headings (`h2.text-lg/xl/2xl`) use Archivo 650 at 92% width. Body, labels and controls stay on the system stack. Archivo loads through `src/app/fonts/display.ts` in the marketing, admin and member layouts.
  - **Header rule.** A 2px navy rule closes every page header.
  - **Stage strip.** Recruitment opens with one count per active pipeline stage plus Decided, set in Archivo, each a link to that roster filter. Only a non-empty "Up for a vote" stage turns orange. It replaces the collapsed "Cycle totals" metrics; the active round count moved into the header context line.
  - **Status chips** in the workspace use 6px corners instead of full pills.
  - **Discussion deck.** The projected applicant name uses Archivo.
  - **Work feedback (October 20, 2026, owner asked to make hash and grading "fun and still functional").** Only the member's own actions answer, once and briefly; nothing shows how anyone else voted or scored, and nothing loops. Yes, Unsure and No use one colour set everywhere (`#047857`, `#fbbf24`/`#b45309` ink, `#be123c`), matching the deck stamps.
    - Hash ballot: three stamp-pad buttons with a glyph and Y/U/N shortcuts (shown as key caps on desktop). Casting a vote presses a small rotated stamp onto the row. A tally strip shows one segment per applicant in the member's own vote colour, and a "Ballot complete" line says votes stay editable until the board applies the result.
    - Speed Dating and Group Case: orange stars with an orange-ink outline that pop once when chosen. In Speed Dating, hovering previews the score and names it ("Leaning yes") next to the stars, keys 1 to 5 rate the focused row, and a tally strip plus "Every conversation is rated" line track progress. Group Case segments show none, some or all dimensions rated.
    - Reading queue: the next candidate code is an Archivo ticket with an orange edge; an empty queue reads "Queue clear".
    - Decisions: each tally adds a vote bar (yes, unsure, no on a scale of votes cast or quorum, with a quorum tick) and the outcome chip is green for pass and rose for fail. The sentence of counts stays as the readable record.
    - My work: the Speed Dating task and the Hash ballot carry the same strip under their detail line ("2 of 6 rated", "Voted 3 of 9" or "Ballot complete"), built from the member's own ratings and votes. The ballot sits under "Voting open" as a task-shaped card without the orange next-task accent, because voting is available, not owed.
    - Live rooms (October 20, 2026, owner asked to make application, grading and Hash "better, faster, easier"). Work is never lost to bad wifi: a failed Speed Dating rating keeps its star with an inline Retry and resends when the device is back online, Group Case resends unconfirmed saves on reconnect, and notes still waiting to save are sent when the page closes. Polling screens say "Reconnecting…" after two failed checks in a row. Only a deck tab with "Present to members" switched on (orange, with a dot) moves members' phones; browsing on a second laptop moves nothing. The ballot focuses the presented row so Y, U and N work at once, shows that applicant only in the Now presenting card, and has an "Unvoted (N)" filter built from the member's own votes.
    - Application form: from Review, the step's primary button reads "Save and return to review"; a field's error clears as soon as it changes; formatted fields (uniqname, phone, links) are checked when the applicant leaves them; the resume accepts a dropped PDF; Submit stays enabled and points to the consent box when it is unticked; on phones "Step N of 4" opens the step list.
    - Group Case at speed: keys 1 to 5 rate the focused dimension (or the first unrated one) and move on to the next; each dimension is one Tab stop with arrow keys between stars; a "1–5" key cap shows only with a mouse and keyboard. "Next: {name} →" saves and opens the next applicant at their first unrated dimension, but stays on a row whose save failed and focuses Retry. "Unstarted only (N)" keeps rows visible once you start them.
    - Final hash: "Apply all decided" on /admin/hash applies every evidence-ready result that reached quorum behind one confirmation that counts offers and no-offers, skips applicants you declared a conflict on, and reports any result that changed since the page loaded. Nothing reaches applicants until release.
    - Expected graduation is a term and a year select (application and member profile). Both picked saves "Term Year", both blank clears, one alone keeps the saved value and says "Pick a term and a year". Old free text shows as "(as entered)".
    - Reduce Motion removes the stamp and pop animations; every state still shows.
- Client services pass (October 21, 2026, owner asked to improve the `/work` UI/UX, then for the full restructure): `/work` is no longer a poster page. It opens with a two-line plain `PageIntro` and the chapter-presentation photo on the first screen, crossed at its lower edge by a lit figure band ($0 fee, 1 semester, 6–8 students, 30+ organizations, 1 week to hear back; each figure restates a `CLIENT_FAQS` answer). Clients follow under "From General Motors to a Midland medical spa.", with approved case studies first and logo tiles that show each industry. Every example question links to `/contact` with its subject and question pre-filled, as the home explorer does. Engagement steps run in four columns with a "You get" line, and the page closes on a lit "Discuss a project" band after the FAQ. A signed-in member's "My workspace" header link uses `.button-secondary`, so orange stays the page's own call to action; "Join MECG" for visitors stays orange.
- Public site (October 19, 2026, [direction and critique](reviews/2026-10-web-designer-pro/DIRECTION.md)): every public page uses the light header (`bg-public-ground`) and the light `PageIntro`. Navy page tops are retired; the deep blue `public-deep` ground is for the home process section and the footer only. Public sections carry no numbered mono eyebrows. Mono stays for the footer title block, and `SectionLabel` on public pages renders as a 13px blue sans kicker. The client's question is the public signature. A lit blue card (`.public-lit`: top-left light inside, neighbouring blues, no glow) holds an example question and crosses an edge: the home photo, the `/work` figure band across the presentation photo and the `/join` criteria photo. Choosing a home area carries the question into `/contact` (Subject and Message, plus a card above the form). Orange is only for actions. Public type steps are 13, 15, 17, 20, 24, 32–40px, plus fluid display sizes up to 84px on home and 76px on inner pages; nothing is under 13px. Each photo appears on one page only. Public colours come from the `public-*` theme tokens in `globals.css`, not raw hex. In Windows High Contrast, public buttons and fields keep a system-colour border. Front-door screens (404, login, password recovery, access denied, check-in) use `PortalShell` on the same public ground and header, with a blue kicker and the contact-card style. Case studies lead with a lit "The question we started from" card. On phones, the `/work` client profile opens directly under the tapped logo row instead of scrolling the page.

- Blue `#254f9f` is the deeper evolution of MECG blue. Orange `#fe904d` and accessible orange ink `#a83e0b` remain. Cool paper is `#f5f8fd`; private secondary text `#52627c`, rules `#d8e1ed`, and selected surfaces `#e5edfc`. Existing `#070d1f` navy is retained for legacy utility/alpha contrast compatibility; the exploratory `#12213e` ink is not substituted globally without auditing those pairs.
- The current homepage opens with a light header and cool-paper hero, deep-blue text, restrained orange actions, smaller responsive type and a fixed PwC group photograph and a separate Chicago community photograph. Immediately after the hero and facts, its question explorer changes the example question and approach, then carries the selected area into an editable contact subject. A dark-blue four-step process selector explains the method and handoffs; native FAQ disclosures retain practical terms, and a separate community scene introduces members. Use quiet choice feedback with reduced-motion support and no autoplay. Photos represent community, and example questions are explicitly examples rather than client outcomes. Preserve eligibility, practical engagement information, approved-project publication boundaries and live recruitment routing. This is a homepage refinement within the established blue/orange identity, not a private-workspace redesign. [Direction and verification](reviews/2026-10-homepage/RESULT.md) record its scope and limits.
- Homepage photo choice (October 17; placement superseded October 19 by the poster-word rule above): use the PwC-visit photograph as the single hero image, with a taller 1600:1126 frame and a larger image column. Preserve the full group with a 28% zoom; avoid panoramic cropping. On mobile, place the image after the heading and audience actions, before the longer explanation. Use the Chicago River photograph in the community section. Keep the hero caption simple and put the question explorer before the partner logos.
- Private work keeps compact task-first composition: white 240px sidebar, blue MECG logo band, blue selected destinations and primary actions; orange highlights the first member task and attention counts. Group personal work, recruitment, community and administration separately and preserve selected-cycle context. Use explicit `.workspace-private` scope for focused screens without a sidebar; blind reading keeps safe candidate/queue context rather than identity-bearing navigation. Applicants retain a compact top bar, one next action and expandable records/dates. Shared private controls target 44px; keep visible focus and narrow-screen reflow. Active tasks, preparation, available voting and completed read-only work remain distinct; do not show a My work badge without an authoritative matching count. Save, submit, qualifying evidence, locked decisions, release, provider acceptance and inbox delivery are separate facts. Unknown notification retries lead to a read-only status check, not another send. Do not add marketing heroes to forms or review pages. Member home may include one quiet community photograph in its secondary column. [Implementation and verification limits](design/workspace-revitalization/IMPLEMENTED.md) record this partial extension; the full feature atlas remains a plan.
- Buttons use 8px corners; private panels use 12px. Maintain the established four-pixel spacing rhythm and shared control sizes (44px touch targets). This supersedes the historical square/2px-button rule. The sidebar is 240px, superseding §9's older 232px value.
- Focus on the new blue field uses white; sidebar brand links also use white. Ink remains the default on light surfaces and orange on navy. The old claim that navy focus clears 3:1 on the blue field does not apply to the new deeper blue.
- Keep the system sans stack: Avenir Next / Avenir / Segoe UI / Helvetica / Arial. No new font download is installed or implied. Mono remains for data and selected public labels, not routine workspace chrome.
- Shared tokens now carry the palette into other public/private routes, but this implementation specifically composes the homepage, board shell and member home. It does not claim every screen was individually redesigned or verified.

## Historical Precision Instrument record

The rules below retain useful process, evidence, accessibility and interaction guidance. Where their palette, button geometry, public hero or sidebar treatment conflicts with the current rules above, the current rules take precedence.

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
| `mecg-blue` | `#254f9f` | Headings, logo, `/10` tint |
| `mecg-orange` | `#fe904d` | Fills; text on dark only |
| `mecg-orange-ink` | `#a83e0b` | Orange text on light surfaces |
| `paper` | `#f5f8fd` | Cool paper: inset forms, mats behind logos |

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

## 8. Recovery and responsive refinement (October 2026)

- On narrow homepages, the signature engagement bench opens from an explicitly labeled process disclosure. Keep all four interactive steps available and preserve the full desktop bench. The later engagement section explains complementary working expectations rather than repeating the same steps. Partnership figures and culture photos remain distinct from approved project evidence.
- On shared presentation screens, offer a visible presentation motion control. A tab-local preference may reduce motion further; it must never override the operating system's reduced-motion setting. Turning motion off removes decorative delays as well as animation. Display real counts directly.
- When application copies disagree, pause saving, emphasize changed fields and let the applicant choose each exact version. Keep whole-copy choices available. Offer a private download of both copies before discard; identify personal information and clarify that attachment bytes are excluded. Combining answers is an explicit user action and still uses the current server revision and a fresh submission consent.

## 9. Private workspace replacement (October 17, 2026)

The previous private interface was rejected as confusing, dated and bulky. The
private workspace now follows a compact application layout. This section
supersedes the earlier workspace-specific hero, pill-navigation and outer-card
exceptions; the public marketing identity remains unchanged.

- Board, committee, panel, member and owner pages use a persistent 232px neutral
  sidebar. Keep the existing permission checks and selected-cycle URLs. Primary
  work, personal tools and administration remain separate groups. Small screens
  use a labeled Menu button with Escape support and focus return.
- Page headers are plain 28px titles with 12px cycle context and a short 13px
  description, separated from content by one hairline. No navy hero, floating
  pill bar, decorative shadow or page entrance animation.
- The canvas is `--workspace-canvas` (#f8f9fb), sidebar
  `--workspace-sidebar-surface` (#f0f2f5), border `--workspace-border` (#e2e5eb),
  and secondary text `--workspace-muted` (#596271). Retain navy text and actions;
  orange ink indicates attention and the current destination. Data remains
  server-derived, with no decorative growth charts or fabricated comparisons.
- Recruitment puts its applicant list beside attention queues and upcoming
  events. Applicant rows have one Open file action. Manual stage updates remain
  in the applicant file and stage board; cohort advancement appears after
  selection, including hidden-selection and exact-review safeguards.
- My work presents the next actionable task first. Do not show an empty legacy
  assignment section beside active grading tasks. Closed Group Case work keeps
  its explicit read-only review link; submitted evaluations remain immutable.
- Grading uses a compact search-and-roster surface with 6px corners, quiet
  hairlines, and visible progress. Keep observed-evidence requirements, drafts,
  save acknowledgements, conflicts and recovery controls intact.
- Applicants use a compact top bar, plain status heading, next action, application
  and schedule columns. No internal sidebar or Board tools. Application intake
  uses a quiet step guide and a bordered editing surface, retaining all recovery,
  consent, validation and submission behavior.

## 10. Shared private-workspace geometry

The private workspace uses App Designer Pro's layout/type/finish review process,
adapted to a responsive web product. Its native device chrome, glass, store
assets, paywalls and default direction exploration are outside this refinement.
The uploaded reference files match the installed skill's layout, typography,
finish and critique references. The shared design-system workflow retains MECG's
palette, task structure and data/permission contracts.

The source of geometry is `src/app/workspace.css`, imported by `globals.css`.
Use semantic tokens and shared component roles when refining another private
page. Do not append a new local radius or control height to correct a screenshot.

- Spacing: 4, 8, 12, 16, 20, 24, 32, 48px. Use 4–12px inside a related group,
  16px within dense rows, 24px between sections and inside panels, 32px desktop
  page gutters, and 20px narrow-screen gutters.
- Shapes: 8px controls/navigation, 12px panels/grouped lists, round badges and
  avatars. A segmented group uses 12px outside, 4px inset, and 8px inside.
- Sizes: 40px standard desktop controls, 36px compact secondary controls,
  44px controls on narrow screens or coarse pointers. Text inputs use 16px type
  on narrow screens; they can grow when content needs more space.
- Type roles: 12px metadata, 14px body/control labels, 16px section/row emphasis,
  20px emphasized values and 28px page titles. Use 1.5 body leading, 1.25 for
  headings, 400 body and 600 emphasis. System font fallback remains explicit.
- Inputs: white surfaces, one shared neutral edge, navy focus outline, an
  explicit red invalid state and a muted disabled surface. Preserve native
  controls, labels, entered values and error recovery.
- Panels: `workspace-panel` supplies 24px padding, a 12px radius, a neutral
  hairline and white surface. This role applies to interactive form groups;
  ordinary section headings and metadata need no box.

The geometry values are MECG design decisions. WCAG 2.2's minimum target-size
criterion is 24 × 24 CSS pixels with stated exceptions; the 44px touch height is
our more generous default, not a claim that every inline link must be 44px.

References: App Designer Pro `references/layout.md`, `type.md`, `finish.md`,
`critique.md`; MDN CSS custom properties; W3C Understanding SC 2.5.8.


## 11. Homepage refinement — October 17, 2026

The homepage retains Precision Instrument and applies App Designer Pro's rendered
review process to responsive web. Lead with “Clear decisions. Built on research.”,
a short explanation of the student-led, no-fee offering, the existing client and
recruitment-driven student actions, and a compact semester/team summary. The
mobile display size is fluid so the headline fits two lines at 320px and 390px.

Frame the existing engagement bench more tightly rather than reducing the actual
drawing to a small object inside a large stage. Keep all four stations, their
handoff descriptions, the narrow-screen disclosure and reduced-motion behavior.
No approved-project evidence or membership schedules were added. Review and
verification: docs/reviews/2026-10-homepage-refinement/.

### Application reading surfaces (2026-10-17)

Member screening and the Board dossier use a continuous white application document with 17px response text, a maximum 70ch answer measure, question anchors, quiet section dividers and an expandable resume. Desktop review controls occupy a 340px secondary rail; applicant contact/background is a disclosure. Board interview evidence and decision controls remain beside the application, with messages and activity disclosed separately. Sections stay mounted when collapsed so form input is retained.

On narrow screens, the application remains mounted and readable. Members open their private review with an explicit disclosure and return to their prior reading position; recovery still reveals and focuses the relevant conflict or unknown-outcome controls. Board readers have application/review anchor shortcuts. Rubric guidance expands on demand, all rating anchors remain accessible, and failures remain visible. Successful saves use one compact receipt; current browser backup details are disclosed, while unavailable backup warnings expand. Existing authorization, conflict filtering, required evidence, revision checking and explicit final locking/release contracts remain authoritative.
