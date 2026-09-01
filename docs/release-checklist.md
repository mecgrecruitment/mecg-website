# Release MECG

Use this checklist for every production release.

## Before deployment

- [ ] Identify the release commit and owner.
- [ ] Review the diff for unrelated files and secret material.
- [ ] Confirm that every migration is new and immutable.
- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run database lint and pgTAP for a database change.
- [ ] Confirm a rollback or forward-repair procedure.
- [ ] Confirm that staging acceptance tests pass.

## Deploy

- [ ] Apply migrations before code when the new code depends on additive schema.
- [ ] Deploy the application.
- [ ] Check `/api/health`.
- [ ] Test one authorized read and one authorized mutation.
- [ ] Test the matching unauthorized request.
- [ ] Confirm that scheduled jobs retain their configuration.

## After deployment

- [ ] Run the protected verification scripts required by the change.
- [ ] Check production errors and latency.
- [ ] Confirm email delivery when the release changes notifications.
- [ ] Record every command, exit status, and result.
- [ ] Mark the release complete only after the release owner reviews the evidence.
