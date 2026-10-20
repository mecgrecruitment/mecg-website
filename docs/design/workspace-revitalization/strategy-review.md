# Strategy review: material corrections before synthesis

Planning review · October 17, 2026 · source inspection only.

The confirmed-handoff strategy is supported by the inspected source. Keep the existing route tree and specialist workspaces. The material weakness is that `features.json` compresses preservation, presentation changes and new contracts into similarly prioritized “Refine” rows. The eight corrections below address that compression; they do not authorize implementation or resolve Board policy.

Read: `AGENTS.md`, `docs/PRODUCT.md`, the top current rules of `docs/DESIGN.md`, shared design routing/design-system-workflow, `features.json`, applicant/member/navigation/visual-system/trust-and-recovery/product-critique/accessibility/live-events reports, and the source boundaries cited below. No Board report was present at review time; Board conclusions were checked against actual admin sources where relevant. No browser, tests, app changes, backend queries, external writes or subagents were used. Existing source is not evidence of deployment or successful usability.

Preserve bold blue/orange, task-first private Operate composition, system sans, 4px rhythm, 8px buttons, 12px panels and 44px targets. No visual identity correction is needed. Keep existing permissions, conflicts, scoring/required-evidence rules, quorum, immutable final submissions and explicit release. Saved, submitted, released and provider-accepted/delivered remain independent facts.

## 1. Make the resume/blind-review policy conflict an explicit dependency

**Priority:** P0 policy/content boundary; affects f15/f31/f32, not a reason to block unrelated styling.

**Observed:** `src/app/member/screening/[assignmentId]/page.tsx` embeds a context-only resume; `src/app/api/member/screening/[assignmentId]/resume/route.ts` authorizes and streams it. `docs/reviews/2026-10-redesign/release-open-items.md` explicitly records the conflict between original resume access and the older no-resume blind promise. `visual-system.md` correctly describes current access, but its proposed reader could be read as settling that policy. f15 only says to preserve blind packet fields.

**Correction:** State in the inventory that current original-PDF access is existing behavior, anonymity is not established, and the Board must resolve allowed resume content/access before stronger blind-review claims or a broader document viewer. Preserve current authorization pending that decision; neither remove the feature nor expand its audience as a design shortcut.

**Dependency / acceptance:** Approved content/access rule with an effective cycle. Proposed checks must inspect PDF bytes and accessible labels/downloads as well as structured packet fields; filenames, candidate codes and proxy URLs cannot establish anonymization. Named directory shortcuts and peers’ evidence remain excluded from independent reading.

## 2. Separate live evidence semantics from the missing Speed Dating write contract

**Priority:** P0; split the safety work out of f18/f20/f21 before their composition work.

**Observed:** `supabase/migrations/20261016191000_grading_contract_consistency.sql` updates Speed Dating evaluations stored as `SUBMITTED` while allowed. `src/app/member/page.tsx` documents the distinct editable Group Case evidence model. This conflicts with interpreting every stored `SUBMITTED` as an immutable final submission under `docs/policies/recruitment-policy.md`. Separately, `src/app/member/speed-dating/speed-dating-roster.tsx` has local sequencing, optimistic scores and debounce cleanup; it does not supply Group Case's revision/mutation protocol. `live-events.md` identifies new concurrency work, while f20 remains simply “Refine.”

**Correction:** Add two explicit dependencies: resolve the inline-evidence versus locked-submission contract without changing historical records by copy alone; classify Speed Dating revision/mutation receipts and reconciliation as **new contract work**. Preserve the existing immutable generic evaluation/screening flows. Do not market current client sequencing as cross-tab safety or durable recovery. New note-only persistence is optional separate scope.

**Dependency / acceptance:** Board/engineering agreement on the boundary, then expected revision, stable mutation identity and authoritative readback if concurrency protection is implemented. Proposed cases cover competing tabs, reordered server completion, leaving during debounce, unknown acknowledgement and freeze. Pending local stars never count as confirmed saves; mutable evidence never receives a “submitted and locked” receipt.

