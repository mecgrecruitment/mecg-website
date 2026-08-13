# Privacy and sensitive-data audit

Last reviewed: 2026-08-13

## Restricted data

The following data must remain behind authenticated, role-checked server routes and
database row-level security. It must never appear in public content, static assets,
client-side bundles, analytics, logs, screenshots, or repository fixtures containing
real people:

- hash-session schedules, locations, participants, votes, deliberations, and decisions;
- candidate applications, contact information, resumes, responses, and status;
- evaluator scores, notes, reactions, conflicts, and assignments;
- member allowlists, private email addresses, authentication data, and audit records;
- service-role keys, database credentials, Turnstile secrets, and signed URLs.

The `/internal/hash` feature is intentionally retained. Its server-side board/member
authorization and database RLS are the privacy boundary; only its former public
calendar entries were removed.

## Public personal data requiring consent

The public team page still contains member names, roles, portraits when available,
and LinkedIn profile links. These are intentional public profile fields, but the board
should obtain member consent and review or remove stale profiles at every leadership
transition. Individual student email addresses are not public; visitors should use the
organization address in `src/lib/site-content.ts`.

Community photographs can identify people. Confirm consent and usage rights before
adding new images, and strip location/EXIF metadata before committing originals.

## Automated check

Run `npm run audit:sensitive`. The check blocks known credential formats, real-looking
individual UMich email addresses anywhere in the repository, individual addresses in
public-facing source, public App/Group Hash references, and raw team scrape artifacts.
Database fixtures must use unmistakable `.test` or `.candidate` aliases. This is a
guardrail, not a replacement for human review.

## Historical repository exposure

Removed individual emails and scrape artifacts remain reachable in older Git commits.
Purging them requires a coordinated history rewrite and credential-style incident
procedure; do not rewrite shared history without notifying every contributor and
replacing existing clones. GitHub repository visibility and access should be reviewed
separately.
