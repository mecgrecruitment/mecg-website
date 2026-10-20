disposition: ship

Focused source and supplied-capture review of the round-close continuation. No browser session, database execution, hosted credentials, real participant panel or deployment was used by this reviewer.

## persistence

Reviewed the extracted `round-status-control.tsx`, `RoundControls` permission prop and round-board integration; GET `/api/admin/round-close`; `round-close-summary.ts`; migration `20261016194000`; its 31-assertion SQL fixture; operator-close E2E/harness; and the existing freeze transition supporting the displayed promises. Both supplied local synthetic desktop/mobile modal captures were opened. The later permission and error/focus changes were checked directly in current source.

## fidelity

Authorization is enforced at three relevant layers: status controls require `canManageStatus`, the API resolves the round’s actual RLS-scoped cycle before checking `MANAGE_CYCLE`, and the caller-scoped RPC requires current Board/Owner membership. Committee assignment controls remain available without granting round-status access. The response parser returns only the nine aggregate fields; neither applicant identities nor provider error text are exposed.

Coverage uses enrolled or actually assigned applicants from the requested cycle, excludes drafts/withdrawals, selects the latest nonvoid observation and separates submitted work from independently valid current-rubric evidence. Conflicted merit evaluations cannot make applicants ready; real unfinished assignment records remain visible in the open count. Screening’s separate contract is explicitly rejected. The parser rejects inconsistent totals, including fewer than two valid evaluations per ready applicant.

The UI describes advisory counts and their load time, explicitly says counts may change, and warns that incomplete work does not prevent closing. It does not claim an atomic freeze of the displayed cohort. The existing freeze writer still owns authorization, current-status transition validation and locking. A detected status change during summary load disables confirmation and requests reload; later drift remains governed by that writer.

## ceiling

The captures show readable tabular counts and distinct submitted/valid labels. On mobile the dialog scrolls rather than expanding beyond the viewport; the lower actions sit below the supplied capture’s initial scroll position. Source provides a native modal, initial cancel focus, Escape cancellation and captured-trigger focus restoration. Loading, invalid/wrong-round/stale-status responses and failures disable confirmation; retry/refresh replace the snapshot. Controlled network errors offer recovery. A synchronous submission ref prevents duplicate close writes before React’s pending state renders.

## material_fixes

None identified in the reviewed continuation. No code edits were made by this reviewer. Permission hiding, captured-trigger focus restoration, controlled network errors and the parser’s ready-to-valid invariant are present in the final inspected source.

## keep

Keep the read-only aggregate boundary, advisory snapshot wording, separate submitted/valid counts, explicit incomplete-work warning, current Board/Owner freeze authority and deliberate confirmation. Parent-reported evidence is 650 Node tests and 673 SQL assertions across 11 files, with browser verification running as this review completed; this reviewer inspected tests and source but did not independently execute those suites. This disposition covers the focused local continuation and does not certify production integrations or real-user acceptance.
