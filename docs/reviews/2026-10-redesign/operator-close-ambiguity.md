# Operator close acknowledgement ambiguity

Date: 2026-10-16. Implementation follow-up to panel041/042; this is not a panel vote or operator acceptance evidence.

## Change

An interrupted close POST no longer returns the dialog to a ready confirmation based on a generic `false`. `useRushAction` keeps its existing boolean `act` contract for other callers and adds a scoped `closeRound` adapter with acknowledged, explicitly rejected, and unknown outcomes. `RoundControls` wires that adapter to `RoundStatusControl`; legacy boolean adapters remain accepted and their `false` results are conservatively unknown.

Every close attempt, including an acknowledged POST, reads the existing authorized `/api/admin/round-close?roundId=…` endpoint with `cache: no-store`. The response must pass the existing summary parser and match the requested round. FROZEN, FINALIZED, or ARCHIVED verifies that grading is closed. Only an explicit client rejection (HTTP 4xx with a string error, excluding 408), followed by authoritative ACTIVE status, offers a fresh explicit confirmation. A transport failure, incomplete/malformed acknowledgement, HTTP 408, or server error remains ambiguous even if a subsequent read is ACTIVE: the original transaction may still commit.

During writing/checking, repeat confirmation is disabled. Unresolved outcomes retain the disabled confirmation, remove “Keep grading open,” and offer neutral dismissal and a read-only status check. Dismissal/Escape and reopening the same mounted control preserve the unresolved state. A later FROZEN read resolves it without another POST. A verified closed state disables further close attempts in that control. No success or failure is inferred from a lost response.

The scoped request helper uses one 10-second deadline covering authorization, headers, and complete JSON body consumption, with both an abort signal and a rejecting race. This bounds preflight coverage reads, write acknowledgements, and reconciliation reads even if a transport ignores abort. A timed-out write is never automatically repeated. Other `useRushAction.act` flows retain their existing behavior.

## Changed files

- `src/app/admin/round-status-control.tsx`
- `src/app/admin/rush-controls.tsx` (scoped adapter and wiring only; existing shared-tree changes preserved)
- `src/app/admin/round-close-request.ts`
- `src/app/admin/round-close-request.test.ts`
- `tests/e2e/operator-close.spec.ts`
- This receipt.

## Actual verification

- `PLAYWRIGHT_PORT=3000 npx playwright test tests/e2e/operator-close.spec.ts --workers=2 --output=.audit/operator-close-ambiguity` — **34 passed**, 17 scenarios across desktop Chromium and Pixel 7 Chromium emulation, final run 10.9 seconds. All API responses were intercepted synthetic fixtures on the already-running local operations harness. Includes committed freeze plus dropped acknowledgement followed by FROZEN, unavailable/ACTIVE/malformed/wrong-round reconciliation, unresolved dismissal/reopen, explicit rejection plus ACTIVE then fresh confirmation, server error ambiguity, and later FROZEN resolution without another write. Existing coverage/permission/keyboard/layout cases also pass.
- `node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/app/admin/round-close-request.test.ts` — **3 passed**: non-cooperating stalled headers, incomplete stalled body, and full acknowledgement parsing.
- Focused ESLint on the five changed TypeScript files — passed.
- `npx tsc --noEmit --incremental false` — passed.
- Initial browser pass exposed stale unknown text persisting during a second status check. The text now clears while checking; tests wait for reconciliation before exercising Escape/reopen. The final command above passes.

## Limits and remaining risks

No full suite, build, cross-engine run, production API, hosted credentials, deployment, external messages, or commits were used. This receipt does not change the prior full-suite totals or panel manifests/votes/frozen exports.

Unknown outcomes deliberately have no force-retry button. A negative read cannot prove that a delayed write has finished; safely permitting retry in that case requires a server operation receipt or equivalent transaction guarantee. The unresolved state is local to the mounted control and survives dialog dismissal, not a full page reload or navigation/remount. A fresh control still requires current authoritative coverage/status before any close confirmation, but this patch does not add durable operation tracking across page lifetimes. Live authorization/database behavior and physical-device/network behavior remain unverified here.

## Parent follow-up: recovery across reload

The parent reproduced the page-lifetime limitation identified above and added a per-round session recovery marker before sending a close request. An unresolved marker restores the unknown state after reload/navigation in the same tab and prevents a second close. It clears only after an authoritative closed status, or an explicit rejection followed by authoritative ACTIVE. The new reload regression passed as part of36 focused Chromium checks. Browser storage can be unavailable or cleared, so this is browser recovery rather than a server operation ledger; hosted transaction/provider verification is still open. The original agent's verification scope above remains historical.
