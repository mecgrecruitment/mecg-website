# Private workspace replacement

2026-10-17 · local implementation, not deployed.

Replaced the private workspace's navy hero and floating pill navigation with a
persistent grouped sidebar, compact page headers, a neutral canvas and plain
bordered work surfaces. Recruitment places the applicant list beside attention
queues and events. Rows open the applicant file; manual status controls remain
in the dossier and stage board. Bulk advancement appears after selection and
stays available in its disabled state after an uncertain result.

My work emphasizes the next task and suppresses an empty legacy assignment
section. Read-only Group Case review remains accessible. Grading search, progress
and disclosure affordances are clearer. Applicant status uses a compact top bar,
plain status heading, and application/schedule columns; intake uses a quiet step
guide. Authentication, scoring, consent and recovery contracts are preserved.

Verification:

- TypeScript and targeted ESLint passed; `git diff --check` passed.
- 37 targeted Node cases passed: applicant status and next action, selected-cycle
  navigation, member work continuity, advancement selection and role navigation.
- 12 Playwright cases passed in desktop and mobile Chromium: large release
  review, advancement cancellation/focus, malformed/lost/stalled advancement
  receipts, and warning before leaving unconfirmed Group Case observations.
- Actual page code inspected through the local synthetic walkthrough at 1280px
  and 390px: Board, member grading and applicant layouts had no horizontal
  overflow. Group Case expansion and mobile Menu were exercised. A panel-only
  overview retained a full-width applicant-name column and omitted an
  inaccessible interview-progress link.
- An independent source review found two material role-specific defects. Both
  were corrected and rechecked by that reviewer. This is a bounded source
  review, not a whole-product usability verdict.
- The design detector flagged pre-existing projector gradient text and marketing
  grid backgrounds; these were outside this private-workspace replacement.

The walkthrough uses fictional in-memory data and blocks writes. These checks do
not establish hosted integration behavior or real operator acceptance. The full
application test suite and production build were not rerun for this UI revision.

## Shared geometry refinement

The user supplied App Designer Pro and requested consistent spacing, sizing and
roundness. The archive's layout/type/finish/critique references matched the
installed copies. Their applicable web guidance was used with the shared design
workflow, preserving the current navigation and brand.

Private rules moved out of the accumulated `globals.css` overrides into
`src/app/workspace.css`. Geometry is defined once: 4px spacing rhythm, 8px control
corners, 12px panels, 40px standard desktop controls and 44px narrow/coarse-pointer
controls. Shared fields, badges, grading search, application intake and settings
panels consume these roles. Input focus, placeholder, invalid and disabled
states are explicit. Public page styling remains outside these scoped rules.

27 targeted Node cases and 14 desktop/mobile Playwright cases passed, including
application keyboard validation/recovery/materials/consent, advancement receipts,
and leaving unconfirmed Group Case observations. TypeScript, targeted ESLint and
whitespace checks passed. Browser measurements confirmed desktop Settings
controls at 40px/8px/14px type, Settings panels at 24px padding/12px radius, and
mobile grading search at 44px/8px/16px type with no horizontal overflow at 390px.

The independent visual review scored only rhythm/space, consistency/finish and
web fluency. It found a direct-child style overriding mobile grading padding and
a saved-status line hiding qualification information. Both were corrected and
visibly rechecked; the three narrow review dimensions were scored 4/5. This is
not a whole-product design rating, native-platform validation, or accessibility
certification. Full build/suite and hosted integrations were not rerun for this
geometry refinement.
