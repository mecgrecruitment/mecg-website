# Individual release and scoring guide write acknowledgements

2026-10-16. Working-tree response to V2 panel findings 081 (individual release) and 021 (scoring guide save). The V2 snapshot and its votes are unchanged. This implementation is not a new panel endorsement.

Individual outcome release and scoring guide saves now bound the entire request and JSON body to 15 seconds. A transport failure, stalled headers/body, 5xx, timeout or malformed success receipt produces an explicit uncertain result rather than a success claim. A synchronous busy guard prevents duplicate activation. Known 4xx rejections retain the operator's choice for correction.

## Individual release

The RELEASE API now returns an operation-specific receipt containing the exact decision ID and `released`, `notified`, `queued` booleans for confirmed release. Delivered notifications return 200; queued or failed delivery returns 202 with accurate delivery flags. The existing release transaction, durable notification outbox, permission checks and batch release behavior are unchanged. In particular, the SQL release function returns void; a generic `{ok:true}` is no longer treated as proof of this particular operation by the client.

The control checks its exact decision ID before displaying success. An uncertain receipt keeps the same control disabled, focuses a persistent explanation, and offers a full reload to inspect the current decision state. It never automatically retries the mutation. The production dossier and Hash pages render this button only for a currently LOCKED decision; full authorized page reload is the current-state readback before any fresh review. There is no new unguarded status endpoint. This does not claim to cancel an already committing server request.

## Scoring guide

The API preserves the actual `set_rubric_criteria` text-ID result and adds the authorized target round ID. Missing or unusable RPC acknowledgement returns an explicit uncertain 500. The client requires the exact round ID and a nonempty actual rubric ID. The SQL may legitimately return a new rubric ID when it creates a version; comparing against an old ID would reject valid saves. No version is guessed or claimed from this receipt. Success tells the operator to reload the current guide to check its version.

On uncertainty, current wording remains editable and the save action stays disabled until a full authorized reload. A private JSON download preserves round/cycle, based-on version and current criteria before reloading. Reload requires an explicit confirmation explaining that local wording will be replaced. No criteria are written to browser storage. Result focus returns the keyboard user to the save outcome. Existing scoring weights, validation, maximum criteria and round-status gates remain authoritative.

## Verification

- API tests: 55 passed, 0 failed across the existing decisions and rush suites. Seven new cases cover delivery lookup/provider failure receipts and absent/malformed rubric acknowledgements; delivered/deferred release assertions now verify exact decision-specific receipts. Raw log `/tmp/mecg-operator-write-api-final.log`.
- Initial cross-engine focused browser pass: 50/50 (ten scenarios across Chromium, mobile Chromium, Firefox, WebKit and mobile WebKit). Both controls exercise dropped response, malformed 2xx, stalled headers and stalled JSON body, uncertain write lock, result focus and successful receipt. Scoring guide scenarios also verify retained editable wording and downloaded private copy contents. Raw log `/tmp/mecg-operator-write-receipts-final.log`.
- Initial Chromium iteration: 6 passed, 4 failed because the test selected buttons by their original accessible name after the pending label changed. The test was corrected to select the actual pending label; no implementation timeout was extended. Raw log `/tmp/mecg-operator-write-receipts-first.log`.

Final broadened verification (wrong-target receipt and known rejection, plus existing rubric validation) is recorded below after execution. Browser tests use the real components in explicitly gated synthetic local harnesses and intercept external writes. They do not prove hosted authentication, production delivery or human acceptance.

Final broadened coverage: **all 80 checks have passing evidence**, comprising 70/80 in `/tmp/mecg-operator-write-receipts-complete.log` and the corrected ten known-rejection checks passing 10/10 in `/tmp/mecg-operator-write-known-rejection-final.log`. This is split-run coverage, not an 80/80 single run. The initial known-rejection assertions matched both the actual error notice and Next.js's empty route announcer; selecting the notice by its error text fixed the test without changing product behavior. The additional checks prove wrong-target receipts stay uncertain, known rejections preserve editing and retry choice, and the existing field validation/pending snapshot checks remain intact across all five browser configurations. Targeted ESLint and `git diff --check` passed after the implementation.
