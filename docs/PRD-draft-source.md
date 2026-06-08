# MECG Digital Platform — Product Requirements Document (SOURCE DRAFT)

| | |
|---|---|
| **Product** | MECG Website System (External Site + Internal Recruitment ATS) |
| **Version** | v0.1 — Draft |
| **Owner** | Rahil Bhavan, MECG |
| **Date** | June 8, 2026 |
| **Status** | Draft for board / recruitment committee review |
| **Supersedes** | mecgmichigan.com (current Webflow-era site) |

## LOCKED DECISIONS (from owner, supersede the open questions below)
- Deliverable of this effort: a finalized PRD document only.
- General members: CAN view the open-rush candidate list (names/basic info only), but NEVER scores, notes, reactions, or hash.
- Hash vote visibility: ANONYMOUS by default; board may flip a session to open per-session.
- Application intake: NATIVE form writing to `candidates` + resume to Supabase Storage (Option A confirmed).

---

## 1. Summary

MECG will ship a single web application split into two hard-separated zones that share one brand, one codebase, and one deploy:

1. **External site** — a public, art-directed marketing and recruiting surface. Full design treatment, inspired by the editorial/brutalist execution of Obys Agency's *AI Modernism of Kharkiv* (aim.obys.agency): type-as-hero, near-monochrome, an indexed/annotated catalog system, and tasteful motion. Its job is to recruit applicants, impress clients, and showcase placements.

2. **Internal site** — a gated applicant tracking system (ATS) for the recruitment funnel, accessible only to the board and recruitment committee (plus a thin member-profile surface for general members). It replaces the scattered Google Docs used today for speed dating, group case, and interview scoring, and adds candidate profiles, notes, reactions, live hash voting, and bias-mitigation tooling. It inherits the brand's type system and palette but is optimized for density and speed, not art direction.

The guiding split: **the external site is a showcase; the internal site is a tool.** Motion and art direction go to the showcase; clarity and scanning speed go to the tool.

---

## 2. Background & problem

The current site (mecgmichigan.com) has a strong recruitment timeline page but several problems:

- The homepage impact counters render live as **"0 Members / 0 Projects Completed / 0 Different Majors"**, which reads as broken to applicants and clients.
- The President's welcome copy is generic and reads as templated; no named clients, no specific outcomes.
- The visual identity (dual rotating gears, literal "engineering = gears") is dated and undifferentiated.
- There is **no internal tooling**. Recruitment scoring for speed dating, group case, and final interviews lives in disconnected Google Docs. There is no candidate-level aggregation, no structured notes, no voting, no audit trail, and no access control beyond Google sharing settings.

This PRD addresses both: a redesigned public site and a purpose-built internal recruitment platform.

---

## 3. Goals & non-goals

### 3.1 Goals
- **G1.** Replace the public site with a distinctive, type-forward, art-directed experience that signals precision and competence to clients and applicants.
- **G2.** Build a recruiting weapon: a placement/internship page that visibly shows where members work.
- **G3.** Replace Google Docs recruitment scoring with a structured ATS: candidate profiles, stage scoring, notes, reactions, voting, and hash deliberation.
- **G4.** Enforce strict role-based access control so candidate evaluation data is never exposed to candidates or unauthorized members.
- **G5.** Reduce bias and improve fairness in evaluation (blind-until-submitted scoring, score normalization, conflict-of-interest handling).
- **G6.** Keep the system maintainable by a rotating, volunteer student board.

### 3.2 Non-goals (v1)
- No public-facing client portal or project-management tooling for active engagements.
- No WebGL / shader-based image distortion effects (deliberately cut for maintainability).
- No native mobile apps; responsive web only.
- No payments, dues collection, or financial tooling.
- No automated parsing/scoring of applications via AI (human evaluation only in v1).

---

## 4. Success metrics

| Metric | Target |
|---|---|
| Recruitment data consolidated | 100% of speed dating / group case / interview scoring captured in the ATS (zero Google Docs scoring by Fall 2026 cycle) |
| Evaluator adoption | ≥90% of committee evaluators submit scores in-app per stage |
| Score completeness | ≥95% of advanced candidates have scores from the minimum required number of distinct evaluators per stage |
| Hash efficiency | Deliberation time per candidate reduced vs. prior cycle (qualitative + timed) |
| Public site performance | Lighthouse Performance ≥85 mobile, ≥95 desktop; LCP < 2.5s |
| Accessibility | WCAG 2.1 AA on all public pages; keyboard-navigable internal tool |
| Content currency | Homepage stats and placement page reflect real, current data (no placeholder zeros) |

---

## 5. Users & personas

