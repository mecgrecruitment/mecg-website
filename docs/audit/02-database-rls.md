# Section 2 Audit — PostgreSQL / Supabase Data Layer

Scope: `supabase/migrations/*.sql` (69 files, `20260712184416_...` through
`20260831230000_fall_2026_recruitment_schedule.sql`), `supabase/tests/rush_foundation.sql`,
`supabase/config.toml`, `src/lib/supabase/database.types.ts`, and
`scripts/verify-backend.mjs` / `verify-supabase-project.mjs` / `verify-full-workflow.mjs`.
Read-only; no migrations run, no remote database touched.

## Verdict

The live schema is `rush` (final state reconstructed from all 69 migrations in order); the
original `public` schema from the Phase-0 migrations (`20260712184416_...` through
`20260712185001_...`) was fully retired and dropped in
`20260824230000_drop_dead_public_schema.sql`, and `supabase/config.toml` exposes only
`graphql_public` and `rush` over PostgREST, so it is out of scope for findings. Within `rush`,
every table has `ENABLE` + `FORCE ROW LEVEL SECURITY`, every mutation path runs through a
`SECURITY DEFINER` RPC (no `INSERT`/`UPDATE`/`DELETE` grants to `authenticated` anywhere — table
grants are `SELECT`-only), and all 88 `SECURITY DEFINER` functions in the final schema have a
locked `search_path = ''` with zero exceptions. Every mutating or data-returning RPC re-checks the
caller's role/ownership internally via `auth.uid()` and `rush.has_cycle_role`/`has_cycle_capability`
rather than trusting arguments — the "SECURITY DEFINER RPC that skips its own authorization check"
failure class does not appear anywhere in the final schema. Blind screening is implemented
correctly end to end (candidate codes instead of names, reviewer-facing RPCs never join `pnms`,
admin-only overview redacts identity/evidence for non-board callers on frozen batches, reviewer
role is mutually exclusive with privileged roles). The migration history shows a live, disciplined
incident-response pattern (RLS-recursion fixes, ledger-drift fixes, self-test lockdowns) rather than
unresolved rot. Remaining issues are narrower: two tables (`rush.events`, `rush.case_groups`) lack an
index on their `cycle_id` foreign key despite being filtered by it in both RLS policies and app
queries; two resume/document read policies use a raw role check that is more permissive than the
`has_cycle_capability` model used everywhere else for `RECRUITMENT_COMMITTEE`; and one dead
`SECURITY DEFINER` function (`resume_upload_locked`) is still granted to `authenticated` after the
storage policies that used it were replaced.

## Table 1 — `rush` schema tables

RLS is `ENABLE`+`FORCE` on every table below (verified for each; no exceptions). "Policies" lists
the final `SELECT` policy set (there are no `INSERT`/`UPDATE`/`DELETE` policies on any table —
all writes go through `SECURITY DEFINER` functions, `grant all` is `service_role`-only). Migration
citations point to the file that defines the *current* policy, not superseded ones.

