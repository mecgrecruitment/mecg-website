# Public site: Web Designer Pro plan

Date: 2026-10-19. Status: implemented with the proposed defaults. See `docs/reviews/2026-10-web-designer-pro/` for the direction, explorations, before/after shots and critique rounds.

Scope: the five public pages (`/home`, `/work`, `/team`, `/join`, `/contact`) and
their shared header, footer and page intro. Private workspaces are out of scope.
DESIGN.md §9 and §10 cover them, and Web Designer Pro's web-app path adds nothing
they need.

## How the skill fits this repo

Web Designer Pro is written for new looks. It asks for three explorations that
differ on ground, type, accent, richness and grammar, and a result that differs
from the current look on 4 of its 6 look columns. MECG already has a recorded
identity: blue `#254f9f`, orange `#fe904d`, cool paper and the system sans stack
(DESIGN.md, current rules). The global design routing also says refinement does
not require new fonts, a new palette or three new identities.

So this plan runs the skill's **evolution** path (`redesign.md` §6):

- **Kept columns:** accent (blue and orange), type (system sans, mono only for
  data) and source (printed object / engineering document). Reason: brand
  equity and recorded decisions.
- **Changed columns:** ground, richness and grammar. These are where the skill
  finds the current site weak.
- The rest of the process applies in full: brief, before shots, scan, three
  rendered first screens, content first, depth, phone recomposition, matrix,
  one critic over 2–4 rounds, before/after.

## Baseline (captured 2026-10-19)

The local dev server (placeholder Supabase env) was shot with `shoot.mjs` at 390,
768, 1280 and 1440. Shots are in `/tmp/wdp-shots/<page>/`. Copy them to
`docs/reviews/2026-10-web-designer-pro/before/` when Phase 0 starts.

| Page | Scan | Main findings |
|---|---|---|
| home | 3 FAIL | Control labels wrap at every width ("Operations & Management", "Recommend and hand off"). 13 text sizes. 16 elements at 11px. Running text at 12px. |
| join | 1 FAIL | "Check application access" wraps at 768. 5 numbered mono eyebrows. 10 letter-spaced labels. |
| work | warns | Two-beat aphorism headline ("A focused question. A useful answer."). Numbered mono eyebrows. |
| team | warns | No action in the first screen at any width. |
| contact | warns | No action in the first screen at any width. 14px running text. |

What the eye catches beyond the scan:

1. **Two public systems.** Home has a light header and a cool-paper hero. Work,
   team and join use the older navy header, a navy page-intro band and `01 /
   LABEL` mono eyebrows. Moving between pages feels like moving between sites.
2. **Flat page** (finish.md §2). The home hero is a headline on the left and a
   photo on the right with nothing touching. The split hero is in the skill's
   own rut. The sections below it are type and hairlines in boxes.
3. **The template sequence** (slop.md §1). Hero, stats row, logos, process, FAQ,
   CTA band. On work, the engagement steps and the FAQ repeat what home already
   says. Every page ends in another CTA band.
4. **Team is a header and a grid.** About 220px of navy holds only the words
   "Our Team". It has no route to joining and no community context. The
   headshots are consistent and good, and they are the site's best asset after
   the logos.
5. **Join's failure state comes first.** When dates do not load, a grey
   "temporarily unavailable" panel is the first thing below the hero. (This was
   expected in dev, but the hierarchy is the same in production when the fetch
   fails.)

What works and must survive: the real PwC and Chicago photographs, the headshots,
the 15 self-hosted client logos, the question explorer, the four-step process,
the title-block footer and the plain, specific copy.

## Keep list (contract)

Every item below must appear in the result and is checked off in the final report.