| Persona | Zone | Needs |
|---|---|---|
| **Prospective applicant** | External | Understand what MECG is, see where members work, view recruitment timeline, apply |
| **Client / company** | External | Quickly assess credibility, services, and team quality |
| **Alumni** | External | See current placements, stay connected |
| **Applicant (candidate)** | Application intake only | Submit application; **no access to any evaluation data** |
| **General member** | Internal (thin) | Create/edit own member profile; view open-rush candidate list (no scores) |
| **Recruitment committee** | Internal | Score candidates per stage, leave notes, react, vote in hash — but not configure rubrics or roles |
| **Board** | Internal (full) | Everything above + configure rubrics/stages, manage roles, run hash sessions, view audit log, finalize decisions |

---

## 6. Scope decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| **Art-direction scope** | External: full. Internal: type system only. | The ATS needs density and scanning speed; full motion would slow the committee down. |
| **Motion & build ambition** | "Tasteful 80%" — Lenis smooth scroll, GSAP reveals, custom cursor, type preloader. **No WebGL.** | Captures the editorial wow while staying editable by future boards. |
| **Color** | Monochrome + single Michigan **maize** accent. | Black/cream does the work; maize keeps brand equity without going corporate blue+maize. |
| **Design intent** | Borrow AIM's *craft* (type, monochrome, annotation system, motion), not its Kharkiv/constructivist theme. | Execution qualities transfer; the art-historical content does not. |
| **Codebase** | One Next.js app, two route zones (`/` public, `/internal/*` gated). | Shared brand/deploy, hard auth boundary. |
| **Hosting** | Vercel. | Already connected; native Next.js host. |
| **Backend** | Supabase (Postgres + Auth + RLS + Storage). | Already connected; RLS is the access-control backbone. |

---

## 7. Design system & art direction

### 7.1 Reference
Obys Agency, *AI Modernism of Kharkiv* (aim.obys.agency). Qualities to reproduce: typography as the primary visual element; near-monochrome gallery aesthetic; an indexed/annotated "technical catalog" system (`[01]`, `[*]`, `©`, `[Menu]`, `E01–E05`); rich but restrained motion.

### 7.2 Typography
| Role | Typeface | Usage |
|---|---|---|
| Display / hero | **Archivo Expanded** (Black) or **Bricolage Grotesque** | Oversized, tight tracking, kinetic |
| Body | **Space Grotesk** or **Inter** | Paragraphs, UI text |
| Index / annotation | **Space Mono** | Bracketed labels, footnote markers, indices, ©, timestamps |

### 7.3 Color tokens
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0A0A0A` | Primary text, backgrounds (inverted sections) |
| `--paper` | `#F2EEE4` | Primary background (cream) |
| `--maize` | `#FFCB05` | Accent only: links, annotation markers, hover/active states |
| `--blue` (optional) | `#00274C` | Reserved deep secondary; sparing, internal headers only if needed |

### 7.4 Annotation / catalog system
- Numbered indices everywhere: pillars `[01]–[04]`, funnel stages `E01–E05`, gallery items `[01]…[n]`, candidates `C01…` (internal).
- Footnote markers `[*] [**] [***]` with a corresponding annotation block.
- Bracketed UI chrome: `[Menu]`, `[Close]`, `[Index]`, `[Gallery]`.
- Persistent meta line (e.g., `Michigan Engineering Consulting Group / Ann Arbor / ©2026`).

### 7.5 Motion inventory (the "80%")
| Effect | Library | Notes |
|---|---|---|
| Smooth scroll | Lenis | Site-wide on external; **disabled** on internal |
| Heading reveals | GSAP + ScrollTrigger | Mask/clip reveal on large type |
| Image reveals | GSAP / CSS clip-path | On scroll into view + subtle hover scale |
| Custom cursor | Custom (lightweight) | Hover states; respects pointer/touch detection |
| Preloader | Custom | Type-based MECG intro; runs once per session |
| **Excluded** | — | WebGL/shader image distortion (maintenance cost) |

### 7.6 Internal styling rules
Internal inherits fonts, palette, and the annotation system only. No smooth scroll, no preloader, no custom cursor, no reveal animations. Dense, table/card-based, optimized for fast scanning and keyboard use.

---

## 8. External site — requirements

### 8.1 Information architecture
```
/                     Home
/placement            Placement / "Where We Work"
/trek                 Chicago Trek (indexed gallery)
/team                 Our Team
/recruitment          Join / Recruitment (funnel E01–E05)
/services             Client Services
/about                About / Pillars
/contact              Contact
/apply                Application intake (routes into internal pipeline)
```

### 8.2 Home (`/`)
Hero kinetic type; pillars as annotated index; real impact stats (no zeros); placement teaser slider; footer meta line + socials.

### 8.3 Placement / "Where We Work" (`/placement`) — highest-value page
Company logo wall; internship highlights (quotes + role + company); data generated from member profiles with manual curation override.

### 8.4 Chicago Trek (`/trek`)
Indexed photo gallery; narrative; lightbox consistent with AIM gallery.

### 8.5 Team (`/team`)
Monochrome indexed portrait grid; sourced from `members` where `is_public = true`.

