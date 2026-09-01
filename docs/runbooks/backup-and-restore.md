# Restore a Supabase backup

Run this procedure before Gate A, then once per semester. Never restore a test backup over the production project.

## Prepare an isolated target

1. Create an empty Supabase project that contains no production integrations.
2. Restrict access to the engineering owner and the release reviewer.
3. Disable outgoing email and scheduled jobs.
4. Record the source backup timestamp and the target project ID.

## Restore and verify

1. Restore the encrypted backup with the approved Supabase procedure.
2. Link the repository to the isolated target.
3. Run `npm run supabase:verify-project` only after updating the verifier for the isolated target or using an approved staging verifier. Do not weaken the production-project check in committed code.
4. Compare the migration ledger with `supabase/migrations`.
5. Run `npm run supabase:lint`.
6. Run `npm run test:supabase`.
7. Run `npm run verify:workflow` with test users.
8. Confirm that private storage objects remain private.
9. Confirm that an unrelated authenticated user cannot read another applicant's data.

## Dispose of the target

1. Export the verification record without user data.
2. Delete temporary Auth users.
3. Delete the isolated project after the reviewer accepts the result.
4. Record the deletion time.

## Exit criteria

- The schema and migration ledger match the source release.
- Database tests pass.
- The full workflow passes.
- Privacy checks fail closed.
- The reviewer records the restore duration and result.