- Two audiences, one action each: "Discuss a project" and "Join MECG"
- Eligibility: open to every major, no consulting experience required
- Pro bono, one semester, 6–8 members, NDAs supported
- Client logos, self-hosted, with the publication boundary ("published with
  client approval")
- Example questions are labelled as examples, never as outcomes
- Live recruitment dates and events, including their failure and retry states
- Exec board with roles and LinkedIn
- FAQ content (home, work, join)
- Contact form, all fields and validation
- Reduced-motion behaviour, 44px targets, visible focus, no content hidden
  without JavaScript
- No stock photos, fake testimonials, invented numbers or count-up stats

## Phases

Each phase ends in a verifiable state and can ship alone.

### Phase 0: Brief and DIRECTION.md (no code)

Write `docs/research/2026-10-web-designer-pro/DIRECTION.md` with:

- the brief (Step 0), using the defaults below unless you change them
- `## Current` (the baseline above), the keep list and the harvest (photos in
  `public/mecg/`, `public/board/`, `public/images/clients/`)
- the category default being refused. Student consulting clubs share a navy
  hero, a group photo, a stats row, a logo wall and "Apply now". That is the
  template this site currently follows.
- `## References`, if you send any
- `history.mjs check` against the current look, run as the evolution path

Proposed defaults for the brief:

- **The one job:** in ten seconds, a small-business owner understands that
  Michigan students will work on their real question for a semester at no cost,
  and clicks "Discuss a project". A student understands that every major can
  join, and finds the dates.
- **Three words:** capable, warm, exact.
- **Images:** real photos only. Generated people would misrepresent a real club.
  Image generation could still be used for textures or object studies, but this
  plan does not assume it.

### Phase 1: Mechanical fixes (small PR, before any redesign)

These are the scan's free wins, and they are valid under any direction:

- Stop control labels wrapping: question-explorer tabs, process steps and the
  join CTA at 768.
- Collapse 13 text sizes into the scale the skill recommends (6–9 steps), with
  a 13px floor for metadata. Running text goes to ≥15px.
- Put an action in the first screen of team ("Join MECG") and contact (the form
  starts in view, or an anchor to it does).
- Replace the work headline with a specific line, for example: "Semester-long,
  pro bono projects for organizations with a real decision to make."
- Verify by rerunning `shoot.mjs` (0 FAIL) and the existing Playwright public
  specs.

### Phase 2: One public system

Retire the navy page-intro band and the light/dark header split. All public
pages get the home page's light header and cool-paper intro. Navy stays as a
section ground, as in the process section, not as the default page top. Decide
what happens to numbered mono eyebrows (decision 2 below). Shoot all five pages
and compare.

### Phase 3: Three first screens for home (`explore/a|b|c.html`)

Use plain HTML in the shared palette, with real content and real photos. Each
version moves and has three planes with one element crossing another. They vary
on ground, richness and grammar:

| | Concept | Ground | Richness and depth move | Motion (on interaction, never looping) |
|---|---|---|---|---|
| A | MECG is **a project brief on the desk** | cool paper | The question explorer becomes the hero. A large question card in blue crosses the headline. The PwC photo sits behind it as the third plane. | Choosing an area swaps the question in the card |
| B | MECG is **a room full of people** | image (full-bleed PwC photo, graded cool) | The headline is locked over the photo's sky and wall. An orange action card cuts across the photo's lower edge into the paper section below. | The card lifts on scroll; a still frame when motion is reduced |
| C | MECG is **a roster** | blue field | A strip of exec headshots crosses from the blue field into the paper below. Client logos sit as a quiet index line. | Hovering or focusing a face shows that person's role |

Shoot each at 390 and 1440, pick one, and write why the other two lost. The plan
leans toward **A**. It turns the most distinctive thing MECG has (real example
questions) into the first screen, and it does not depend on one photo carrying
the whole page.

### Phase 4: Content first

Before layout, write every headline, label and button for all five pages in
DIRECTION.md `## Content`. Remove the duplicates: the process and FAQ live on
work, and home links to them. Each page ends in one action, not a CTA band
stacked on a footer.

### Phase 5: Build in the repo

- Tokens stay in `globals.css` and `workspace.css`. Add no new runtime; motion
  stays in CSS plus the existing small client components.
- Home: the chosen first screen, recomposed for phone (not stacked), then one
  layering move or image per section (finish.md §5).
- Work: the logo grid becomes the page's evidence index, with an honest status
  line per client. Capabilities pair with the example questions.
- Team: the board grid is followed by a community photo and a join route.
- Join: dates and the process lead. The failure state becomes a compact inline
  notice, not the first panel.
- Contact: the form leads, with practical terms beside it.

### Phase 6: Verify and critique (2–4 rounds)

- `shoot.mjs`, `matrix.mjs` (Windows 125/150% and High Contrast, Firefox,
  Safari, 320px reflow, reduced motion, translation stress) and `filmstrip.mjs`
  on the signature
- One continued critic subagent, scored with `critique.md`, findings in
  `CRITIQUE.md`
- Existing `npm run lint`, `npm test` and `test:e2e`, plus cross-browser specs
  for public pages
- Exit criteria: 0 FAIL, every warning fixed or justified, critic "done" per
  `critique.md`

### Phase 7: Ship notes

- `before-after.html` with first screens at desktop and phone, and scan and
  matrix results before and after
- Check the existing `icon.png`, `apple-icon.png` and `opengraph-image.tsx`
  against the new first screen
- Update DESIGN.md's current rules, so the historical sections stop
  contradicting the site (numbered labels, 2px buttons, navy page tops)
- `history.mjs add` to record the look

## Decisions for you

1. **Evolution or new look?** This plan keeps the blue/orange palette and the
   system font. If you want the skill's full redesign (a new display face and a
   new accent), Phase 3 becomes three full identities.
2. **Numbered mono eyebrows on public pages.** DESIGN.md principle 6 requires
   them. The skill flags them as the overcorrection. Proposal: keep mono for
   data, captions and the footer title block, and drop `01 / LABEL` above every
   section.
3. **Motion.** DESIGN.md forbids looping decoration. The skill wants every
   exploration to move. Proposal: motion only on interaction or scroll, with no
   loops. This is compatible with both.
4. **Generated imagery.** Proposal: none for people or events. Possible for
   textures or object studies only, if you want it.
5. **Page removals or merges.** Should home stop repeating the process and FAQ
   (they would stay on work)?
6. **Phase 3 pick.** The plan leans toward A. You choose after seeing the shots.

## Not verified

- The baseline uses placeholder backend env. It does not show recruitment dates,
  the Clerk header state or production data.
- No real Windows, iOS or Android devices and no screen reader were used. The
  matrix only emulates these.
- No performance measurement.