| Table | Read (policy) | Write | Notes |
|---|---|---|---|
| `profiles` | self, or cycle colleagues via `actor_can_read_colleague_profile` (`20260824210000`) | RPC only (`handle_new_auth_user` trigger, `set_membership_role`) | |
| `rush_cycles` | `has_cycle_capability(CANDIDATE_ACCESS)`, own application in cycle, or `has_cycle_role(MEMBER/BOARD/PANEL/OWNER)` (`20260831197000`) | RPC only (`create_cycle`, `set_cycle_status`) | |
| `memberships` | own row, `has_cycle_role(BOARD/OWNER)`, or `has_cycle_capability(APPLICANT_OPERATIONS)` (`20260830090000`) | RPC only (`grant_membership`, `set_membership_role`) | |
| `pnms` | owner, or internal via `has_cycle_role`/`has_cycle_capability(CANDIDATE_ACCESS)` excluding active screening reviewers (`20260830090000`) | RPC only | |
| `applications` | owner (`applications_read_self`, `20260830100000`), or internal (board/panel/owner, capability, or assigned evaluator, each excluding screening reviewers and conflicted actors) (`20260831196000`) | RPC only | |
| `application_questions` | cycle participant or public while cycle `OPEN` (`20260822130000`) | RPC only | |
| `application_responses` | owner or board/owner, excluding conflicted board (`20260831000000`) | RPC only | |
| `application_documents` | owner, or internal staff (`BOARD/PANEL/OWNER/RECRUITMENT_COMMITTEE`) when `status='ATTACHED'` and no conflict (`20260831120000`) | RPC only | see Finding MEDIUM-1 |
| `application_portal_allowlist` | **RLS on, no policy** | `service_role` only | deliberate deny-all; gate reads via `SECURITY DEFINER` `application_portal_allows` |
| `rounds` | `has_cycle_capability(CANDIDATE_ACCESS)` or own application in cycle (`20260831030000`) | RPC only | |
| `rubrics` / `rubric_criteria` | cycle participant via round (`20260831030000`) | RPC only | |
| `evaluation_assignments` | own, `has_cycle_role(BOARD/PANEL/OWNER)`, or `has_cycle_capability(APPLICANT_OPERATIONS)` (`20260830090000`) | RPC only | |
| `evaluations` | own, or locked + panel/owner + no conflict (`20260831000000`) | RPC only | |
| `criterion_ratings` | evaluation is `LOCKED`, no conflict, and evaluator-self or panel/owner (`20260830090000`) | RPC only | |
| `conflict_declarations` | own, or cycle manager via `actor_manages_application_cycle` (`20260831196000`) | RPC only | |
| `decisions` | released + owner, or panel/owner with no conflict (`20260831000000`) | RPC only | |
| `decision_approvals` | panel/owner of parent decision's cycle | RPC only | |
| `events` | `has_cycle_capability(EVENTS)`/own application in cycle, plus staff (`BOARD/PANEL/OWNER/RECRUITMENT_COMMITTEE`) (`20260831203038`) | RPC only | see Finding LOW-2 (no `cycle_id` index) |
| `checkins` | applicant owner, board/owner, plus cycle staff (`20260831203038`) | RPC only | |
| `member_checkins` | self or cycle staff via `has_cycle_role` (`20260831202112`) | RPC only | |
| `event_impressions` | self or cycle staff via `has_cycle_role` (`20260831202112`) | RPC only | blind from other MEMBERs by design |
| `claim_tokens` | table dropped (`20260831180000`, S26) | — | was RLS-on/no-policy/dead; removed |
| `mutation_receipts` | own (`actor_id = auth.uid()`) | RPC only | |
| `audit_events` | `has_cycle_role(BOARD/OWNER)`, or `has_cycle_capability(AUDIT_READ)` scoped to an allow-listed resource type (`20260830090000`) | RPC only (append-only trigger blocks UPDATE/DELETE) | |
| `interest_signups` | `has_cycle_role(BOARD/OWNER)` | RPC only (`submit_interest`, anon-callable) | |
| `event_slots` | cycle participant/staff via event (`20260831000000`) | RPC only | |
| `slot_rsvps` | own application, or staff via slot's event (`20260822140000`) | RPC only | |
| `case_groups` | cycle participant/staff (`20260831000000`) | RPC only | see Finding LOW-2 (no `cycle_id` index) |
| `case_group_members` | own application, or staff (`20260822140000`) | RPC only | |
| `buddy_slots` | own, staff, or applicant in cycle (`20260831000000`) | RPC only | |
| `buddy_bookings` | own application, or slot owner/staff | RPC only | |
| `process_surveys` | `has_cycle_role(BOARD/OWNER)` | RPC only | |
| `rate_limits` | **RLS on, no policy** | `service_role` only (via `check_rate_limit`) | deliberate deny-all, comment confirms intent |
| `screening_batches`, `screening_reviewers`, `screening_packets`, `screening_assignments`, `screening_reviews`, `screening_ratings`, `screening_distribution_runs` | **RLS on, no policy on any of the 7** | `service_role` only | deliberate deny-all; all reviewer/admin access goes through `SECURITY DEFINER` functions (`my_screening_queue`, `screening_assignment_detail`, `screening_admin_overview`, etc.) that individually re-check role/ownership |

No table in `rush` has RLS **off**. No table with RLS-on-and-no-policy is reachable directly by
`anon`/`authenticated` — each is either `service_role`-only or fronted by `SECURITY DEFINER` RPCs
that perform their own checks, confirmed by `scripts/verify-backend.mjs` (`rush_cycles` read via
anon key must return 401/403).

## Table 2 — `SECURITY DEFINER` functions (final state, 88 total)

Every function below has `set search_path = ''` (verified programmatically across all 69 files —
zero `SECURITY DEFINER` functions without it). "Self-authorizes" marks whether the function
independently checks the caller's identity/role/ownership against the resource it touches, rather
than trusting its arguments.

