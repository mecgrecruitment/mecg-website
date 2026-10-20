# Authorized cohort workspace selection — finding 089

Implemented on 2026-10-16 against the current shared tree. An explicit authorized cohort now stays selected across the workspace instead of being replaced by status-priority defaults. Older round deep links resolve their actual authorized cohort. This is a scoped implementation receipt, not a panel vote or hosted acceptance result.

## Selection and authorization contract

- `?cycleId=…` is the canonical, tab-local selector. Legacy `?cycle=…` links remain supported. Contradictory aliases/multiple values, empty values, surrounding whitespace and oversized selectors fail closed. No cookie or account-wide preference is introduced.
- For protected workspace requests, Proxy overwrites `x-mecg-workspace-cycle` using URL values, including replacing a caller-supplied header with an empty selector when the URL has none. The server-only `workspace-cycle.ts` reads that request context with Next's asynchronous `headers()` API. The header is a selector, never authorization.
- Every selected cohort must pass the caller's active membership and the destination's existing capability checks. An explicit unauthorized cohort or insufficient selected-cohort capability cannot silently fall back to another cohort. Existing status-priority defaults apply only when selection is absent. Routes with alternative capabilities evaluate those alternatives within the same selected cohort.
- The shared navigation scopes primary, member and administrative links with the actual page cohort. A visible native cohort select lists cohorts authorized for the current destination. Current-cycle Board/Owner tool gates no longer borrow a role from another cohort. Selected secondary destinations still match correctly with query strings present.
- URL helpers preserve unrelated query values, encoded return targets and hashes. Switching away from a cohort-bound entity returns to its matching list/workspace and removes assignment/event/return ids that cannot be transplanted into the new cohort. Server links, list pagination, legacy round redirects and relevant client returns preserve selection.

## Integrated destinations and mutations

Dashboard, settings, interviews, people, account recovery, communications, application review, activity, referrals, decisions/discussion, projects, operations and new-event routes use the shared server selector. Member My work, Speed Dating, Group Case, screening, referral, Hash and live-event routes likewise honor the selected cohort. Member event tasks filter the existing cross-cycle event RPC through the selected cycle's authorized event ids.

An explicit round id is first resolved through an RLS-scoped minimal `cycle_id` lookup. The actual cycle must pass the existing round-workspace capabilities before detailed queries/rendering. An authorized older round works even when a different cohort has higher default priority or an authorized query is stale; foreign rounds and unauthorized explicit selectors remain unavailable. Calibration similarly derives context from its actual round. Existing application/event entity authorization remains intact, with actual-cycle return navigation scoped.

Hash polling now carries `cycleId` in both member and Board requests. Those API routes independently parse the URL selector and check caller membership/capabilities; they do not trust the Proxy header. This prevents a selected older workspace from polling another cohort's presenter/tally. Member ballot visibility and private Board tally boundaries remain unchanged.

Successful cloning validates the returned cohort id and navigates to `/admin/settings?cycleId=…`; that page rechecks real membership and capability. A malformed success receipt cannot claim a confirmed destination. The generic round-close unknown-acknowledgement behavior was preserved. Event creation now sends the selected cohort in its mutation payload; returned event/QR URLs and QR rotation preserve both the entity token and cohort context. These changes grant no new permission and change no RLS, SQL, grading, release or membership policy.

## Existing lifecycle policy

The report's simultaneous active-plus-draft premise conflicts with the current database: `rush_cycles_one_non_terminal_idx` permits only one unfinished cycle. The existing clone RPC inserts a draft and still obeys that gate. No current cycle is silently closed, and no migration weakens the constraint. Clone copy now explains that the current cycle must be closed before starting the next.

The multi-membership routing fixture intentionally models current-active, next-draft and older-closed memberships to stress selection priority; it is explicitly synthetic and does not prove that prohibited database coexistence is supported. Successful real cloning still requires the existing database lifecycle preconditions.

## Verification

Final focused command:

```sh
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/components/workspace-nav.test.ts src/app/admin/cohort-lifecycle.test.ts src/lib/workspace-cycle.test.ts src/lib/workspace-cycle-url.test.ts src/proxy.test.ts src/app/api/admin/hash/live/cohort-selection.test.ts
```

**21/21 focused Node tests passed.** They cover actual settings/dashboard/interviews server rendering for explicit cohorts; older-round actual context; foreign-round/capability rejection; scoped shared navigation and authorized picker options; proxy header overwrite; alias conflicts; preserved query/hash; validated clone destinations; and both live Hash API permission boundaries. Existing page tests were updated to model the new request-only context and scoped links. Earlier integration runs passed the full Node suite; the parent owns the final aggregate run after the latest additions.

`npx tsc --noEmit --incremental false` and scoped ESLint over all admin/member sources plus cycle/proxy/navigation helpers and fixtures passed. No SQL changed; no database suite was repeated for this task. Focused logs: `.audit/cohort-workspace-selection/node.log`, `types.log`, `lint.log`.

The gated localhost fixture at `/apply/test-harness/cohort` uses the production select and clone/event controls with synthetic memberships and intercepted API responses. `cohort-workspace-selection.spec.ts` now contains seven cases per project: scoped draft links, switch query/hash preservation, clone navigation, unconfirmed clone receipt, foreign/conflicting selectors, and selected-cohort event mutation/QR navigation. The initial desktop/mobile run had six passing cases and six fixture failures: Next's streamed not-found UI can use HTTP 200, and an exact destination interceptor missed the RSC query suffix and fell through to real sign-in protection. Assertions/interception were corrected; no hosted sign-in or data write occurred. The parent aggregate browser run owns final results for the corrected seven-case file. No corrected full browser-pass claim is made here before that result.

Desktop/mobile switcher captures from the passing initial navigation case were visually inspected: the native select, cohort name/status, links and clone controls were legible and the mobile overflow check passed. Captures are under `.audit/cohort-workspace-selection/browser/`. They show the explicitly synthetic fixture with Linux Chromium/fallback-font limits, not a full authenticated private-screen acceptance session.

## Remaining evidence

The parent aggregate build/browser checks remain the integration gate for these broad navigation changes. Hosted Clerk session refresh after cloning, real PostgREST/RLS membership reads, live cohort lifecycle operations and observed multi-role operator success still require staging with synthetic accounts. No hosted write, external message, commit or deployment was performed.

## Parent integrated verification

The integrated610-check run passed586 and failed24. Two cohort selector cases in WebKit/mobileWebKit operated the server-rendered select before hydration; the test now waits for the existing client-ready marker before altering history. Twenty deck cases had an obsolete unscoped mock after the correct poll query change, and two contact/sign-out focus cases exposed a real post-render race. Those source races were fixed with post-commit effects. The corrected focused110-check run passed across allfive configurations, including35cohort cases (seven per configuration), all20deck cases and allcontact/sign-out cases. The added event mutation case verifies the selected cycle payload and resulting event/token navigation. See `evidence/integrated-final-browser.log` and `evidence/integrated-followup-browser.log`. No one-run615-pass claim is made. Final760Node checks, production build and lint pass; the build includes TypeScript.
