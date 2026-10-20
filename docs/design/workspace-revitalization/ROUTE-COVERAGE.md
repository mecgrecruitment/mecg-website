# Private production page coverage

Generated against the current source tree, 2026-10-17. Planning coverage only; this is not runtime route or permission verification. Feature IDs refer to features.json. A page can contain many controls; the role reports carry that finer feature inventory.

| Route | Inventory / disposition | Covered work | Entry source |
| --- | --- | --- | --- |
| `/admin/applications/[id]` | f30, f40 | Applicant file and decisions | `src/app/admin/applications/[id]/page.tsx` |
| `/admin/applications/[id]/release-evidence` | f41 | Release diagnostics | `src/app/admin/applications/[id]/release-evidence/page.tsx` |
| `/admin/audit` | f46 | Activity | `src/app/admin/audit/page.tsx` |
| `/admin/events/[id]` | f36 | Event setup, attendance, QR, observation toggle and slots | `src/app/admin/events/[id]/page.tsx` |
| `/admin/events/new` | f36 | Event scheduling | `src/app/admin/events/new/page.tsx` |
| `/admin/group-case` | Preserve redirect | Existing legacy Group Case round redirect | `src/app/admin/group-case/page.tsx` |
| `/admin/groups` | Preserve redirect | Existing legacy Group Case round redirect | `src/app/admin/groups/page.tsx` |
| `/admin/hash/deliberate` | f39 | Deliberation presentation | `src/app/admin/hash/deliberate/page.tsx` |
| `/admin/hash` | f39, f40, f41 | Stage votes, decisions and release | `src/app/admin/hash/page.tsx` |
| `/admin/login` | Preserve redirect | Existing login redirect | `src/app/admin/login/page.tsx` |
| `/admin/messages` | f42 | Compose/history/provider-send/delivery repair | `src/app/admin/messages/page.tsx` |
| `/admin/notifications` | Preserve redirect | Existing Communications delivery redirect | `src/app/admin/notifications/page.tsx` |
| `/admin/operations` | f47 | Owner readiness | `src/app/admin/operations/page.tsx` |
| `/admin` | f27, f28, f29, f47 | Recruitment overview, roster, scope and initial setup | `src/app/admin/page.tsx` |
| `/admin/people` | f26, f43 | Directory, onboarding and access | `src/app/admin/people/page.tsx` |
| `/admin/projects` | f45 | Projects/staffing/publication | `src/app/admin/projects/page.tsx` |
| `/admin/provisioning` | f43, f47 | Account incidents | `src/app/admin/provisioning/page.tsx` |
| `/admin/referrals` | f38 | Referral triage | `src/app/admin/referrals/page.tsx` |
| `/admin/rounds/[roundId]` | f33, f34, f35, f37 | Round lifecycle, rubric, staffing, results, placement and groups | `src/app/admin/rounds/[roundId]/page.tsx` |
| `/admin/rounds` | f33, f35, f36 | Round/event index | `src/app/admin/rounds/page.tsx` |
| `/admin/screening/calibrated` | f32 | Reader-adjusted ranking | `src/app/admin/screening/calibrated/page.tsx` |
| `/admin/screening` | f31 | Packets/readers/distribution/tracking/internal release | `src/app/admin/screening/page.tsx` |
| `/admin/settings` | f44, f52 | Dates, questions, lifecycle/cloning and aggregates | `src/app/admin/settings/page.tsx` |
| `/admin/speed-dating` | Preserve redirect | Existing legacy Speed Dating round redirect | `src/app/admin/speed-dating/page.tsx` |
| `/member/calibration/[roundId]` | f16 | Rubric calibration | `src/app/member/calibration/[roundId]/page.tsx` |
| `/member/event` | f22 | Qualitative impressions | `src/app/member/event/page.tsx` |
| `/member/group-case` | f21 | Inline Group Case evidence | `src/app/member/group-case/page.tsx` |
| `/member/hash` | f23 | Private ballot | `src/app/member/hash/page.tsx` |
| `/member` | f13, f17, f18, f19, f25 | Personal work, generic evaluation, receipts, profile/availability/conflicts | `src/app/member/page.tsx` |
| `/member/refer` | f24 | Referral | `src/app/member/refer/page.tsx` |
| `/member/screening/[assignmentId]` | f15, f18, f19 | Reading/scoring/recusal | `src/app/member/screening/[assignmentId]/page.tsx` |
| `/member/screening` | f14 | Blind reading queue | `src/app/member/screening/page.tsx` |
| `/member/speed-dating` | f20 | Live ratings/notes | `src/app/member/speed-dating/page.tsx` |
| `/applicant/[token]` | Preserve redirect | Existing authenticated applicant redirect | `src/app/applicant/[token]/page.tsx` |
| `/applicant` | f4–f12, f50, f51 | Owned application, scheduling, status/outcomes, materials, onboarding/messages | `src/app/applicant/page.tsx` |
| `/apply` | f1–f6, f48, f49 | Intake, auth entry, writing, validation, materials, recovery/submit | `src/app/apply/page.tsx` |

Related existing entry/arrival surfaces: `/login` and its Clerk route → f1; `/checkin/[token]` → f9/f36 (applicant, member and walk-up returns). Preserve their existing route/auth checks.

Excluded: all `/apply/test-harness/**` pages are synthetic verification tools, not product features. API routes, server actions, RLS/storage and domain modules are dependencies of these experiences, not additional navigation destinations. Their presence is not proof of deployed behavior.

Shared C1–C5 dependencies are defined in [DEPENDENCIES.md](DEPENDENCIES.md). No private production page was left without an existing feature mapping or a preserved-redirect disposition.