| Function | Self-authorizes | Exposed to |
|---|---|---|
| `has_cycle_role`, `has_cycle_capability`, `owns_application`, `is_applicant`, `is_active_screening_reviewer`, `board_can_view_resume`, `actor_has_application_conflict`, `actor_has_application_in_cycle`, `actor_is_assigned_evaluator`, `actor_manages_application_cycle`, `actor_can_read_colleague_profile`, `application_cycle_id`, `round_cycle_id`, `event_cycle_id` | predicate — the function *is* the check, used inside RLS policies and other functions | `authenticated` (+`service_role` on most) |
| `is_eligible_screening_reviewer` | predicate | `service_role` only |
| `resume_upload_locked` | predicate | `authenticated` — **dead** (Finding LOW-1) |
| `handle_new_auth_user`, `enforce_application_portal`, `require_ready_resume` | trigger-only | no direct grants (revoked from `public,anon,authenticated` in `20260831198000`) |
| `create_cycle`, `grant_membership`, `set_membership_role`, `add_applicant`, `assign_evaluator`, `set_round_status`, `set_cycle_status`, `create_event`, `rotate_event_token`, `create_event_slot`, `create_decision`, `approve_decision`, `release_decision`, `set_decision_preview`, `export_attendance`, `set_application_status`, `create_case_group`, `assign_case_group`, `unassign_case_group`, `delete_case_group`, `create_buddy_slot`, `create_screening_batch`, `approve_screening_packet`, `update_screening_packet_content`, `screening_assignment_inputs`, `commit_screening_assignments`, `freeze_screening_batch`, `screening_admin_overview`, `set_event_grading` | Y — each checks `has_cycle_role`/`has_cycle_capability` for the target cycle before acting | `authenticated`, `service_role` |
| `submit_application`, `save_application_draft`, `declare_conflict`, `submit_evaluation`, `member_applicants`, `event_for_token` (public), `check_in`, `respond_to_offer`, `applicant_dashboard`, `applicant_schedule`, `rsvp_slot`, `book_buddy_slot`, `submit_process_survey`, `set_applicant_profile`, `intake_schema`, `begin_resume_upload`, `pending_resume_upload`, `reject_resume_upload`, `my_ready_resume`, `authorize_resume_access`, `my_screening_queue`, `screening_assignment_detail`, `submit_screening_review`, `recuse_screening_assignment`, `my_grading_events`, `event_grading_roster`, `submit_event_impression`, `seed_cycle_questions` | Y — scoped to `auth.uid()` ownership or an explicit cycle/role check | `authenticated`, `service_role` |
| `public_recruitment`, `submit_interest` | N/A — intentionally public, no PII returned | `anon`, `authenticated`, `service_role` |
| `verify_full_workflow`, `submit_application_self_test`, `finalize_resume_upload`, `application_portal_allows`, `check_rate_limit`, `prune_pending_resume_uploads` (removed `20260831191000`, replaced below), `prune_rate_limits`, `stale_pending_resume_uploads`, `retire_pending_resume_upload` | Y — explicit `auth.role() <> 'service_role'` guard *and* grants restricted to `service_role` (defense in depth) | `service_role` only |

## Findings

### [LOW] `rush.resume_upload_locked` is dead SECURITY DEFINER code still granted to `authenticated`

- File: `supabase/migrations/20260830100000_harden_applicant_workflow.sql` (definition + grant),
  superseded by `supabase/migrations/20260831120000_resume_document_lifecycle.sql`
