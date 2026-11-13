# Private member project tools

Implementation: November 12, 2026. [Release validation and rollout](validation/release-2026-11-12.md). Routes: `/member/tools/pipeline`, `/member/tools/evidence`, `/member/tools/lab`. Uses existing workspace identity, cycle selection, navigation, design tokens and Clerk-backed Supabase client. No recruitment capabilities or release logic are changed.

## What works

- Pipeline: private owned client/sponsor opportunities, stage evidence, introduction route, last conversation and dated next action; search and type filtering; edit and durable save.
- Evidence: project narrative, original deliverable, result/measurement/limits, feedback and permission links; independent verification and separate sharing clearance.
- AI lab: six fictional source documents, visible practice questions, baseline/build/evaluate guide and proposed rubric; saved reproducible-demo submissions with evaluation report, comparison, effort/cost, limits and recommendation; independent review.
- All three: persistence through RPCs, explicit per-tool/cycle reviewer access, server authorization and database enforcement, optimistic revisions and retry-safe creation. A content edit invalidates previous clearance. Source links do not transfer file permissions. No automatic messages, publication, sponsor claims or client records are seeded.

## Source of truth and audience

These new records are the source of truth for entries created here. Existing spreadsheets, Drive originals and AI-plan tasks remain unchanged. Do not copy live opportunities into two editable trackers: an operating owner should select a cutover/import separately. No bulk import/sync is implemented.

Active internal members can create/read/edit their own records within their selected recruitment cycle. Explicit reviewers can read and edit all records for one tool in that cycle. Pipeline reviewers are relationship coordinators; evidence/lab reviewers can additionally record independent verification and permission scope. A reviewer cannot approve their own submission. A Board, Panel or Recruitment Committee role alone grants no broader record access.

A cycle Owner can grant/revoke reviewer access using the Owner controls at the bottom of each page. No grants are seeded. Owners do not implicitly read other members' records; granting is explicit and audited. Obtain the intended operating owner's acceptance before assigning access. Profile UUIDs are internal IDs, not Clerk subjects. Revocation or inactive membership/profile blocks broader access on subsequent reads/writes. These are initial implementation boundaries, not a new club membership policy.

Records remain private even when a reviewer records a cleared use; public publishing and an all-member approved gallery are deliberately separate future release flows. “Cleared for specified use” requires Verified, review notes, an HTTPS permission source and exact allowed scope. Reviewers must check actual permission authority. The application cannot validate the legal meaning of a linked document. All writes are audited without copying confidential content into audit metadata.

## Rollout

1. Apply `20261112120000_member_operations_tools.sql` to a designated staging database through the normal migration process. The production migration was applied on November 12, 2026 after the release validation gates passed.
2. Run the real authenticated acceptance below. Confirm canonical records, audiences, participating officers and record retention before collecting actual sensitive material.
3. Have an actual cycle Owner grant tool reviewers after those people accept responsibility; test revocation. No automatic recruitment-role conversion.
4. Coordinate production migration before app deployment. Until the RPC exists or when a read fails, the page displays an unavailable state and exposes no records. The synthetic lab guide can still be read by an authorized workspace member.
5. Preserve records for rollback: stop new writes or roll back the application; do not drop tables to undo a UI release. Cross-cycle record handoff, export, delete/retention, individual project-team grants and import reconciliation are follow-up scope before wider operational adoption.

## Verification

`node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/member-tools/model.test.ts src/lib/workspace-navigation.test.ts`

`node scripts/verify-member-tools.mjs` uses a disposable network-isolated PostgreSQL 17 container with minimal fixture identity/membership dependencies. It proves migration syntax and actual record/review/access RPC behavior, persistence/retries, stale revision protection, cross-member/cycle isolation, per-tool grant isolation, revocation, offboarding and direct table denial. It does not replay the full migration history or prove hosted Clerk/PostgREST integration. The fixture helpers are confined to that disposable container.

Required repository checks remain npm test, tsc, lint, SQL parse and build. Run heavy checks through the shared workload budget. Record actual results in the implementation receipt.

Authenticated staging acceptance: member A creates one entry in each tool, reloads and edits; member B and a Board account cannot see them; a cycle Owner grants B evidence review access; B sees only evidence submissions, records a permission-scoped review and cannot self-approve; A edits and clearance resets; stale concurrent edits conflict; revoke B and verify read/write denial; deactivate A and verify denial; switch cycles and verify isolation. Verify linked Drive permissions separately. Production data, invitation sends and publication are not needed for this test.

## UI review contract

Member task: add a record and return to its saved details. Primary action is a labeled form; results live directly below with status, source link and editable details. Reviewer task is distinct from submitting. Empty, search-empty, validation, service-unavailable, pending, save-confirmation and unconfirmed-write states have explicit copy. Forms retain values on recoverable errors. Existing white surfaces, navy headings, blue rail, orange action and responsive two-column fields are reused. No new brand tokens or charts introduced.
