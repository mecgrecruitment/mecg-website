# Project audit, 2026-09-01

Seven parallel section audits of the MECG platform (Next.js 16 + Supabase).
Read-only. No code was changed. Each section report has full detail, file:line,
and the smallest fix per finding.

| # | Section | Report | CRIT | HIGH |
|---|---------|--------|------|------|
| 1 | Auth and session | [01-auth-security.md](01-auth-security.md) | 0 | 1 |
| 2 | Database and RLS | [02-database-rls.md](02-database-rls.md) | 0 | 0 |
| 3 | API routes | [03-api-routes.md](03-api-routes.md) | 0 | 1 |
| 4 | Domain logic | [04-domain-logic.md](04-domain-logic.md) | 0 | 2 |
| 5 | Portal UI | [05-portal-ui.md](05-portal-ui.md) | 1 | 2 |
| 6 | Marketing site | [06-marketing-seo-a11y.md](06-marketing-seo-a11y.md) | 0 | 3 |
| 7 | Build, CI, tests | [07-build-ci-tests.md](07-build-ci-tests.md) | 0 | 1 |

## Build status

Lint, typecheck, and all 81 tests pass. `npm run build` fails only at the
`/join` prerender on a missing `NEXT_PUBLIC_SUPABASE_URL`, which is the
documented local behavior; CI supplies placeholders.

## Fix order

1. Hash panel is not blind (sec 4). PANEL-only members see applicant name,
   contact, resume, and which named evaluator gave which score.
   Blind screening already has the right pattern; Hash never got it.
2. Test script `&&` chain (sec 7). A failure in group 1 or 2 means 42 of 81
   tests never run. Silent, not reported as skipped.
3. Error boundaries call `retry`, Next.js passes `reset` (sec 5).
   Try again throws on `/applicant` and `/apply`.
4. Session cookie is not HttpOnly (sec 1). Blocked on moving the resume
   upload to a server-issued signed URL first.
5. Token routes indexable, stale OG cards, focus ring below 3:1 (sec 6).
6. Round status drift between `workflow.ts` and `rush.set_round_status` (sec 4).
7. `admin/setup` has no app-layer permission check (sec 3). Not exploitable,
   the RPC self-checks. Defense in depth.

## Cross-section notes

- The database is the real enforcement layer. Sec 2 found zero HIGH: RLS
  forced on every table, all 88 SECURITY DEFINER functions lock search_path
  and self-authorize. That is why sec 1 and 3 kept finding thin app-layer
  checks were still safe.
- Sec 1 and 3 independently flagged the same two items (no rate limit on
  `/api/account/password`, proxy matcher gaps). Higher confidence in both.
- CI runs lint, test, typecheck, build, but never `supabase db lint`, the SQL
  tests, or a migration parity check. CI can be green while RLS is broken.
  `RELEASE_AUDIT_FINDINGS.md` documents a real past incident of exactly this.
- `DESIGN.md:12` bans the orange-on-white pairing that `globals.css:60-67`
  ships as the global focus ring. The doc is right, the CSS never caught up.