- Object: `rush.resume_upload_locked(text)`
- The only three storage policies that called this predicate
  (`storage_resumes_applicant_insert/update/select`) were dropped and replaced in
  `20260831120000_resume_document_lifecycle.sql` with document-table-backed policies that don't
  reference it. The function itself is harmless (it only reports on the caller's own application),
  but it's an orphaned RPC left reachable at `/rest/v1/rpc/resume_upload_locked` with no live caller.
- Fix:
  ```sql
  drop function if exists rush.resume_upload_locked(text);
  ```

### [LOW] `rush.events` and `rush.case_groups` have no index on `cycle_id`

- File: `supabase/migrations/20260821090000_rush_foundation.sql` (`rush.events`),
  `supabase/migrations/20260822140000_recruitment_ops.sql` (`rush.case_groups`)
- Object: `rush.events.cycle_id`, `rush.case_groups.cycle_id` (both FK to `rush.rush_cycles`)
- Both columns are filtered directly by RLS policies (`events_read_participant`,
  `events_read_cycle_staff`, `groups_read`) and by app queries
  (`src/app/admin/page.tsx: .from("events").eq("cycle_id", cycleId)`,
  `src/app/admin/groups/page.tsx`, `hash` pages joining `event_impressions -> events!inner(cycle_id)`).
  Every other FK used the same way (`applications.cycle_id`, `decisions.cycle_id`,
  `memberships.cycle_id`) has an explicit or unique-constraint-backed index; these two do not. Low
  severity today because both tables are small per cycle, but it's a sequential-scan-on-write-path
  risk once several cycles/years of events and groups accumulate.
- Fix:
  ```sql
  create index events_cycle_id_idx on rush.events (cycle_id);
  create index case_groups_cycle_id_idx on rush.case_groups (cycle_id);
  ```

### [MEDIUM] Resume/document internal-read policies bypass the `has_cycle_capability` gate used everywhere else for `RECRUITMENT_COMMITTEE`

- File: `supabase/migrations/20260831120000_resume_document_lifecycle.sql`
- Object: policies `application_documents_internal_read` (line ~69) and
  `storage_resumes_internal_select` (line ~481) on `rush.application_documents` /
  `storage.objects`
- Both policies grant read access to any active membership with
  `role::text in ('BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE')`, a raw role check. Everywhere
  else in the schema, `RECRUITMENT_COMMITTEE` access to candidate-identifying data is gated through
  `rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')`, which additionally requires the cycle
  status to not be `CLOSED`/`ARCHIVED` (see `20260830090000_recruitment_committee_role.sql`). These
  two policies skip that capability/status check, so a `RECRUITMENT_COMMITTEE` member retains resume
  read access after their cycle capability would otherwise have expired (e.g., a closed/archived
  cycle). Not exploitable cross-cycle or by an unprivileged role, but it's an authorization-model
  inconsistency on applicant PII (resumes) specifically.
- Fix:
  ```sql
  drop policy if exists application_documents_internal_read on rush.application_documents;
  create policy application_documents_internal_read on rush.application_documents
  for select to authenticated
  using (
    status = 'ATTACHED'
    and (
      rush.has_cycle_role(cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[])
      or rush.has_cycle_capability(cycle_id, 'CANDIDATE_ACCESS')
    )
    and not exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = application_documents.application_id and c.declarer_id = auth.uid()
    )
  );
  -- same substitution for storage_resumes_internal_select's role check
  ```

### [LOW] `rush.application_documents.application_id` has no dedicated index

- File: `supabase/migrations/20260831120000_resume_document_lifecycle.sql`
- Object: `rush.application_documents.application_id` (FK to `rush.applications`, nullable)
- The table has indexes on `(owner_user_id, cycle_id, created_at desc)` and two partial unique
  indexes on `(owner_user_id, cycle_id, kind)`, but nothing on `application_id` itself, which is the
  join key `require_ready_resume()` and `authorize_resume_access()` use indirectly via
  `object_path`/`owner_user_id`. Low volume today (one row per resume version), flagged for
  completeness since it's a stated FK.
- Fix:
  ```sql
  create index application_documents_application_id_idx on rush.application_documents (application_id);
  ```

## Summary (CRITICAL / HIGH only)

None. No CRITICAL or HIGH findings. Every `rush`-schema table has RLS `ENABLE`+`FORCE`; the handful
with no policy (`application_portal_allowlist`, `rate_limits`, all seven `screening_*` tables,
formerly `claim_tokens`) are deliberate deny-all-by-default tables accessed only through
`service_role` or self-checking `SECURITY DEFINER` RPCs, not silent gaps. All 88 `SECURITY DEFINER`
functions lock `search_path`, and every mutating/data-returning one re-verifies the caller's role or
ownership rather than trusting arguments — including the one function that looked like a bypass
candidate, the two-argument `rush.submit_application_self_test`, which was progressively locked down
across three migrations (`20260824180000`, `20260831182000`, and later revisions) to `service_role`
only with an additional identity-pattern check. Blind screening correctly withholds applicant
identity and evaluator identity from reviewers throughout. Remaining findings are MEDIUM/LOW:
one dead SECURITY DEFINER RPC still granted to `authenticated`, two missing FK indexes on
`cycle_id` (`rush.events`, `rush.case_groups`) and one on `application_documents.application_id`,
and one authorization-model inconsistency where two resume-read policies use a raw role check
instead of the capability-gated model used elsewhere for `RECRUITMENT_COMMITTEE`.
