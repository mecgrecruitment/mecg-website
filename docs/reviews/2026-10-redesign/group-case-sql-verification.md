# Group Case reviewer-quality SQL verification

Verified on 2026-10-16 against a fresh, disposable local PostgreSQL 17 database. **All 169 current migrations applied; 719 assertions passed across all 13 SQL test files; local database lint returned no errors.** The new `group_case_reviewer_quality.sql` contributes ten of those assertions. No scoped SQL or test defect was found, so no implementation or test changes were needed.

This closes the PostgreSQL execution gap recorded in `group-case-evaluator-followup.md`. It does not establish a hosted deployment, production integration, real reviewer acceptance or broader browser/platform coverage.

## Isolation and exact commands

The prior task database container and task volumes were absent before starting. The existing task-only config at `/tmp/mecg-goal-db-20261016/supabase/config.toml` identifies project `mecg-goal-20261016`, database port `55432`, shadow port `55430`, and PostgreSQL major version 17. Clerk local integration is disabled. Current repository migration/test files were copied into that isolated project with Python `shutil.copy2`; both source and isolated directories contained 169 migrations and 13 test files. No seed file exists; the CLI warned about that and continued with the complete migration chain. The tests create transaction-local synthetic fixtures and roll them back.

The CLI was the existing cached Supabase **2.116.0** executable (the bare `supabase` command was unavailable on this shell's PATH). From `/home/rahil/mecg-website`:

```sh
mecg_cli=/home/rahil/.npm/_npx/ade306d1eb8b9835/node_modules/.bin/supabase
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 db start
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 test db supabase/tests
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 db lint --local --schema rush --level error --fail-on error
/tmp/mecg-sql-check-venv/bin/python scripts/check-sql.py
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 stop --project-id mecg-goal-20261016 --no-backup
```

All commands exited zero. The SQL suite reported `Files=13, Tests=719` and `Result: PASS`; this includes the existing Group Case, grading consistency, foundation, operator, privacy, draft and decision suites. Database lint returned `{"results":[],"message":"db lint"}`. The parser checked 182 SQL files, 462 function bodies, 95 RPC names and 26 table names.

Read-only runtime permission inspection used `docker exec -i supabase_db_mecg-goal-20261016 psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off -c ...` to query `pg_proc`, `pg_namespace`, `pg_get_userbyid` and `has_function_privilege` for the three relevant functions. This confirmed:

| Function | Owner | Security definer | Search path | Anonymous execute | Authenticated execute |
| --- | --- | --- | --- | --- | --- |
| `evaluation_observation_quality` | postgres | yes | empty | no | no |
| `group_case_roster` | postgres | yes | empty | no | yes |
| `rate_group_case_applicant` | postgres | yes | empty | no | yes |

No hosted URL, `--linked`, unrelated container, production account, application route or external message was used. Cleanup explicitly selected the task project and `--no-backup`; the CLI reported `backup:false`. Post-cleanup `docker ps -a --filter name=supabase_db_mecg-goal-20261016` and `docker volume ls --filter name=mecg-goal-20261016` returned no entries. The unrelated CTRM containers were not stopped or changed.

## Security and contract review

Compared each replacement function with its latest preceding definition: `rate_group_case_applicant` from `20261016191000_grading_contract_consistency.sql` and `group_case_roster` from `20260914130000_group_case_inline_rating.sql`. The only function-body differences add the canonical quality JSON to the existing save receipt and to the caller's own latest nonvoided roster evaluation. The roster gates quality on the active rubric. There are no new RPC arguments, callable helpers, grants, writes, scoring formulas, thresholds or policy changes in this migration.

The original caller identity, cycle roles, screening-reviewer exclusion, declared conflicts, applicant participation/eligibility, round-open locks, assignment/evaluation locks and immutable-state checks remain in the save path. The roster still joins the requesting evaluator's assignment, filters declared conflicts and withholds Speed Dating data from ordinary members. The private canonical helper remains inaccessible directly to anonymous and authenticated callers. The ten new runtime assertions verify note-only blockers, roster/receipt agreement, another member's inability to read evidence or quality, helper privacy, minimum observations, missing required criteria and a qualifying partial review. Existing SQL suites exercise the retained authorization, freeze and grading contracts.

## Evidence and limits

Logs and exact input hashes are preserved under `.audit/group-case-sql-verification/`: `migrations.log`, `tests.log`, `lint.log`, `security.log`, `parser.log`, `cleanup.log`, `contract.diff` and `inputs.json`. The verified migration SHA-256 is `730c96399dd716c41125f56a42a3456d831e93dcb97a67f4efec513444a62328`; the new test file SHA-256 is `8eceaa28fb1dff26e01a4e1169e554308d2a55543189f33f383fecc46a6bf1aa`. Initial process logs also remain at `/tmp/mecg-group-case-quality-*.log`.

The database was fresh and synthetic. Hosted Clerk/PostgREST/RLS integration, real uploads, actual email delivery and real reviewers remain staging/acceptance work. This pass does not claim a new full browser or Node suite run; their separate prior evidence is described in the evaluator follow-up. No deployment, commit or hosted data change occurred.
