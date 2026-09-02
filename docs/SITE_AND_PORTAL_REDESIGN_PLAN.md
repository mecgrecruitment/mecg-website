# Site and portal redesign plan

Status: In progress on `codex/site-portal-redesign`  
Date: 2026-09-01  
Primary owner: Engineering owner  
Content owners: VP External, VP Marketing, and VP Recruitment  
Reviewers: President and VP Consulting

## Current implementation checkpoint

- `/design-preview` is the working homepage art-direction prototype.
- The prototype includes the editorial layout, named-organization proof, engagement specifications, two audience paths, real MECG photography, responsive behavior, reduced-motion handling, and the dependency-free Decision Transmission scene.
- The Decision Transmission replaces the generic plane stack with mechanically connected 11-, 9-, and 7-tooth gears derived from MECG's gear identity. A visible orange route connects the defined question to a decision brief.
- The prototype is intentionally separate from `/home` until its direction is approved. The next checkpoint is to revise the prototype from stakeholder feedback, then promote the approved structure into the production marketing routes.
- The root 404 and global-error states are implemented as the first shared recovery-state slice.

## Outcome

Redesign every rendered page and route state in the MECG application. The public site uses verifiable work, a precise editorial system, and one restrained three-dimensional hero scene. The applicant, member, and Board areas use the same visual grammar at a denser, task-focused scale.

The finished application must explain what MECG does, prove that MECG has done it, and make each recruitment task obvious. No page may keep an unrelated legacy style.

The redesign must remain complete when JavaScript, WebGL, or motion is unavailable. Three-dimensional rendering is an optional layer, not the page's structure.

This document is the product-wide implementation plan. It supersedes the scope and phase order in `docs/design/portal-ux-plan.md`. The findings in that document remain valid inputs until implementation or a later audit clears them.

## Executive decision

Use the existing "Precision Instrument" direction in `docs/DESIGN.md`, with one revision: the homepage hero may contain a restrained three-dimensional decision model.

The model must explain MECG's work. It must not act as an ornamental product render. The rest of the site remains editorial, two-dimensional, and proof-led.

The homepage content order is:

1. Positioning and audience actions
2. Verified proof
3. Featured engagement
4. Selected client index
5. Engagement specification
6. Member culture
7. Client and student actions
8. Engineering title-block footer

The rest of the application uses three shared shells:

1. The marketing shell for public editorial pages
2. The portal shell for authentication, application, applicant, check-in, and access states
3. The workspace shell for member and Board operations

The Hash deliberation deck uses a focused workspace-shell mode. The three-dimensional scene appears only on the homepage.

## Why the current site needs a structural change

The current public site is usable, responsive, and accessible at the document level. Its problem is identity and evidence.

### The homepage talks about MECG before it proves MECG's work

`src/app/(marketing)/home/page.tsx` currently presents a hero, a welcome paragraph, a president's message, organizational history, four pillars, and a member-photo carousel. The page does not show the existing `STATS` data, a featured client question, an engagement specification, or a client action.

This order makes MECG look like a student club first and a consulting organization second.

### The implemented interface conflicts with the design brief

`docs/DESIGN.md` requires numbered sections, hairline structure, limited corner radii, proof before people, and a title-block footer. The current marketing pages instead rely on rounded cards, repeated image carousels, conventional section headings, and a standard three-column footer.

The redesign must resolve this conflict in the implementation. It must not create a second design direction.

### The site has data that is not presented as proof

`src/lib/site-content.ts` already contains:

- Four organization statistics
- Fifteen past organizations
- Five service categories
- Four semester facts
- Four engagement steps
- Seven client questions and answers

The homepage does not use `STATS`. The work page presents past organizations primarily as a logo grid. The stronger engagement-step and semester-fact content appears lower on the work page rather than near the first client decision.

### Approved case-study content is the main external dependency

`src/content/projects.public.ts` is empty. This is correct because the file is the public release boundary. It also means the redesign cannot claim detailed results until MECG and the client approve each field.

Workstream 9 in `docs/MECG_EXECUTION_PLAN.md` already defines the publication process. This plan depends on that workstream and does not replace it.

### The three-dimensional runtime is not installed

`docs/DESIGN.md` says that `three` and `@react-three/fiber` are installed. `package.json` and `package-lock.json` contain neither package as of this plan's date.

Do not add a production dependency during the visual prototype phase. Complete the static composition first. Add a runtime only after the prototype review confirms that true depth improves the explanation.

## Audience model

The public site serves two primary audiences.

### Prospective clients

The client needs answers to these questions:

1. Does MECG work on a problem like mine?
2. What will the team produce?
3. How long does the engagement take?
4. Who performs the work?
5. What does MECG need from me?
6. Has MECG completed credible work before?
7. How do I start a conversation?

The primary client action is **Discuss a project**.

### Prospective students

The student needs answers to these questions:

1. Can I apply from my major?
2. What will I do after joining?
3. What will I learn?
4. Who will I work with?
5. What is the weekly commitment?
6. What are the recruitment dates and stages?
7. How do I apply or receive updates?

The primary student action is **Join MECG** when applications are closed and **Apply now** when applications are open.

### Secondary audiences

Members, alumni, university partners, and visitors may use the public site. Do not let their needs displace the two primary actions.

## Reference findings

The redesign borrows information strategy from professional firms. It does not copy their visual branding.

The full September 2026 research record is in `docs/research/PROFESSIONAL_WEBSITE_PATTERNS.md`. It reviews nine current first-party sites and preserves the direct source for each observation. McKinsey, BCG, Arup, WSP, IDEO, frog, Pentagram, BUCK, and UNIT9 are references for information structure or craft, not templates to reproduce.

### Consulting firms lead with authority and outcomes

