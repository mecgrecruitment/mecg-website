# Grading correctness and fairness audit

Date: 2026-10-16. Independent AI specialist review; not a user study.
Scope: read-only source audit against `docs/DESIGN.md`; only this report written.
Evidence describes checked-in code/migrations, not verified deployed database state.

## Top 3 concrete risks

### 1. High — Blind screening exposes the original resume
Confirmed defect in identity isolation:
- `src/app/member/screening/[assignmentId]/page.tsx:23` tells reviewers not to identify applicants, but lines 48–60 embed/link their resume.
- `supabase/migrations/20260911145642_screening_resume.sql:34–45` authorizes the application's attached `resume_storage_path`, not a separately redacted document.
- `src/app/api/member/screening/[assignmentId]/resume/route.ts:24–32` proxies the original bytes unchanged. Renaming the download `resume.pdf` does not remove identity inside it.
Impact: a resume containing name/contact information defeats packet anonymity before scoring; “context only” does not prevent that exposure.
Hypothesis: actual identity disclosure depends on uploaded PDF contents; no applicant documents inspected.
Concrete next check: use a synthetic named resume and confirm what the assigned reviewer sees; align the document shown with the existing blind-review promise.

### 2. High — Group Case partial observations become full-scale ranked grades
Confirmed inconsistency between scoring paths and completion labels:
- `supabase/migrations/20260914130000_group_case_inline_rating.sql:87–99,128–158` accepts partial scores (and note-only saves) and marks evaluation/assignment `SUBMITTED`.
- `supabase/migrations/20260914160000_group_case_results.sql:103–112` rescales any observed subset to /40; a note-only evaluation still enters `scored`.
- The same file at lines 125–127,176–181 counts those evaluations/applicants as graded; `src/app/admin/group-case-results.tsx:136–147` treats only count=0 as ungraded.
- By contrast, `src/lib/evaluation.js:18–24,42–43` requires 75% weighted coverage, required criteria, a criterion minimum, and two valid evaluations for a completed round.
- `supabase/migrations/20260914140000_group_case_keystone_rubric.sql:4–5` explicitly retains required Collaboration and a three-criterion minimum.
Example: a single Presentation=5 produces 40/40 in results despite no Collaboration observation; clearing all stars while retaining a note leaves “graded” with a null mean.
Impact: unequal observation coverage receives comparable scores and favorable bands; saved, observed, and complete are conflated.
Concrete next check: compare the same partial evaluation in Group Case results and decision readiness; expose coverage separately using existing scoring requirements.

### 3. Medium — Speed Dating write eligibility differs from its roster
Confirmed guard gap; end-to-end acceptance remains unverified:
- `supabase/migrations/20260913180000_speed_dating_roster_rating.sql:76–84` checks participation and cycle but does not exclude withdrawn/draft applicants.
- Its roster at lines 258–259 explicitly excludes both; Group Case's write path also excludes them (`20260914130000_group_case_inline_rating.sql:46–55`).
- `supabase/migrations/20260901030000_applicant_withdraw.sql:39` changes application status; a previously open grading screen can retain the applicant id.
Hypothesis: a stale Speed Dating submission after withdrawal can still save; no live RPC or trigger-chain execution performed.
Impact: UI eligibility and server eligibility can diverge during a live grading session.
Concrete next check: synthetic enrolled applicant → open roster → withdraw → submit old rating; verify rejection at the RPC boundary.

## Additional checks and limits

- Incomplete is not inherently zero: `src/lib/evaluation.js:24,43` preserves null, while a valid all-1 evaluation legitimately yields 0/100 (lines 26–33).
- Group Case results exclude null criteria from numerator/denominator (`20260914160000_group_case_results.sql:103`); the risk is comparability/completion, not zero imputation.
- Explicit conflict declarations block both inline rating RPCs (`20260913180000_speed_dating_roster_rating.sql:86–89`; `20260914130000_group_case_inline_rating.sql:57–60`). Both also reject active screening reviewers and require member/board/panel/owner roles (lines 72–74 and 42–44 respectively).
- Rubric guidance exists: `src/lib/rubrics.ts:45–102` provides dimension-specific anchors; `src/app/member/group-case/group-case-roster.tsx:381,389–391` exposes accessible labels and selected-score explanations.
- `src/lib/rubrics.ts:105–106` keys anchors by mutable display name; renamed criteria fall back to generic anchors. This is a maintenance hypothesis, not evidence of current misgrading.
- No runtime/browser tests, external research, account writes, code changes, or policy rewrites performed. Concurrent changes may supersede these source references.
