# WebKit verification runner diagnosis — 16 October 2026

The earlier complete cross-engine run had 236 passes and one failed WebKit case; it was not an all-green receipt. Longer assertion bounds and serial execution did not resolve the failure. Subsequent diagnostics reported a crashed target.

`coredumpctl info 797875` and the corresponding kernel journal identified a null-address SIGSEGV in `WPEWebProcess`, on the `ThreadedCompositor` thread (`libWPEWebKit-2.0.so.1.10.2 + 0x5fd556a`). Four task-owned container crashes shared that signature. The process came from Playwright's WebKit revision 2336. Available memory and shared memory did not suggest exhaustion. Root-owned cores were inaccessible; no core extraction, host configuration change or symbol-level attribution was made.

The UI uses a brightness filter hover transition. [Playwright issue 42637](https://github.com/microsoft/playwright/issues/42637) documents a matching WPE compositor failure with filter transitions. [WebKit PR 73621](https://github.com/WebKit/WebKit/pull/73621) fixes a null underlying Skia filter, and [Playwright PR 42748](https://github.com/microsoft/playwright/pull/42748) rolls the fix into its WebKit build. This is a plausible match, not proof of the exact native fault from the stripped stack.

The test dependency is now pinned to Playwright 1.64.1, using the matching official `mcr.microsoft.com/playwright:v1.64.1-noble` image. Its bundled WebKit revision is 2370 (27.2). Product animation was retained; temporary focus/timer diagnostics were removed. The negative application-receipt assertion allows 20 seconds for four bounded status reads and their backoff, whose configured maximum is approximately 13 seconds.

The two previously failing malformed-receipt cases passed six repetitions each on desktop and mobile WebKit: **24/24**, `/tmp/mecg-webkit-patched-repeat.log`. The later 503-plus-unavailable-status recovery case passed on all five browser configurations: **5/5**, `/tmp/mecg-unknown-server-receipt.log`. The complete patched-run receipt is recorded separately after completion; focused repeats do not establish that every browser scenario passes.

These are synthetic Linux engine checks. They do not establish physical iPhone or macOS Safari behavior, hosted identity/storage/email integration, or a guarantee that no native crash can recur.
