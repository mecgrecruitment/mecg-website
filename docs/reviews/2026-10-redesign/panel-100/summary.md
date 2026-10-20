# Frozen V1: 100-agent acceptance panel

All 100 distinct, independently instantiated AI reviewers completed their own report. **0 agree, 54 disagree, 46 unproven** on the world-class question. Release recommendations: **0 ship, 53 hold, 47 unproven**. There are zero failed or missing reports. This is an AI review exercise with simulated expert/user lenses, not a panel of real designers, Apple employees or observed users.

The exact reviewed snapshot is `9985d3fcce1f0f6d7188f4ef67404feb29bec6e7133b8f4d0ba5ea9601f8c931` at `/tmp/mecg-panel-20261016-v1`. Later code fixes and new tests do not change these verdicts or establish approval of a changed revision. Coordinator current-tree source QAs are separate non-voting artifacts.

| Lens | Agree | Disagree | Unproven |
|---|---:|---:|---:|
| Apple-inspired clarity | 0 | 2 | 8 |
| Editorial and brand craft | 0 | 7 | 3 |
| Accessible interaction | 0 | 7 | 3 |
| Information and discoverability | 0 | 3 | 7 |
| Product systems and reliability | 0 | 6 | 4 |
| Prospective client | 0 | 5 | 5 |
| Prospective applicant | 0 | 3 | 7 |
| Member evaluator | 0 | 10 | 0 |
| Recruitment operator | 0 | 8 | 2 |
| Owner and access-sensitive user | 0 | 3 | 7 |

## Actionable themes and original evidence

These group repeated concerns for navigation; the original 141 finding entries, exact evidence and suggested fixes remain in [aggregate.json](aggregate.json) and each linked report. Exact full-object deduplication found no identical entries; differently formulated objections were not discarded or counted as extra votes. Findings are reviewers' source-based assertions unless their report states an actual observation. Parent triage must verify each against the source and record dispositions separately.

- **Client proof and proposition:** approved consulting questions, artifacts and bounded results are absent; named organizations and culture photos do not establish the quality of MECG work. No client data or outcomes may be fabricated. See [011](reports/panel-011.json), [018](reports/panel-018.json), [051](reports/panel-051.json), [060](reports/panel-060.json), primarily `home/page.tsx:66–97`, `projects.public.ts:3–5` and `client-project-grid.tsx:93–113`. Hero fee/duration clarity and mobile process-before-proof ordering: [001](reports/panel-001.json), [012](reports/panel-012.json). Membership time expectation is an owner fact still needed: [035](reports/panel-035.json), [039](reports/panel-039.json), `join-content.ts:75,86`.
- **Contact safety and recovery:** in-flight edits can be erased; malformed success can reset without a receipt; indefinite or uncertain delivery lacks truthful recovery; limiter outages are misreported as quota. See [002](reports/panel-002.json), [005](reports/panel-005.json), [007](reports/panel-007.json), [057](reports/panel-057.json), principally `contact-form.tsx:19–35`, API route `34–52` and `rate-limit.ts:51–77`. Mobile organization details are remote from their selected control: [006](reports/panel-006.json), [019](reports/panel-019.json), `client-project-grid.tsx:34–71`.
- **Accessible private interaction:** deliberation deck keyboard shortcuts collide with controls and motion bypasses reduced-motion intent; contact error association and sign-out recovery need improvement; rubric disabled-save states lack field guidance. See [021](reports/panel-021.json), [022](reports/panel-022.json), [023](reports/panel-023.json), [024](reports/panel-024.json), [027](reports/panel-027.json), [030](reports/panel-030.json). The original reports identify exact source functions and lines.
- **Recruitment and application truthfulness:** unavailable recruitment data is treated as unpublished events, empty cycles can offer an unusable interest form, submission clears recovery without validating an application ID, and URL flags/privacy confirmation can imply unsupported success/anonymity. See [004](reports/panel-004.json), [031](reports/panel-031.json), [042](reports/panel-042.json), [049](reports/panel-049.json), [061](reports/panel-061.json). Offer-deadline lookup failures lose time-sensitive context: [064](reports/panel-064.json). Divergent whole-copy application recovery is burdensome: [066](reports/panel-066.json). Returning draft/needs-info applicants can be routed away from editing: [069](reports/panel-069.json), `auth-destination.ts:22–23`.
- **Evaluator evidence and continuity:** note-only Group Case observations cannot be saved, persisted ratings lack canonical validity feedback, unavailable storage receives false backup assurances, divergent saved copies can be overwritten, review focus is weak, and My Work can call partial editable evidence finished/locked. See [071](reports/panel-071.json) through [080](reports/panel-080.json), especially `evaluation-form.tsx`, `group-case-roster.tsx` and `member/page.tsx`.
- **Operator decisions and cohorts:** ambiguous close actions remain misleading/repeatable, coverage confuses submitted forms with valid evidence, overview uses incorrect cohort/staffing counts, review cancellation loses focus, blocked-release guidance may prescribe impossible reopening, large release cohorts lack useful filters, and stalled release requests lack bounds. See [043](reports/panel-043.json), [047](reports/panel-047.json), [081](reports/panel-081.json) through [090](reports/panel-090.json). Cohort selection can strand authorized draft/older-cycle settings and round deep links: [089](reports/panel-089.json), `cycles.ts:13–40` and `round-board.tsx:54–76`.
- **Owner provisioning:** unknown account/membership outcomes lack retained receipt/context and safe reconciliation; existing-account partial writes lack incident coverage; People tabs fail their expected keyboard/label model; recovery links lose cycle context. See [091](reports/panel-091.json) through [099](reports/panel-099.json), especially `rush-controls.tsx:64–85`, API `rush/route.ts:133–167`, `people-workspace.tsx:31–49`, and `provisioning/page.tsx:61`.

## Provenance and limits

[manifest.json](manifest.json) preserves all accepted spawn handles, seat assignments, backend, report paths and terminal statuses. Native seat 001 uses the canonical task handle returned by the native tool; that tool exposes no separate opaque ID. Native seat 002 was initially rejected with `agent thread limit reached`; the authorized fallback created 99 distinct T3-owned child tasks for seats 002–100. That rejected attempt is not a vote. No voter was reused to fill another seat, and the coordinator is not a voter.

Validation passed all 100 expected IDs/report paths, snapshot IDs, assigned lenses, verdict/recommendation enums, nonempty inspection lists/reasons/unknowns, maximum-three finding schemas, 100 unique actual spawn handles and completed terminal statuses. All individual reports are retained unchanged.

Reviewers used frozen local source, supplied logs/tests and captures; private captures are synthetic where disclosed. Source review is not observed human task success. No staging environment, hosted end-to-end acceptance or real-user study exists in this evidence. Agents share a provider/model and simulated lenses; this is not a statistically representative user sample. Build/test/lab success cannot turn an unproven or conditional verdict into agreement. Material changes require a new identified revision and independent review; this panel supplies no unanimous endorsement of V1 or later work.
