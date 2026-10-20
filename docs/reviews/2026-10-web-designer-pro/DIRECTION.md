# Public site direction (Web Designer Pro, evolution path)

Date: 2026-10-19. The plan is at `docs/design/2026-10-web-designer-pro-plan.md`.

## Brief (self-authored)

The user asked to implement the plan without answering its open decisions,
so the plan's proposed defaults apply:

- **Evolution, not a new look.** Keep blue `#254f9f`, orange `#fe904d`,
  cool paper and the system sans stack.
- **No numbered eyebrows on public pages.** Mono stays for the footer title
  block only.
- **Motion on interaction only.** No loops.
- **No generated images.** Only real photographs of members and events.
- **Home keeps its process and FAQ.** Removing them was not worth the churn,
  because people arrive at `/home` and `/work` separately.

- **For:** small-organization owners with a real decision to make, and
  Michigan students in every major.
- **One job:** in ten seconds, a client sees that a student team spends a
  semester on their question at no fee, and clicks "Discuss a project". A
  student sees that every major can join.
- **Feel:** capable, warm, exact.

## Current

See `before/` (contact sheets and scan results from 2026-10-19) and the plan's
baseline table. The current site has two public systems (a light home page,
navy inner pages), a flat split hero and the template sequence, and lacks a
first-screen action on team and contact.

## Category default refused

Student consulting clubs share a navy hero, a group photo beside a headline, a
stats row, a logo wall, "Apply now" and numbered section eyebrows. The page
answers "who are we" before "what would we do for you".

## Exploration

Three first screens are in `explore/` (a, b and c).

- **A. A project brief on the desk (chosen).** Cool paper ground. The PwC
  photo is the back plane. The question explorer becomes a blue card that
  crosses the photo's lower-left edge into the ground. Choosing an area
  swaps the question. This is the most *MECG* option because it leads with
  the client's question, and it keeps the whole group photo legible.
- **B. A room full of people.** Lost. The headline over the busy granite and
  crowd fails contrast (2.75:1 measured), and a scrim would hide the people.
- **C. A roster.** Lost on the home page, because it makes the board the
  client's evidence. Its move (portraits crossing from a blue field into
  paper) is grafted onto `/team`, where people are the subject.

The look columns kept are accent, type and source. The columns changed are
grammar (the question leads), richness (photo plus an interactive object) and
depth (three planes and a crossing card).

## Layering plan

- **Home:** photo (back), blue question card crossing the photo edge
  (front), paper ground and a facts rule (base).
- **Work:** the light intro has the client logos as an index directly below
  it. Each capability is paired with its example question.
- **Team:** a blue field holds the intro, and the board portraits cross out
  of it onto white. The Chicago community photo follows, with a join route.
- **Join:** the status and dates lead. A failed fetch is an inline notice
  inside the timeline, not the first panel.
- **Contact:** a short intro, with the form in the first screen beside the
  practical terms.

## Tokens

The existing tokens in `globals.css` apply unchanged. Public type steps are
13, 15, 17, 20, 24, 32 and 40–60px fluid. Metadata never goes below 13px.
Radii are 8px controls and 16px for photos and cards.

## Signature

The hero question card. The trigger is a press on an area chip. The question
and approach swap with a 180ms fade-up. Under reduced motion they swap with
no animation. The still frame is the Strategy question.

## Voice

Specific and plain, written as one person talking to a business owner.
