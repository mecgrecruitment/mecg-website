# My work → Group Case continuity — finding 079

Implemented on 2026-10-16 against the current shared tree. Saved Group Case observations now return to their dedicated workspace instead of entering My work's immutable written-evaluation/completion path. This is an implementation receipt, not a revised panel vote or observed human acceptance.

## Behavior

- My work excludes Group Case observations from inline written assignments, written calibration tasks and recent completions. A Group Case `SUBMITTED` record is no longer described as locked or finished there. Written evaluations keep their existing immutable submission behavior.
- One Group Case workspace summary provides the next action. An active round within its deadline offers “Continue observations” and explains that saved evidence remains editable and that requirements are checked in Group Case. It does not infer validity or completion from a status or star count.
- Published rounds offer a preview. Frozen, finalized, archived and expired active rounds offer “Review saved observations”; they do not create an open grading task. The dedicated route now loads those previously hidden read-only rounds instead of saying no round is ready.
- The dedicated page validates the roster response before rendering. Its canonical database quality verdict and blockers stay in the existing roster; no duplicate validity calculation was introduced in My work.
- A minimal `readOnlyReason` prop disables ratings, clears and notes for a closed deadline, and explains the read-only state for all closed statuses. Applicant disclosures, search and canonical evidence/quality presentation remain available. Existing roster status checks and database authorization remain authoritative.
- Screening reviewers receive neither the Group Case task nor summary in My work. Committee-only users retain the existing explicit member-access explanation. Existing role, conflict and written-review privacy rules were preserved.

## Files

- `src/app/member/page.tsx`: routes Group Case work through its dedicated workspace and removes false immutable-completion classification.
- `src/app/member/group-case/page.tsx`: retains published/active/read-only rounds, validates roster data, passes deadline/read-only context.
- `src/app/member/group-case/workspace-state.ts`: shared availability description; deliberately contains no evaluation-validity calculation.
- `src/app/member/group-case/group-case-roster.tsx`: minimal optional read-only reason and notice.
- `src/app/member/work-continuity.test.ts`: actual server-page rendering with synthetic database/auth boundaries.
- Established Group Case harness gains explicit synthetic round-state variants; `tests/e2e/member-work-continuity.spec.ts` exercises those read-only controls.

No SQL, scoring thresholds, grading policy, evaluation form, auth route or global panel artifact was changed.

## Verification performed

```sh
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/app/member/work-continuity.test.ts src/app/member/assignment-navigation.test.ts src/lib/group-case-roster.test.ts
npx tsc --noEmit --incremental false
npx eslint src/app/member/page.tsx src/app/member/group-case/page.tsx src/app/member/group-case/workspace-state.ts src/app/member/group-case/group-case-roster.tsx src/app/member/work-continuity.test.ts src/app/apply/test-harness/group-case/page.tsx tests/e2e/member-work-continuity.spec.ts
```

**18/18 focused Node tests passed**; TypeScript, scoped lint and scoped diff whitespace checks passed. Logs: `.audit/member-work-continuity/node.log`, `types.log` and `lint.log`.

The eleven new page/state cases cover saved partial Group Case evidence without a locked/completed applicant entry; preserved written immutability; frozen/finalized/archived review paths; an expired active deadline; active editing context; committee access; screening-role task privacy; roster failures distinct from empty states; and fail-closed availability for malformed dates. Actual server components and queries are exercised with mocked identity/database boundaries. The existing roster client is stubbed in these page tests; they do not prove browser interaction or hosted integration.

The parent integration pass will run both `group-case-evidence.spec.ts` and `member-work-continuity.spec.ts` using the established localhost synthetic harness and matching Playwright Docker runner across its configured browser projects. The new browser file covers four read-only states, disabled stars/notes, usable search/disclosure, no write requests and horizontal overflow. No browser-pass result is claimed in this scoped receipt before that run.

## Limits

Availability is evaluated on the server render. This change does not add polling or a live deadline timer; an already open page may need refreshing after a deadline or Board status change. The database still rejects writes after closure, and the existing unconfirmed-save UI retains unsuccessful edits for retry/copying. A successful local page render is not evidence of Clerk/PostgREST/RLS integration, real reviewer success, physical-device behavior or accessibility conformance. No hosted write, deployment, commit or external message occurred.


## Parent integration verification

The parent ran the existing seven Group Case evidence scenarios and four read-only continuity scenarios across all five browser configurations with the matching Playwright1.64.1 image. **55/55 checks passed**, `evidence/member-work-browser.log`. This proves the synthetic client interactions and read-only states above, not hosted identity or a live deadline transition. The combined Node suite now passes722 checks; production build, TypeScript and lint pass. Panel081's operator attention board was also corrected in the parent tree and has its own receipt.