## 3. Remove the implied existing event-to-round scheduling join

**Priority:** P1 composition now; P2 linked-plan capability only after modeling. Affects f35–f37.

**Observed:** `src/lib/supabase/database.types.ts` defines events without a round relation; `src/app/admin/events/new/event-form.tsx` has no round picker. `src/app/admin/round-board.tsx` and event detail are separate authorities. Existing legacy round routes already redirect through `src/app/admin/rounds/legacy-round-redirect.ts`. `live-events.md` explicitly distinguishes separate Operate views from a linked control room. f37's dependency on “Existing group/round scheduling” overstates what supports shared scheduling readiness.

**Correction:** Define the first increment as local event Operate/Schedule/Settings and round Operate/Setup/Results compositions. Reuse existing redirects. Mark a combined event↔round plan, physical posts, current/next rotations and published personal instructions as new domain/API/schema work. Same cycle/kind/name is not a join. Group chips are browsing selections, not assigned physical posts.

**Dependency / acceptance:** Decide cardinality, cycle validation, access, progression authority and plan revisions before a linked plan. Without that contract, show separate authorized round navigation; never infer staffing presence, next table, event-controlled grading or successful notification from a roster/save/time change.

## 4. Complete the route map for authentication and arrival; fix evaluation ownership

**Priority:** P1 coverage correction; P0 for preserving correct write boundaries.

**Observed:** f1 includes account entry but does not name its auth surfaces; f9 lists only `/applicant`, although dedicated arrival is `/checkin/[token]`. Applicant report §§2/13 already document these capabilities. `src/app/member/page.tsx` renders `EvaluationForm` for `/member?assignment=…`; `src/app/member/event/page.tsx` renders `ImpressionForm`. `accessibility.md` incorrectly puts generic evaluation foundations under `/member/event`.

**Correction:** Add related routes/source references to existing rows rather than create new products: `/login` and its existing Clerk route, `/checkin/[token]`, staff-assisted check-in under `/admin/events/[id]`, and `/member?assignment=…`. Correct the accessibility handoff's route mapping. Retain legacy `/applicant/[token]`, round and notifications redirects in the coverage ledger; exclude test harness routes from the product backlog.

**Dependency / acceptance:** Preserve allowlisted auth return, role/cycle authorization and duplicate-safe attendance. Proposed scenarios distinguish member, applicant and walk-up returns. Observation saving never claims an evaluation lock, attendance, merit credit or release. A connected staff fallback must not promise success when both devices cannot reach the server.

## 5. Preserve target-bound attachment and provider retry work in scope estimates

**Priority:** P0 state truth; P1 new receipt/readback work. Affects f4/f42/f51.

**Observed:** `trust-and-recovery.md` identifies attachment confirmation/races in `src/app/applicant/resume-replace.tsx` and `src/lib/resume-upload.ts`, and an unbounded retry/ambiguous response treatment in `src/app/admin/notifications/retry-button.tsx`. `src/lib/email.ts` sets `delivered: true` after provider HTTP success, even without a parsed provider ID. f42 correctly rejects inbox-delivery claims, but its “Refine” label understates the proposed target-bound retry/readback contract.

**Correction:** Keep truthful provider-success copy as an existing-data refinement; classify target-bound retry/readback and authoritative resume attachment confirmation as contract work. Keep lost attachment acknowledgement distinct from confirmed failure: the old file cannot be promised to remain effective after an unknown result. Do not add provider webhooks, an inbox or resume version history to satisfy this increment.

**Dependency / acceptance:** Engineering establishes the authoritative current attachment and notification identity/status, bounded waits and safe reconciliation. A retry refresh performs no send; retry uses the same outbox record/provider key; `NOT_DUE` means no new send attempted. HTTP acceptance is labeled “Sent to email provider,” never inbox delivery/read. A released outcome remains released after email failure; answers export never implies attachment-byte backup.

## 6. Make shared departure guards conditional, not a mandatory new platform

**Priority:** P0 preserve known recovery/identify loss risks; P1/P2 targeted guard only where warranted.