- [McKinsey](https://www.mckinsey.com/) uses a short business proposition, current editorial material, and explicit capability routes. Its client cases separate the opportunity, the solution, and the impact.
- [BCG Client Impact](https://www.bcg.com/about/client-impact) leads project summaries with outcomes and quantified results.

MECG must show proof before culture content. A three-dimensional scene cannot replace a named client, a real question, or an approved result.

### Engineering and design firms treat work as the main artifact

- [Arup Projects](https://www.arup.com/projects/) uses large project imagery, exact metadata, technical constraints, locations, collaborators, and results.
- [IDEO Work](https://www.ideo.com/work) frames projects with named clients, clear problems, outcomes, and contextual photography.
- [Pentagram](https://www.pentagram.com/) relies on a consistent typographic system and a deep project archive rather than a collection of interface effects.

MECG should present each approved engagement as a record with a question, a contribution, a result, a semester, and a publication status.

### Interactive studios justify three-dimensional work through the task

- [Lusion](https://lusion.co/) sells interactive three-dimensional experiences. Its work is useful as a quality reference, not as an information model for MECG.
- [Dogstudio's Tomorrowland case](https://dogstudio.co/cases/tomorrowland/) used a rich WebGL environment because the website was the event interface itself.

MECG should use one selective scene. The public site is not an interactive portfolio, a game, or a product launch.

## Art direction

### Core visual idea

The site reads like an engineering decision brief.

Use:

- Numbered sections
- Mono-set labels and data
- Large sans-serif headings
- Hairline rules
- Tabular values
- White, paper, and navy fields
- MECG orange for one active status or action
- Real photographs with figure captions
- Project records with structured metadata

The interface must look authored. Avoid repeating the same rounded card pattern across unrelated content.

### Color roles

Keep the current tokens from `src/app/globals.css`:

| Token | Role |
| --- | --- |
| `mecg-navy` | Primary ink and dark fields |
| `mecg-blue` | Secondary headings and quiet fills |
| `mecg-orange` | Filled action and dark-field status |
| `mecg-orange-ink` | Light-field status text |
| `paper` | Artifact and image mat |

Do not introduce another accent color for the three-dimensional scene.

### Typography

The current `--font-montserrat` variable resolves to a system font stack. It does not load Montserrat. Choose one of these options during Phase 1:

1. Self-host Montserrat and Geist Mono, as required by `docs/MECG_EXECUTION_PLAN.md`.
2. Adopt the current Avenir Next system stack and update `docs/DESIGN.md` to name it accurately.

Do not proceed with the visual-system implementation until this choice is recorded.

Use mono only for:

- Section labels
- Statistics
- Dates and semesters
- Figure captions
- Status lines
- Technical annotations in the hero scene

Use sans-serif text for prose, actions, and headings.

### Surface rules

Use hairlines to group related content. Use background changes to separate major page bands.

Reserve `rounded-2xl` for photographs and the outer edge of a deliberately grouped panel. Use 2px corners for actions. Do not use shadows to separate ordinary marketing content.

### Photography

Assign each photograph one purpose.

- Homepage: one culture photograph near the lower half of the page
- Join page: recruitment and member-community photographs
- Team page: leadership portraits
- Work page: project artifacts and working-session photographs

The existing library supports the prototype but not the finished site. Commission an 18–24-image documentary library:

- One environmental group portrait in a recognizably Michigan setting
- Four to six working-session images showing research, analysis, whiteboards, workshops, or presentations
- Six to eight approved project images showing context, a work product, and a result or handoff
- Consistent current-leadership portraits
- Two to four campus, recruiting, education, or community images

Capture wide, portrait, and detail frames. Do not stage fake client work. Do not use stock or generated people.

Add a maintained photo registry before the new library is published. Each record must contain:

```text
source path
subject and event
date and location
photographer and credit
consent status
client approval status, when relevant
allowed routes
caption
alternative text
review owner and review date
```

No photograph may publish on a client route without confirmed context and permission. Reuse one photograph on no more than two public pages.

Do not repeat the same carousel on the homepage and join page.

Every public photograph needs a caption in this format:

```text
FIG. 03 / MECG PROJECT TEAM, ANN ARBOR, WINTER 2026
```

Use real dates and locations. Do not infer context from a filename.

## Homepage specification

### 01 / Hero

Use a split composition on wide screens:

- Left: positioning, one supporting sentence, and two audience actions
- Right: the decision model

Proposed working copy:

```text
Engineering teams for decisions that need evidence.

MECG pairs University of Michigan students with organizations for
semester-long, pro-bono consulting engagements.
```

Actions:

- **Discuss a project**
- **Join MECG** or **Apply now**, based on recruitment state

The content owner must approve final copy. Do not use "impact-driven," "innovative solutions," "complex challenges," or "shaping tomorrow."

Completion criteria:

- A visitor can identify the service and both audience routes without scrolling.
- The heading remains understandable when the canvas is absent.
- The hero reserves the final scene dimensions before JavaScript loads.

### 02 / Proof strip

Render four verified facts from `STATS` as one hairline grid.

Candidate facts:

- `70+ / MEMBERS`
- `30+ / ORGANIZATIONS`
- `2023 / FOUNDED`
- `ALL / MAJORS`

The content owner must confirm each fact and its review date. Do not animate the values from zero.

Completion criteria:

- Proof appears immediately after the hero.
- Every number has a source and review date outside the public component.
- Values use tabular numerals.

### 03 / Featured engagement

Publish one engagement as the primary proof record.

The record contains:

- Client label
- Semester
- Industry
- Client question
- MECG contribution
- Approved result or publication status
- Methods
- Deliverables
- One approved artifact or contextual image

When a result is not approved, render a status line:

```text
STATUS / OUTCOME PENDING CLIENT APPROVAL
```

Do not replace the result with a vague claim.

Completion criteria:

- The section remains useful when only the client, question, methods, and status are public.
- Every displayed field comes from the approved public-project boundary.
- The section links to a detail page only when that detail page has approved content.

### 04 / Client index

Replace the primary fifteen-logo grid with a quieter indexed list.

Each row contains:

- Index
- Client name
- Industry
- Public engagement status
- Link state

Show logos as supporting marks, not as the only information.

Completion criteria:

- The client index is readable without images.
- The index distinguishes an approved case from a named past organization.
- Hover and focus change the index and status color without moving the row.

### 05 / Engagement specification

Present `SEMESTER_FACTS` and `ENGAGEMENT_STEPS` as one engineering specification.

The top row contains cost, duration, team size, and confidentiality. The lower rows contain the four engagement stages and their outputs.

Completion criteria:

- A prospective client can understand the engagement without opening another page.
- Each stage names its output.
- The section uses rows and rules, not a set of service cards.

### 06 / People and culture

Use one photograph and a short captioned statement. Link to the team and join pages.

Do not restore a president's letter to the homepage. Leadership content belongs on the team page.

Completion criteria:

- Culture follows work evidence.
- The image has a confirmed caption.
- The section adds information that the join page does not repeat verbatim.

### 07 / Audience actions

End the page with two equal routes:

- `FOR ORGANIZATIONS / DISCUSS A PROJECT`
- `FOR STUDENTS / JOIN MECG`

Recruitment status controls the student label and destination.

Completion criteria:

- Each action has one destination.
- Expired applications do not remain the primary action.
- The client route lands at the client inquiry form.

### 08 / Title-block footer

Replace the generic footer columns with a hairline title block.

Include:

- Organization
- Location
- Contact
- Recruitment state
- Academic term
- Site revision date
- Social links
- Required legal text

Completion criteria:

- The footer remains legible in a single mobile column.
- The revision and recruitment values come from maintained data.
- External links identify their destination.

## Supporting-page changes

### Work page

Order the page as:

1. Client proposition and inquiry action
2. Featured approved engagements
3. Engagement specification
4. Client index
5. Client questions and answers
6. Client inquiry action

Remove the generic service-card grid after the project records explain MECG's capabilities. Keep service categories only when they help a client filter work.

### Join page

Order the page as:

1. Recruitment state and action
2. Recruitment timeline
3. Application process
4. Weekly commitment and expectations
5. Member experience
6. Culture photography
7. Questions and answers
8. Interest form or application action

The join page may feel warmer than the work page. It must still use the same section-label, typography, and rule system.

### Team page

Add disciplines or majors only when the Board can maintain them. Keep names, roles, and contact routes easy to scan.

Do not animate portrait scaling beyond a restrained image treatment. A leadership page should emphasize accountability.

### Contact page

Separate the client inquiry from general contact.

The client inquiry asks for:

- Organization
- Contact name
- Contact email
- Decision or question
- Desired timing
- Available information
- Confidentiality needs

The general contact route remains available for university and community inquiries.

### Header

Use audience-oriented navigation:

- For clients
- For students
- About
- Member log in

Show one contextual filled action. Recruitment state and the current route determine whether that action is **Apply now** or **Discuss a project**.

## Feature backlog and decision order

The redesign should become more useful as it becomes more expressive. Do not add features merely to make the website feel larger.

### Now: credibility and conversion

- Complete the audience-oriented marketing header and title-block footer.
- Promote the approved homepage structure from `/design-preview` into `/home` after visual review.
- Show named organizations separately from approved case studies.
- Add the engagement specification: pro bono, one semester, 6–8 students, NDA support, typical outputs, and expected response time.
- Split client and student actions in the hero and closing section.
- Split the contact experience into client inquiry and general inquiry without changing the public API until the new fields have an approved data contract.
- Publish the recruitment cycle, stages, evaluation traits, preparation guidance, and maintained application action on `/join`.
- Add a current-team accountability directory with role ownership and contact routes.

### Next: evidence system

- Publish the first three client-approved case studies.
- Add a project-artifact component with redaction, caption, credit, and approval metadata.
- Add named, approved client testimonials beside the case they support.
- Create one public project data source consumed by the homepage, work index, related work, and metadata.
- Add an administrative preview-and-approval step in `/admin/projects` for facts, images, artifacts, testimonials, and publication state.
- Add a photo registry so captions and consent are not scattered through components.
- Measure client-inquiry starts/completions and join-to-apply transitions without session replay or invasive tracking.

### Later: only after content depth exists

- Add service and organization-type filters after at least four approved cases; add deeper archive filters only after roughly twelve.
- Add an insights library only when every item has an author, publication date, editorial owner, and review cadence.
- Add previous-Board or alumni archives only when the underlying records are complete and maintained.
- Add a WebGL Decision Transmission only when it clearly improves comprehension over the SVG poster and passes the performance gate.
- Add downloadable project or recruitment briefs only when an owner commits to termly review.

### Reject

- AI-generated people, clients, offices, testimonials, artifacts, or project results
- A generic chatbot or “AI consultant”
- Fake live counters, application-chance calculators, or indefensible ROI calculators
- Autoplay video, infinite logo marquees, scroll hijacking, continuous 3D rotation, cursor effects, particles, glow, glass, or fake terminals
- A news feed, newsletter, or photo journal without an editor and a repeatable publishing process
- Filters on a portfolio too small to need them

## Product-wide shell system

The redesign reaches every page through shared shells first. Page-level changes then address each task.

### Marketing shell

The existing `src/app/(marketing)/layout.tsx` owns the public header, footer, skip link, content width, and page background.

The redesigned shell provides:

- The audience-oriented header
- The title-block footer
- The public focus-ring policy
- The editorial section grid
- The public route transition policy

Public pages do not render their own site header or footer.

### Portal shell

`src/components/portal-shell.tsx` owns authentication, application, applicant, check-in, password recovery, and access-denied pages.

Keep two variants:

- `centered` for one short task
- `split` for a form or status dashboard that benefits from context

The portal shell provides the logo, route back to the public site, account action, consistent outer card, page label, heading, status area, and mobile safe area.

Do not place the three-dimensional hero scene in the portal shell. Use the technical grid as a static background motif.

### Workspace shell

Introduce a shared workspace shell for all `/member` and operational `/admin` pages. Current pages repeat their own `<main>`, width, padding, header, and navigation. That repetition is the main route for future visual drift.

The workspace shell provides:

- `max-w-7xl` page width
- Workspace background
- `WorkspaceHeader`
- `WorkspaceNav`
- Breadcrumb or back action
- Page status and operation notices
- Consistent section spacing
- A focused mode for deliberation and live grading

Candidate component:

```ts
type WorkspaceShellProps = {
  user: AuthenticatedUser;
  cycleId?: string;
  current?: string;
  eyebrow: string;
  title: string;
  description?: string;
  backAction?: React.ReactNode;
  mode?: "standard" | "focused";
  children: React.ReactNode;
};
```

The exact user type must come from the current authentication module. Do not create a duplicate user shape for this component.

### Focused workspace mode

Use the focused mode for live, single-purpose tasks:

- Hash deliberation
- Live event grading
- Blind screening review
- Event check-in

Focused mode removes unrelated navigation from the immediate task area. It keeps a clear exit, progress, identity context, and autosave or submission status.

## Complete route coverage

This plan covers all 37 `page.tsx` files found on 2026-09-01. Regenerate the inventory with:

```bash
find src/app -type f -name 'page.tsx' -print | sort
```

If the command returns a route that is absent from the tables below, stop the redesign release and add the route to this plan and the visual test matrix.

### Public marketing routes

| Route | Job | Redesign plan | Completion criterion |
| --- | --- | --- | --- |
| `/home` | Explain MECG and route both audiences | Apply the eight-section homepage specification. Use the decision-model poster and optional scene. | Positioning, both actions, proof, and work evidence appear before culture. |
| `/work` | Convert a prospective client | Lead with approved engagements and the engagement specification. Move the client index below the proof. Remove generic service cards once project records cover the capability. | A client can understand fit, process, output, and the next action without another page. |
| `/work/[slug]` | Prove one approved engagement | Use a case-record layout with question, context, constraints, methods, deliverables, result or status, artifacts, contributors, semester, and a client action. | Every field comes from the approved export boundary. The page remains honest when the result is pending. |
| `/join` | Explain recruitment and drive the current student action | Lead with recruitment state, dates, stages, preparation, and weekly commitment. Move culture after process. Replace the repeated carousel with selected captioned images. | The page shows one correct action for the current recruitment state. |
| `/team` | Establish leadership accountability | Use a compact editorial directory. Add role, approved discipline or major, LinkedIn, and optional contact. Keep portraits still and consistently cropped. | Every listed person has a current role and working contact route. |
| `/contact` | Route client and general inquiries | Split the client-project form from general contact. Put direct email and organization details in the title block. | A client inquiry captures the question, timing, available information, and confidentiality needs. |

### Authentication and utility routes

| Route | Job | Redesign plan | Completion criterion |
| --- | --- | --- | --- |
| `/login` | Send one account to the correct workspace | Use the centered portal shell. Reduce the introduction. Keep email and password visible without scrolling. Show field-level errors and one recovery route. | The first invalid field receives focus and identifies its error. |
| `/forgot-password` | Request a recovery email | Use the centered portal shell with one field, one action, a sent state, and a return-to-login action. | The sent state does not reveal whether an account exists. |
| `/reset-password` | Set the new password | Use the centered portal shell. Show requirements before entry and confirmation after success. | Invalid, expired, and successful recovery states use the same shell and provide a next action. |
| `/access-denied` | Explain inactive or unauthorized access | Use a small centered status record with the reason that can be disclosed, sign-out, and public-site actions. | The page never dead-ends and never exposes a protected role or permission. |
| `/checkin/[token]` | Complete event check-in in seconds | Use focused portal mode. Put event, time, signed-in identity, and one check-in action above the fold. Design valid, invalid, unavailable, already checked-in, and success states. | A 390px viewport completes the common path without scrolling. |
| `/admin/login` | Preserve a legacy entry point | Keep the redirect to `/login`. Give the destination the complete authentication redesign. | The redirect remains server-side and adds no duplicate login interface. |
| `/applicant/[token]` | Preserve a legacy applicant link | Keep the redirect to `/applicant`. Preserve safe query or return information only when the current routing contract requires it. | The redirect reaches the redesigned applicant dashboard without exposing the legacy token. |

### Application and applicant routes

| Route | Job | Redesign plan | Completion criterion |
| --- | --- | --- | --- |
| `/apply` | Create an applicant account and submit an application | Use split portal mode on desktop and one column on mobile. Keep recruitment status, step progress, autosave state, requirements, and the current form action visible. Design logged-out signup, closed cycle, draft, validation error, upload, submitted, and reapplication states. | The sticky mobile action cannot cover a focused field. Every step restores focus to its heading. |
| `/applicant` | Show application status and required actions | Lead with the current application state rather than a greeting. Put the status stepper, next action, and next scheduled event above secondary details. Design active, withdrawn, resubmittable, waitlist, rejection, offer, RSVP, buddy, survey, and no-application states. | The applicant can answer "what happens next" from the first screen. Released state changes are announced. |

### Member routes

| Route | Job | Redesign plan | Completion criterion |
| --- | --- | --- | --- |
| `/member` | Show a member's current duties | Use the workspace shell. Lead with the nearest incomplete assignment and its deadline. Follow with completed work, profile, password, and buddy-slot management. Remove decorative dashboard cards. | The first screen identifies the next task and whether the member is finished. |
| `/member/event` | Grade applicants during a live event | Use focused workspace mode. Show event identity, progress, nearest ungraded applicant, and collapsed remaining rows. Keep graded rows visually complete. | Only one ungraded evaluation form is open by default on mobile. |
| `/member/screening` | Show blind-review assignments | Use the workspace shell with status counts, due state, conflict guidance, and an indexed assignment list. | Pending, complete, recused, and unavailable assignments are distinguishable without color alone. |
| `/member/screening/[assignmentId]` | Complete one blind review | Use focused workspace mode. Keep packet evidence, current question, rating anchors, recusal, submission status, and progress in a stable reading order. | Rating meanings are visible on touch. Keyboard operation follows the radio-group pattern. |

### Board routes

| Route | Job | Redesign plan | Completion criterion |
| --- | --- | --- | --- |
| `/admin` | Run the current recruitment cycle | Use the workspace shell. Put urgent operations and actionable counts above the applicant pipeline. Collapse setup into a clear empty-cycle state. Show roster rows within the first desktop viewport. | Every attention count links to the filtered work that resolves it. |
| `/admin/applications/[id]` | Review one applicant dossier | Use a case-file layout. Keep identity, stage, conflict state, resume, responses, attendance, evaluations, decisions, and audit history in a stable tab order. Use a sticky summary on wide screens. | A reviewer can identify missing evidence and the next allowed action without scanning the full page. |
| `/admin/audit` | Inspect immutable cycle activity | Use an indexed event ledger with filters for actor, event type, applicant, and date. Keep raw details expandable. | The newest event and active filters remain visible. Entries never appear editable. |
| `/admin/events/new` | Create an attendance event | Use the workspace shell and one form column. Explain the QR publication consequence beside the create action. | Validation errors identify the field and the new event opens in an unpublished state. |
| `/admin/events/[id]` | Operate one event | Use an event command layout with status, time, QR code, rotation control, slots, grading state, attendance, and destructive actions separated by risk. | The current check-in link and grading state are unmistakable. Destructive actions require confirmation. |
| `/admin/rounds` | Configure evaluation rounds and rubrics | Use indexed round rows with state, coverage, rubric summary, and allowed actions. Open editors in place or in a focused panel. | Each round shows whether assignments and rubric coverage are ready before opening. |
| `/admin/speed-dating` | Operate the speed-dating round | Apply the shared round-board redesign with the speed-dating label, coverage, evaluator load, and applicant list. | The page identifies uncovered applicants and overloaded evaluators without calculation by the user. |
| `/admin/group-case` | Operate the group-case round | Apply the shared round-board redesign with group context, coverage, evaluator load, and applicant list. | Group membership and evaluation coverage remain visible together. |
| `/admin/groups` | Build and manage case teams | Use a two-pane assignment view on desktop and a stepped view on mobile. Show capacity, duplicates, and unassigned applicants. | Every applicant appears in one clear assignment state. |
| `/admin/screening` | Prepare and assign blind packets | Use an operations ledger with packet state, identity-steward context, freeze status, reviewer coverage, and bulk controls. | Frozen evidence, unassigned packets, and review shortages are visible before assignment. |
| `/admin/hash` | Prepare final deliberation | Lead with readiness checks, round coverage, unresolved evidence, decision state, and the action that opens the deck. | The deck action remains disabled until every documented prerequisite passes. |
| `/admin/hash/deliberate` | Run live final deliberation | Use focused workspace mode with large projector-safe type, `N of M`, keyboard navigation, announced card changes, decision state, and one clear exit. | The current applicant, position, and saved decision state are visible at all times. |
| `/admin/messages` | Compose and review recruitment messages | Separate compose and delivery history. Use audience filters, recipient count, preview, sending state, and an immutable sent ledger. | The user sees the final recipient count and content before sending. |
| `/admin/notifications` | Recover failed message delivery | Lead with failures, retry state, and the reason. Put recent successful delivery below. | Retrying is idempotent, and the interface distinguishes recruitment state from email state. |
| `/admin/operations` | Check production readiness | Use a compact owner-only checklist with configuration category, pass or fail, last check, and safe remediation. Keep secret values absent. | Every failure names an action or runbook without displaying a credential. |
| `/admin/people` | Read the member directory and manage roles | Use an indexed directory with search and role filters. Put role management behind the existing permission. Replace pill-heavy cards with rows or compact records. | Read-only members and managers use the same page without seeing unauthorized controls. |
| `/admin/projects` | Maintain the public-work pipeline | Separate project facts, staffing, approval state, artifacts, and publication readiness. Add a preview that reads the same public model as `/work/[slug]`. | A project cannot appear ready while a required approval or public field is missing. |
| `/admin/settings` | Manage cycle-level intake and workflow settings | Group controls by consequence. Put current cycle state first, intake questions second, and destructive lifecycle actions last. | Each action explains the affected users and state before confirmation. |

## Route-level states and missing global states

The repository has eight route-level loading and error files. Redesign all eight through shared state components.

| File | Redesign plan | Completion criterion |
| --- | --- | --- |
| `src/app/admin/loading.tsx` | Use the workspace shell skeleton with static blocks that match the dashboard layout. | No looping pulse and no layout jump when content arrives. |
| `src/app/admin/error.tsx` | Use the workspace error record with retry, safe back action, and incident wording. | Retry calls Next's `reset` function and focus moves to the result. |
| `src/app/member/loading.tsx` | Use the workspace shell skeleton with one visible next-task placeholder. | No looping pulse and no false interactive controls. |
| `src/app/member/error.tsx` | Use the workspace error record with retry and a safe route to account access. | The user can recover or leave the workspace. |
| `src/app/applicant/loading.tsx` | Use the portal shell with a static status-dashboard skeleton. | The skeleton reserves the final hero and action dimensions. |
| `src/app/applicant/error.tsx` | Use the portal error record with retry, sign-out, and support contact. | Retry uses the actual `reset` prop and never throws. |
| `src/app/apply/loading.tsx` | Use the portal shell with a static form-step skeleton. | The skeleton reserves the action bar and contains no loop. |
| `src/app/apply/error.tsx` | Use the portal error record with retry and return-to-application actions. | Retry uses the actual `reset` prop and preserves recoverable draft data. |

Add these missing root states:

- `src/app/not-found.tsx` for a branded 404 with public, applicant, and account routes
- `src/app/global-error.tsx` for a minimal failure page that does not depend on the ordinary application shell

Do not add loading screens to static marketing routes. A loading screen would hide content that can render directly.

## Page-family rules

### Public pages use editorial rhythm

Public pages use large type, numbered sections, real artifacts, captions, and generous spacing. The homepage alone may use WebGL.

### Portal pages optimize one decision

Application, applicant, authentication, recovery, and check-in pages show one current state and one primary action. They do not imitate marketing-page length or workspace density.

### Workspace pages optimize repeated operations

Member and Board pages use compact rows, status labels, filters, and clear completion states. They do not use large decorative heroes, project photography, or three-dimensional elements.

### Every page handles five states

For each route, document and verify:

1. Normal data
2. Empty data
3. Loading
4. Recoverable failure
5. Unauthorized or unavailable action

A route may inherit loading or failure behavior from its shell. The route still needs a visual test that proves the inherited state fits its content.

## Visual coverage enforcement

Add a checked route manifest for the redesign. The manifest records each page file, route, shell, fixtures, and required viewport.

Candidate shape:

```ts
type RedesignRoute = {
  file: string;
  route: string;
  shell: "marketing" | "portal" | "workspace" | "focused" | "redirect";
  fixtures: readonly string[];
  viewports: readonly ("mobile" | "desktop" | "projector")[];
};
```

Add a verification script that compares the manifest with `find src/app -name page.tsx`. Fail when either list contains an unmatched page file.

Organize the visual tests by shell:

```text
tests/e2e/
  marketing-visual.spec.ts
  portal-visual.spec.ts
  member-visual.spec.ts
  admin-visual.spec.ts
  route-coverage.spec.ts
```

Protected-page screenshots require deterministic seeded users for applicant, member, Board, Hash, and owner permissions. Do not use live production data for visual tests.

## Motion specification

Motion communicates state, order, or physical relationship. Motion does not decorate idle content.

### Timing tokens

Keep the existing token families and map them to these uses:

| Token | Duration | Use |
| --- | ---: | --- |
| `--t-detent` | 150ms | Hover, focus, and press feedback |
| `--t-shift` | 360 to 420ms | Panel and page-state changes |
| `--t-seat` | 600 to 700ms | Infrequent section entrance |
| Hero assembly | 1600 to 2000ms | One initial scene sequence |

Do not add a general-purpose animation library for section reveals.

### Section entrance

Reveal a section only when the entrance clarifies reading order.

Use:

- Opacity from 0 to 1
- Vertical movement of 8 to 12px
- At most three staggered children
- A maximum stagger of 60ms

Do not animate routine table rows, form fields, or every card in a grid.

### Hover and focus

Use color, underline, index movement, or a 2px directional shift. Do not scale ordinary cards.

Every animated state must also have a static cue.

### Reduced motion

When `prefers-reduced-motion: reduce` matches:

- Use the static hero poster.
- Disable section movement.
- Keep immediate color and focus-state changes.
- Disable smooth carousel movement.

## Three-dimensional hero specification

### Concept: Decision Transmission

The scene represents MECG's consulting process as a compact mechanical decision instrument derived from the actual MECG gear mark. A scoped question enters on the left. A rail fixes the decision boundary. Interlocked gears organize evidence, test tradeoffs, and transmit the result to a paper-colored decision brief on the right.

Use these functional parts:

- A ruled datum plate for the problem boundary and known constraints
- A define rail with three fixed stops for scope, evidence required, and the decision criterion
- An 11-tooth analyze gear for evidence
- A 9-tooth model gear for tradeoffs
- A 7-tooth output pinion for conversion into action
- A recommendation carriage labeled `DECISION BRIEF`
- One continuous orange route through the rail, gear contacts, and carriage

The gear ratios must remain mechanically coherent. The final CSS/SVG prototype rotates analyze `+44°`, model `-53.78°`, and output `+69.14°`. Do not put text on rotating gear faces.

Use screen-aligned labels for the four work stages:

1. Define
2. Analyze
3. Model
4. Recommend

Replace invented status language such as `System aligned` with factual drawing metadata:

- `DECISION TRANSMISSION / REV 01`
- `METHOD / 04 STAGES`
- `TRACE COMPLETE`

The initial arrangement is legible but unresolved. The parts align during the entrance sequence. The orange route draws only after the gears seat and reaches the decision brief last.

### Scene states

#### Poster

The server renders a static image or SVG that matches the final assembled state. The poster occupies the exact canvas dimensions.

Completion criterion: the hero looks finished before the three-dimensional runtime loads.

#### Assemble

Run the 1,840ms sequence once after the scene is ready:

1. `0–220ms`: establish the datum grid and dimension ticks.
2. `180–520ms`: seat the baseplate along one axis.
3. `430–730ms`: close the define rail and align its stops.
4. `690–1,190ms`: seat the gear train with a 45ms stagger.
5. `1,120–1,480ms`: rotate the gears at their real ratios while drawing the orange route.
6. `1,420–1,720ms`: advance the recommendation carriage.
7. `1,570–1,840ms`: reveal labels and the completed-trace state.

Do not replay the sequence when the user returns to the browser tab.

#### Idle

Stop most movement after assembly. A damped pointer response may rotate the camera by no more than 2 degrees.

Completion criterion: the scene does not demand attention while the visitor reads.

#### Scroll handoff

During ordinary page scroll, reduce depth and align the datum lines with the proof-strip grid. Do not take control of the scroll position.

Completion criterion: the proof strip remains reachable through normal scrolling with JavaScript disabled.

#### Offscreen

Pause rendering when the hero leaves the viewport.

Completion criterion: the canvas does not consume animation frames while offscreen or hidden.

### Scene appearance

Use:

- Orthographic or near-orthographic projection
- Matte paper, navy, and desaturated steel materials
- Thin linework
- Soft ambient lighting
- One orange route
- Procedural gear geometry rather than pasted opaque model paths

Avoid:

- Reflective chrome
- Glass and refraction
- Gradient meshes
- Particle clouds
- Globes
- Floating orbs
- Smoke
- Bloom
- Dramatic depth of field
- Audio
- Custom cursors

### Accessibility

Treat the scene as decorative because the adjacent DOM copy explains the service. Use `aria-hidden="true"` on the canvas container. Do not put required content or controls inside WebGL.

The static poster also uses empty alternative text when the nearby copy provides the same meaning.

### Mobile policy

Use the poster by default on small and touch-first devices. Consider a simplified scene only after desktop performance and clarity pass.

A simplified mobile scene may assemble once. It must not respond to device orientation or require touch manipulation.

## Proposed component boundaries

Keep WebGL lifecycle and rendering details out of the page component.

```text
src/components/
  portal-shell.tsx
  workspace-shell.tsx
  workspace-state.tsx
  workspace-header.tsx
  workspace-nav.tsx
  section-label.tsx
  stat-tile.tsx
  status-pill.tsx
  segmented-control.tsx
  operation-notice.tsx
  marketing/
    home-hero.tsx
    proof-strip.tsx
    featured-engagement.tsx
    client-index.tsx
    engagement-spec.tsx
    audience-actions.tsx
    title-block-footer.tsx
    decision-model/
      decision-model.tsx
      decision-model-poster.tsx
      decision-model-canvas.tsx
      decision-model-scene.ts
      use-scene-policy.ts
```

Responsibilities:

- `portal-shell.tsx` owns one-task and applicant-facing layouts.
- `workspace-shell.tsx` owns member and Board page composition.
- `workspace-state.tsx` owns loading, empty, and recoverable error records.
- `section-label.tsx`, `stat-tile.tsx`, `status-pill.tsx`, and `segmented-control.tsx` keep repeated operational patterns consistent.
- `decision-model.tsx` selects the poster or canvas.
- `decision-model-poster.tsx` renders the server-safe final state.
- `decision-model-canvas.tsx` owns the client runtime and lifecycle.
- `decision-model-scene.ts` defines geometry, materials, camera, and scene states.
- `use-scene-policy.ts` applies reduced-motion, viewport, capability, and device rules.

Do not make the homepage aware of renderer initialization, frame loops, or WebGL errors.

## Public content model

Extend the public project model only after the content owners confirm that the fields can be maintained.

Candidate shape:

```ts
type PublicEngagement = {
  slug: string;
  clientLabel: string;
  industry: string;
  semester: string;
  question: string;
  contribution: string;
  result?: string;
  publicationStatus: "approved" | "result-pending" | "summary-only";
  methods: readonly string[];
  deliverables: readonly string[];
  artifact?: PublicArtifact;
};

type PublicArtifact = {
  src: string;
  alt: string;
  caption: string;
};
```

The exporter remains fail-closed. A missing approval must remove the field or project from the public bundle.

Do not maintain separate handwritten copies of project facts for the homepage and work page. Both pages read the approved public record.

## Performance budgets

Treat these values as release targets for this project:

| Measure | Target |
| --- | ---: |
| Largest contentful paint on a mobile test profile | 2.5s or less |
| Cumulative layout shift | 0.05 or less |
| Interaction to next paint | 200ms or less |
| Three-dimensional JavaScript chunk | 175KB gzip or less |
| Scene texture payload | 0 |
| Scene geometry | 25,000 triangles or fewer |
| Desktop draw calls | 15 or fewer |
| Device pixel ratio | Capped at 1.5 |
| GPU memory target | 16MB or less |
| Desktop frame rate after assembly | 55 frames per second or more on the agreed test device |
| Offscreen frame rate | 0 |

Load the hero copy and poster before the renderer. Do not delay the first meaningful paint for WebGL.

Use procedural geometry before adding a model file. If a model becomes necessary, document its source, license, compressed size, and reduction process.

## Anti-template guardrails

Use these guardrails during design review:

- Every claim has a number, client, question, artifact, or named source.
- Each section has a different information job.
- The layout uses rows, rules, captions, and metadata before cards.
- The design uses one accent color per view.
- The hero contains one authored visual concept.
- Motion stops after communicating a change.
- Photography carries a confirmed context.
- Copy names the action, decision, method, or output.

Reject a design when it depends on:

- A glowing orb or abstract chrome object
- Glass cards
- A dark gradient as the main identity
- A typing headline
- A fake terminal
- A looping marquee
- Count-up statistics
- A magnetic cursor
- Scroll hijacking
- A repeated three-card layout on most sections
- Phrases that could describe any consulting group

## Implementation sequence

### Phase 0: Record the baseline

Owner: Engineering owner  
Dependency: None

Actions:

1. Capture desktop and mobile screenshots for every public route.
2. Record current Lighthouse and browser-test results.
3. Record current route payloads.
4. Confirm the current approved content inventory.
5. Confirm the typography decision.

Completion criteria:

- The repository contains or links to the baseline evidence.
- Every public route has a desktop and mobile reference.
- The typography decision is recorded in `docs/DESIGN.md`.

### Phase 1: Approve content and art direction

Owners: VP External, VP Marketing, and VP Recruitment  
Dependency: Client and Board review

Actions:

1. Approve the homepage facts.
2. Select the featured engagement.
3. Approve the client index.
4. Write captions for selected photographs.
5. Approve the client and student actions.
6. Produce three static decision-model directions.
7. Select one final static composition and one reduced-motion poster.

Completion criteria:

- Every homepage fact has an owner and review date.
- The selected engagement has an explicit publication status.
- The final static hero works without WebGL.
- The reviewers approve the art direction before implementation.

### Phase 2: Rebuild the shared visual system

Owner: Engineering owner  
Dependency: Phase 1 typography and art direction

Expected files:

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/section-label.tsx`
- `src/components/section-heading.tsx`
- `src/components/marketing-section.tsx`
- `src/components/site-header.tsx`
- `src/components/site-footer.tsx`
- `src/components/portal-shell.tsx`
- `src/components/workspace-shell.tsx`
- `src/components/workspace-state.tsx`
- `src/components/workspace-header.tsx`
- `src/components/workspace-nav.tsx`

Actions:

1. Load or accurately name the chosen fonts.
2. Apply the numbered label grammar.
3. Add shared metadata, caption, and indexed-row styles.
4. Replace the footer with the title block.
5. Simplify the header.
6. Build the workspace shell.
7. Consolidate portal cards and workspace states.
8. Standardize `StatTile`, `StatusPill`, and `SegmentedControl`.
9. Remove shadow and radius patterns that conflict with the direction.

Completion criteria:

- Shared primitives render correctly on white, paper, blue, and navy.
- Focus indicators meet the current contrast rules.
- Mobile controls keep a 44px target.
- The portal retains one documented outer-card exception.
- Every member and Board page can use the workspace shell without route-specific width or padding.

### Phase 3: Build the static homepage

Owner: Engineering owner  
Dependencies: Phases 1 and 2

Expected files:

- `src/app/(marketing)/home/page.tsx`
- New components under `src/components/marketing/`
- `src/lib/site-content.ts`
- Approved public-project files

Actions:

1. Build the final page order.
2. Render the static decision-model poster.
3. Add the proof strip.
4. Add the featured engagement.
5. Add the client index.
6. Add the engagement specification.
7. Add one culture section.
8. Add the audience actions.

Completion criteria:

- The homepage meets every section criterion in this plan without WebGL.
- The first two viewport heights contain positioning, both actions, proof, and the start of work evidence.
- No unapproved result or artifact enters the public bundle.

### Phase 4: Decide whether to add WebGL

Owner: Engineering owner  
Reviewers: VP Marketing and one independent design reviewer  
Dependency: Static homepage

Build a throwaway motion prototype against the final poster. Compare:

1. SVG and CSS depth
2. Canvas or WebGL depth

Approve WebGL only when the second option:

- Explains the assembly more clearly
- Meets the performance budget
- Degrades to the same finished poster
- Adds no required interaction
- Remains maintainable by the current engineering owner

If WebGL fails one criterion, ship the SVG and CSS version.

Adding `three` or another production runtime requires explicit approval under the repository authorization policy.

### Phase 5: Implement the motion system

Owner: Engineering owner  
Dependency: Phase 4 decision

Actions:

1. Implement the scene-policy boundary.
2. Implement the one-time assembly sequence.
3. Pause the scene when offscreen.
4. Add the native-scroll handoff.
5. Apply restrained section entrances.
6. Implement the reduced-motion path.
7. Record the final motion values in `docs/DESIGN.md`.

Completion criteria:

- The static poster remains the initial and fallback state.
- The scene stops rendering offscreen.
- Reduced motion loads no active scene.
- Keyboard navigation does not enter the canvas.
- Motion at 10 percent playback shows no abrupt seating or clipping.

### Phase 6: Rebuild the remaining public pages

Owner: Engineering owner  
Dependencies: Shared system and approved content

Actions:

1. Rebuild `/work` around approved engagement records.
2. Rebuild `/work/[slug]` as the approved case record.
3. Reorder `/join` around recruitment state and process.
4. Retune `/team` around accountability and portrait captions.
5. Split client and general inquiry on `/contact`.
6. Remove repeated homepage content from supporting pages.

Completion criteria:

- Every public page has one clear primary action.
- Every section uses the shared label grammar.
- The work and join pages answer their audience questions without relying on the homepage.

### Phase 7: Rebuild portal and applicant flows

Owner: Engineering owner  
Dependencies: Portal shell and workspace shell

Actions:

1. Rebuild `/login`, `/forgot-password`, and `/reset-password`.
2. Rebuild `/access-denied` and `/checkin/[token]`.
3. Rebuild `/apply` across signup, closed, draft, upload, error, and submitted states.
4. Rebuild `/applicant` across every application and decision state.
5. Rebuild the applicant and application loading and error states.
6. Verify the two legacy redirects against their redesigned destinations.

Completion criteria:

- Every route in the authentication, utility, application, and applicant tables passes its route criterion.
- The common action appears above the fold at 390px.
- Focus and live-region behavior pass keyboard and screen-reader checks.

### Phase 8: Rebuild member work

Owner: Engineering owner  
Dependency: Workspace shell and shared operational components

Actions:

1. Rebuild `/member` around the next incomplete duty.
2. Rebuild `/member/event` in focused mode.
3. Rebuild `/member/screening` as an assignment ledger.
4. Rebuild `/member/screening/[assignmentId]` in focused mode.
5. Rebuild member loading and error states.
6. Standardize all rating controls and visible score anchors.

Completion criteria:

- Every member route passes its route criterion.
- No common mobile task opens more than one long form at a time.
- Completed, pending, unavailable, and recused states remain distinct without color alone.

### Phase 9: Rebuild the Board command center

Owner: Engineering owner  
Dependencies: Workspace shell and shared operational components

Actions:

1. Rebuild `/admin` and its no-cycle setup state.
2. Rebuild the applicant pipeline with one responsive DOM structure.
3. Rebuild `/admin/applications/[id]` as a case file.
4. Rebuild `/admin/rounds`, `/admin/speed-dating`, and `/admin/group-case` as one round system.
5. Rebuild `/admin/groups` and `/admin/screening`.
6. Rebuild `/admin/hash` and the focused deliberation deck.

Completion criteria:

- The dashboard shows actionable work in the first desktop viewport.
- The pipeline renders each applicant once.
- Every live decision screen shows progress, save state, and the next allowed action.

### Phase 10: Rebuild Board operations

Owner: Engineering owner  
Dependencies: Workspace shell and page-specific backend capabilities

Actions:

1. Rebuild event creation and event operation pages.
2. Rebuild messages and notification recovery.
3. Rebuild the audit ledger.
4. Rebuild operations readiness.
5. Rebuild people and role management.
6. Rebuild project publication management.
7. Rebuild cycle settings.
8. Rebuild admin loading and error states.

Do not add controls for absent backend operations. Plan event cancellation, evaluator removal, decision reversal, and membership revocation as separate backend changes before exposing those actions.

Completion criteria:

- Every operational admin route passes its route criterion.
- Permission-gated actions remain absent for unauthorized users.
- Destructive actions state their effect and require confirmation.

### Phase 11: Add route coverage and root states

Owner: Engineering owner  
Dependencies: All page phases

Actions:

1. Add the checked route manifest.
2. Add the route-coverage test.
3. Add the root 404 page.
4. Add the global error page.
5. Add deterministic visual fixtures for every protected route.
6. Capture the required mobile, desktop, and projector screenshots.

Completion criteria:

- The route manifest and `find src/app -name page.tsx` contain the same files.
- All 37 current pages have a planned and tested shell.
- All eight current loading and error states use the redesigned state components.
- The root 404 and global error pages match the same visual system.

### Phase 12: Verify and release

Owner: Engineering owner  
Reviewers: Content owners and accessibility reviewer

Run the repository checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Also verify:

- Desktop and mobile screenshots for every route in the manifest
- Projector screenshot for Hash deliberation
- Keyboard traversal
- Screen-reader landmarks and heading order
- Reduced motion
- WebGL disabled
- JavaScript disabled for the public content path
- Slow network loading
- Canvas pause while offscreen
- No layout shift during poster replacement
- Approved content boundaries
- External links and application-state links
- Role and permission variants
- Empty, loading, error, and unavailable states

Completion criteria:

- Required commands exit with status 0.
- The performance budgets pass on the agreed test setup.
- Content owners approve every public claim.
- The static fallback passes the same content review as the animated state.
- The route coverage test passes.
- Every route-specific completion criterion passes.
- The release checklist records commands, exit statuses, and visual evidence.

## Decision gates

### Gate 1: Content is publishable

Required:

- Verified homepage facts
- Approved client index
- One featured engagement with a publication status
- Approved photographs and captions
- Approved primary actions

### Gate 2: The static design is complete

Required:

- Static homepage approval
- Mobile composition approval
- Reduced-motion poster approval
- Shared visual-system approval

### Gate 3: WebGL earns its cost

Required:

- Clear explanatory benefit over SVG and CSS
- Performance-budget pass
- Complete fallback
- Maintenance owner
- Production-dependency approval

### Gate 4: Shared shells are complete

Required:

- Marketing shell approval
- Portal shell approval
- Workspace shell approval
- Focused workspace mode approval
- Loading and error state approval

### Gate 5: Route coverage is complete

Required:

- Route manifest matches every `page.tsx` file
- Every route has deterministic fixtures
- Every current loading and error file uses the new state system
- Root 404 and global error pages exist
- Mobile and desktop captures exist for every applicable route

### Gate 6: Product release is verified

Required:

- Repository checks pass
- Accessibility review passes
- Visual regression review passes
- Content owners sign off
- Rollback path is recorded

## Risks and controls

| Risk | Effect | Control |
| --- | --- | --- |
| Client approval takes longer than implementation | Featured work remains thin | Design status-first records that remain honest without a result |
| Three-dimensional work delays the redesign | The old homepage remains live | Complete and approve the static homepage before the runtime decision |
| WebGL harms loading performance | The hero delays useful content | Render the poster and copy first, lazy-load the runtime, and enforce budgets |
| The scene looks like a generated technology template | Brand credibility falls | Use the decision-model concept and the anti-template review gate |
| Recruitment data becomes stale | The primary action misleads applicants | Derive labels and destinations from the published recruitment state |
| Metrics drift across pages | Public claims contradict each other | Keep one maintained content record for each fact |
| Marketing spacing enters dense workspaces | Repeated operations become slow and hard to scan | Keep separate marketing, portal, and workspace shells on shared tokens |
| Motion creates accessibility problems | Visitors lose context or comfort | Provide a static path and keep all required information in DOM content |
| Protected routes lack stable visual fixtures | Design regressions remain invisible | Seed deterministic applicant, member, Board, Hash, and owner accounts |
| Page-level layouts bypass the shells | The design diverges again | Make the route manifest record the shell and fail visual review for shell-less pages |

## Ownership after release

### Each semester

VP External:

- Reviews client names and publication permissions
- Updates engagement status
- Requests artifact and result approvals

VP Recruitment:

- Reviews recruitment dates, state, and destinations
- Verifies the student action
- Reviews applicant-facing status and instruction copy

VP Marketing:

- Reviews photographs, captions, statistics, and public copy
- Records the site revision date

Engineering owner:

- Runs the verification checks
- Reviews dependency and browser updates
- Checks performance budgets
- Confirms that the canvas fallback still works
- Runs the route-coverage test
- Reviews every new `page.tsx` against the shell manifest

Board operations owner:

- Reviews workspace labels, empty states, and destructive-action wording
- Confirms that the Board route fixtures still match the live workflow

### Each year

The President and engineering owner review `docs/DESIGN.md`, this plan, and the public content model. They remove stale rules and record any approved design change.

## Out of scope

This plan does not change:

- Recruitment policy or evaluation logic
- Supabase authorization
- Database schema or RPC behavior unless a separately approved page requirement needs it
- Client approval requirements
- The public-project export boundary
- Production deployment configuration
- Analytics implementation

Analytics may be planned separately after the Board defines the questions and retention policy.

## Definition of done

The redesign is complete when:

- The homepage serves both primary audiences without ambiguous navigation.
- Work evidence appears before leadership or culture content.
- One approved engagement is presented as a structured record.
- The visual system matches the recorded Precision Instrument direction.
- The homepage remains complete without WebGL and motion.
- The three-dimensional scene, when included, explains MECG's process and meets its budget.
- Every public claim has an owner and approval state.
- All 37 current pages use the marketing, portal, workspace, focused, or redirect treatment recorded in the route manifest.
- All eight current route-level loading and error files use the redesigned state system.
- The root 404 and global error pages match the same visual system.
- Every route passes its accessibility, responsive, role, and repository checks.
- The route-coverage test fails when a future page lacks a redesign entry.
- `docs/DESIGN.md` and the implemented system no longer contradict each other.
