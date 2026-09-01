# Verify production configuration

Use this runbook before Gate A and after any Vercel or Supabase project change.

## Required access

You need authorized access to the MECG Vercel project and the MECG Recruitment Supabase project. Do not copy secret values into notes, screenshots, issue trackers, or the repository.

## Verify the target project

1. Create `.env.local` from `.env.example`.
2. Set the MECG-prefixed Supabase variables.
3. Set the server-only Supabase service-role variable.
4. Run `npm run supabase:link`.
5. Run `npm run supabase:verify-project`.

Expected result: the script names project `chrxtsohxazngabdcpzb` and exits with status 0.

## Verify required services

Confirm these settings without recording their values:

- `NEXT_PUBLIC_MECG_SUPABASE_URL`
- `NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY`
- `MECG_SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `CRON_SECRET`
- `BASE_URL`, when MECG does not use host-header inference

In Supabase Auth, enable leaked-password protection. Confirm the production callback URL and both password-recovery URLs.

## Verify scheduled work

Inspect the last seven runs for each route in `vercel.json`. Confirm that each run returned a success status. Investigate any missing run, 401, 503, or timeout before opening applications.

## Run protected checks

Start the application against staging. Run:

```bash
npm run supabase:verify-project
npm run supabase:lint
npm run test:supabase
npm run verify:backend
npm run verify:auth
npm run verify:workflow
```

Record the date, commit, command, exit status, and short result. Do not attach raw output if it contains user identifiers.

## Exit criteria

- Every command exits with status 0.
- The application portal has the intended open or restricted state.
- A controlled test inbox receives a recruitment email.
- The resume cleanup job has a recent successful run.
- The release owner signs the readiness record.