**Observed:** `member.md` §§5/14 require a shared dirty-task guard as P0 M–L; `trust-and-recovery.md` explicitly calls a net-new navigation guard conditional and rejects universal confirmations. Existing workflows differ: applicant submission may proceed after autosave failure, immutable evaluation lock needs the latest draft receipt, Group Case has dedicated protection, and Speed Dating lacks equivalent recovery. No observed live loss incident was established by this review.

**Correction:** Choose the narrow trust recommendation for synthesis. Preserve existing guards and investigate unsupported exits; fix specific memory-only/debounce/unknown-write departures. Do not make every route, cohort change and sign-out wait for a universal save engine or mandatory dialog.

**Dependency / acceptance:** Feature-specific persistence/exits inventory and secure backup lifecycle. Confirmed work causes no new confirmation; unresolved work explains the actual risk and existing recovery actions; failed autosave never traps navigation or sign-out. Keep exact task/cycle/account scope and distinguish an explicit leave from a guarantee of backup/deletion.

## 7. Represent lifecycle handoffs without quietly authorizing new persistent tools

**Priority:** P1 accepted-offer handoff; P2/policy-gated cycle handover. Affects f12/f43/f44/f47.

**Observed:** `src/app/admin/people/onboarding.tsx` explicitly says checklist preparation and membership access are separate. Applicant onboarding and provisioning already exist, but the proposed accepted/onboarding/access reconciliation row in `product-critique.md` is new aggregation, not just checklist restyling. Its H6 also proposes a new persistent cycle handover record; f44 more cautiously conditions a checklist on ownership/retention policy. These are materially different scope commitments.

**Correction:** Add the thin access reconciliation to the inventory as a proposed authorized read model, distinct from existing onboarding/access controls. Choose a nonpersistent owner-reviewed handover checklist first; defer a persistent handover record until purpose, owner, effective-cycle policy and retention are defined. Do not present either as already implemented or add a new CRM/wiki destination.

**Dependency / acceptance:** Authoritative offer response, checklist ownership/completion and membership capability sources. All applicant tasks complete with missing access says waiting for the authorized owner; checklist completion grants no role. Handover/clone cannot copy applicants, evaluations, decisions or policy approval into a new cycle. Unknown provisioning stays unknown, not completed or automatically repaired.

## 8. Replace the flat “First” list with dependency-linked acceptance slices

**Priority:** P0 synthesis quality; no application change.

**Observed:** `features.json` contains no per-row source or acceptance fields, and assigns “First” to many independent work packages. Its priorities obscure the reports' critical distinction between state safety, useful composition and conditional infrastructure. Source facts and hypotheses are carefully separated in the reports but are not recoverable from each inventory row alone. Shared shell/accessibility work also lacks an explicit cross-cutting dependency in that inventory.

**Correction:** Add source references, observed baseline, proposed delta, acceptance criteria and dependency IDs to each row or a linked ledger. Use three ordered slices: (1) truthful state/permission/recovery defects and explicit policy gates, (2) one complete applicant, reviewer and operator handoff using shared visual/focus/receipt roles, (3) connected secondary tools and conditional new contracts. Split mixed rows instead of marking an entire workflow blocked by one optional dependency. Retain authorized rankings/results; changing their default presentation must not silently change scoring or require deleting evidence views.

**Dependency / acceptance:** Incorporate the Board report when it arrives and reconcile its routes/capabilities against this ledger. Every supported production route maps to an existing feature, preserved redirect or explicit exclusion; each proposed new contract is labeled and costed separately. Shared scope works without a sidebar; focus/44px targets/reflow/live announcements are acceptance requirements, not source-certified conformance. No first-release requirement for a rotation engine, universal navigation guard, broadcast automation, project LMS or full legacy CSS cleanup.

These are proposed acceptance checks only. Runtime behavior, deployed migrations, provider events, accessibility, real applicant/operator agreement and measurable improvement remain unverified. The strategy earns its scope by completing these concrete handoffs before adding new destinations or persistent coordination systems.
