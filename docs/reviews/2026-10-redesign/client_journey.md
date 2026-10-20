# Prospective client journey — source audit

Reviewed 2026-10-16: homepage → client services → case study → contact.
Independent AI specialist review; no real-user study or conversion measurements.
Read-only source inspection; only this review was written. Concurrent implementation may move lines.
Authority: `docs/DESIGN.md:14–15` (proof before people; client action “Discuss a project”).

## Top 3 confirmed friction points

### 1. Homepage provides no in-content route to client work (P1)
- Evidence: `src/app/(marketing)/home/page.tsx:52–54` offers contact and recruitment; `:75–130` then presents welcome, president, history, pillars and community photos, with only a team link (`:103`). No `/work` link, client list or featured engagement appears in the homepage body.
- This contradicts the proof-first sequence in `docs/DESIGN.md:14` and the “presidents' letter on the homepage” prohibition in its Anti-patterns section.
- Journey consequence: a prospect wanting evidence before contacting MECG must discover “Client Services” in shared navigation (`src/components/site-header.tsx:9–13`) or the footer (`src/components/site-footer.tsx:4–8`). The route exists; it is not a broken link.
- Exact fix: immediately after the homepage stats, render an approved featured engagement using `getFeaturedPublicProject` (`src/lib/projects/public-projects.ts:81–82`) and link it to `/work/{slug}`; include “View client work” linking to `/work`. Move the president/history content after that proof or onto `/team`. Retain the existing client/student hero actions.
- Acceptance: a visitor scrolling from the hero reaches actual work and a `/work` link before leadership/culture content; do not invent results or substitute culture photos for project artifacts.

### 2. Case-study completion directs clients into recruitment (P1)
- Evidence: selected work links into detail pages through `src/app/(marketing)/work/page.tsx:62–68` and `src/components/project-card.tsx:6–15`.
- The detail page ends with “Back to client work” and the primary “Explore recruitment” → `/join`, with no local contact CTA (`src/app/(marketing)/work/[slug]/page.tsx:126–129`).
- Journey consequence: after reading deliverables, the client-facing page promotes the student journey; contacting MECG requires returning to work or using shared navigation.
- Exact fix: replace the detail-page primary link at `:128` with “Discuss a similar project” → `/contact?project={encodedSlug}#message`; keep the back link. Resolve that slug against public projects on contact and optionally prefill an editable subject with the project title, while keeping direct `/contact` visits generic.
- Acceptance: each published case ends with a direct client inquiry action; the form works with and without a project parameter and never overwrites entered text.

### 3. Contact drops project guidance and response expectations (P2)
- Evidence: work asks clients for “question, timing, and people who will use the work” (`src/app/(marketing)/work/page.tsx:95–98`), but contact supplies only a mixed-audience invitation (`src/app/(marketing)/contact/page.tsx:24–26`).
- The form has a required blank subject and message with no project prompt (`src/app/(marketing)/contact/contact-form.tsx:45–48`); success says only that the board will reply by email (`:30–32`).
- Existing client FAQs explain fit, client contribution, confidentiality and a one-week reply (`src/lib/site-content.ts:174–181`), but `CLIENT_FAQS` has no consuming reference under `src` in this snapshot.
- Journey consequence: clients must recall the earlier brief and cannot see the next step or expected reply interval at submission.
- Exact fix: add persistent message help: “Describe the decision, timing, and who will use the work. Mention confidentiality needs.” Add a short “What happens next” block beside the form and repeat the next step in success copy. Use the existing FAQ response interval only after the board confirms it remains operationally accurate; do not invent a faster promise.
- Acceptance: contact guidance is visible before typing, associated with the textarea via `aria-describedby`, and the confirmation explains the next step. Preserve entered data on errors.

## Hypotheses requiring validation
- Proof-first homepage content may increase qualified work-page visits; measure homepage → work transitions and inquiry completion before attributing lift.
- A project-aware subject may improve inquiry relevance; compare message completeness, without collecting unnecessary personal data.
- Stated reply expectations may reduce uncertainty; the repository's one-week copy is not evidence of actual board response performance.

## Existing strengths and limits
- Work already exposes pro-bono cost, semester length, 6–8-person teams and NDAs (`src/lib/site-content.ts:158–162`, rendered by `src/app/(marketing)/work/page.tsx:73–81`).
- Work has contact CTAs at both ends (`src/app/(marketing)/work/page.tsx:42,98`); contact provides a direct email fallback (`src/app/(marketing)/contact/page.tsx:31–32`).
- Form includes live status/error messages and preserves inputs on failed requests (`src/app/(marketing)/contact/contact-form.tsx:25–35,52`).
- No browser, email delivery, account writes or usability testing performed. Findings confirm source behavior/omissions; visitor confusion and business impact remain inferred.
