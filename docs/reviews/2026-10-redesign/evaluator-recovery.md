# Evaluator draft recovery and review

Later-tree response to V1 panel071,073–078. Frozen reports and votes remain unchanged.

The evaluator form now checks actual browser-storage writes against the exact visible draft signature. Denied storage access, quota failure and oversized snapshots cannot produce a current-backup claim. A confirmed server version is distinguished from a current same-tab browser backup and from memory-only changes. Private JSON copies can be downloaded before leaving or retrying. A retry during a failed initial lookup preserves edited in-memory evidence instead of reloading it away.

When the browser and server contain different drafts, neither is overwritten automatically. The form pauses editing and syncing, shows both ratings/notes/evidence, and offers downloads and an explicit copy choice. Recovering the browser copy syncs that chosen version; selecting the server deliberately replaces the browser backup. Equality compares the current rubric's normalized ordered payload, not timestamps. There is no server revision/CAS or automatic merge claim; concurrent server writes remain a separate concern.

Initial draft loading, autosave and final locking have 15-second deadlines covering authorization, headers and JSON consumption. Cleanup cancels the underlying request and stale results do not update the component. Initial-read timeout restores usable editing/recovery; uncertain save retains evidence; uncertain lock preserves the draft and tells the reviewer to check My work before retrying. A successful autosave also requires a valid timestamp receipt, rather than accepting any 2xx body.

Entering review moves focus to the review heading before the final lock control. Keep editing returns focus to the review action. Pressing Enter on the summary heading does not lock the evaluation; confirmation remains a separate action after the summary.

## Verification

The final evaluator browser run passed **55/55** checks: 11 scenarios across desktop/mobile Chromium, Firefox, desktop/mobile WebKit. It covers denied/full storage, exact downloaded contents, verified/malformed server receipts, keyboard review/edit/lock, retry without reload, both divergent-copy choices, and stalled load/save/lock recovery. Log: `evidence/evaluator-recovery-browser.log`.

Earlier runs are retained separately. One test setup targeted visually hidden radios instead of their labels; another assumed one initial GET despite development StrictMode. Corrected setup uses label activation and actual navigation counts. A substantive Firefox reload failure showed that leaving editable controls mounted during conflict could expose restored form state and compete for focus. Conflict now removes the editable form until selection and focuses its heading after commit. The complete 55-check run verifies that behavior on all five configurations.

Node suite currently707 checks, TypeScript, lint and production build pass for this evaluator follow-up. Group Case task-continuity work continues separately and may produce a later aggregate receipt. These are intercepted synthetic local journeys. They do not establish hosted identity/RLS/storage acceptance, cross-device concurrency guarantees, physical-device accessibility or human reviewer comprehension.