### 8.6 Recruitment / Join (`/recruitment`)
Preserve existing timeline, restyle into annotation system; funnel `E01→E0n`; calendar links; CTA to `/apply`; FAQ accordion.

### 8.7 Services / About / Contact
Services offerings + sanitized outcomes + client logos if permitted; About mission + pillars + history; Contact email/location/socials/optional form.

### 8.8 Non-functional (external)
Static/ISR; WCAG 2.1 AA; keyboard nav; reduced-motion; responsive 320px+; OG/Twitter cards.

---

## 9. Internal recruitment ATS — requirements

### 9.1 Mental model
Funnel: Application → Speed Dating → Group Case → Interview → Hash → Decision. Candidate profile is the single source of truth.

### 9.2 Roles & permissions
(See locked decisions: general members see open-rush candidate list, no scores.)

### 9.3 Stage-based scoring rubrics
Configurable weighted rubrics per stage; criteria scored 1–5 (configurable); composite = weighted sum; historical rubric versions preserved.

### 9.4 Blind-until-submitted (highest priority)
An evaluator cannot view others' scores/notes for a candidate in a stage until they submit their own; enforced in UI AND API.

### 9.5 Conviction reactions
4-point scale: Strong Yes · Yes · No · Strong No. Stored per evaluator per candidate.

### 9.6 Notes
Free-text, stage-tagged, attributed, timestamped, subject to blind rules.

### 9.7 Score normalization
Display z-scored composites alongside raw; normalized per evaluator within a stage.

### 9.8 Conflict-of-interest (COI)
Evaluator flags "I know this candidate"; flagged scores marked and excludable; visible to board.

### 9.9 Candidate profile
Aggregates application + scores (raw+normalized) + notes + reactions + COI + stage/status + controversy indicator.

### 9.10 Member profile
name, year, major, role, photo, bio, current company/internship; internship feeds /placement; is_public controls /team.

### 9.11 Hash mode (live deliberation)
Candidate queue sortable by composite / normalized / controversy (default: controversy first); per-candidate card; live voting Advance/Cut/Discuss more; vote visibility anonymous by default, configurable per session; quorum tracking; immutable decision log.

### 9.12 Audit trail
Every score, note, reaction, vote, decision timestamped + attributed; board-only; append-only.

### 9.13 Application intake (`/apply`)
NATIVE form → `candidates` + responses; resume to Storage; the only public write path.

---

## 10. Data model
Enums + tables: members, candidates, application_responses, rubric_criteria, scores, notes, reactions, hash_sessions, votes, decisions, audit_log. Derived: composite, normalized composite, controversy. See draft for full column lists.

---

## 11. Access control (Supabase RLS)
Default deny; @umich.edu email gating / invite allowlist; role checks via security-definer helper; public app write path is the only anon mutation.

---

## 12. Tech stack
Next.js App Router + TS; Vercel; Supabase (Postgres/Auth/RLS/Storage); Tailwind + tokens; Lenis/GSAP/custom cursor; fonts per 7.2.

---

## 13. Non-functional requirements
Performance (Lighthouse ≥85 mobile/≥95 desktop, LCP<2.5s, next/image); A11y WCAG 2.1 AA + keyboard internal + reduced-motion; security RLS default-deny + gated Storage + append-only audit; maintainability no WebGL + docs + seed scripts; reliability append-only votes/decisions.

---

## 14. Content requirements (dependency on MECG)
Photography; real placement data + logo permission; real impact stats; sharper copy; existing scoring Google Docs for real rubrics.

---

## 15. Phased delivery
Phase 0 Foundations; Phase 1 External site; Phase 2 Placement+Trek; Phase 3 Internal core; Phase 4 Hash+fairness; Phase 5 Polish. Target: internal ATS live before Fall 2026 cycle.

---

## 16. Risks & mitigations
Art-direction credibility; motion maintainability; weak content; data leakage; evaluator adoption; volunteer turnover; sync fragility.

---

## 17. Open questions (NOW RESOLVED — see LOCKED DECISIONS at top)
1. Rubric criteria & weights — pending club Google Docs (Appendix A placeholders).
2. General-member visibility — RESOLVED: see candidate list, no scores.
3. Hash vote visibility — RESOLVED: anonymous default, per-session configurable.
4. Brand constraints — OPEN: MECG/CoE logo requirements?
5. Client logos — OPEN: permission to display?
6. Application form — RESOLVED: native intake.

---

## Appendix A — Placeholder rubric defaults
Speed Dating: Communication · Energy/presence · Genuine interest (1–5).
Group Case: Structure/problem-solving · Contribution · Teamwork · Presence/communication (1–5 weighted).
Interview: Analytical/casing · Communication · Motivation/fit · Culture (1–5 weighted).

## Appendix B — Asset / font references
Display Archivo Expanded / Bricolage Grotesque; Body Space Grotesk / Inter; Mono Space Mono; tokens ink/paper/maize/blue; Lenis + GSAP.
