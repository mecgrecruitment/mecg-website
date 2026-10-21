#!/usr/bin/env bash
# Prove that the once-per-statement RLS rewrite shows every actor exactly the
# rows the old policies showed, on the local Supabase stack.
#
#   1. reset the local database to the migration before the rewrite
#   2. seed every policy branch (scripts/rls-initplan/seed.sql)
#   3. record, for every seeded identity and every table with a SELECT policy,
#      the set of visible primary keys                              -> phase "old"
#   4. apply the rewrite migration and record again                 -> phase "new"
#   5. require old = new, and require that the identities differ among
#      themselves (a harness where everyone sees everything proves nothing)
#   6. break one new policy on purpose, record again, require a difference,
#      restore, and require old = restored. Two breaks, two guards.
#   7. EXPLAIN (ANALYZE, BUFFERS) the hot queries in both phases
#
# Usage: scripts/rls-initplan/verify-equivalence.sh [migration.sql]
# Needs: a running `supabase start` stack, psql, and the Supabase CLI.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
HERE=$ROOT/scripts/rls-initplan
MIGRATION=${1:-$(ls "$ROOT"/supabase/migrations/*_rls_select_policies_once_per_statement.sql | tail -1)}
DB=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
OUT=${RLS_HARNESS_OUT:-/tmp/rls-equivalence}
export SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN=${SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN:-local.clerk.accounts.dev}
mkdir -p "$OUT"
rm -f "$OUT"/*

version=$(basename "$MIGRATION" | cut -c1-14)
previous=$(ls "$ROOT/supabase/migrations" | grep -E '^[0-9]{14}_' | cut -c1-14 | awk -v v="$version" '$1 < v' | sort | tail -1)

sql() { psql "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }
scalar() { sql -At -c "$1"; }

echo "== reset local database to $previous (the rewrite $version stays unapplied)"
(cd "$ROOT" && npx supabase db reset --local --no-seed --version "$previous" >"$OUT/reset.log" 2>&1)
if [ "$(scalar "select count(*) from pg_proc where proname = 'actor_cycles_with_role' and pronamespace = 'rush'::regnamespace")" != 0 ]; then
  echo "FAIL: the rewrite is already applied after reset" >&2; exit 1
fi

echo "== seed"
sql -f "$HERE/seed.sql" >"$OUT/seed.log"
sql -f "$HERE/capture.sql" >/dev/null

echo "== capture old"
sql -c "select harness.capture('old')" >/dev/null
echo "== apply $MIGRATION"
sql -f "$MIGRATION" >"$OUT/migration.log"
echo "== capture new"
sql -c "select harness.capture('new')" >/dev/null

identities=$(scalar "select count(*) from harness.identities")
tables=$(scalar "select count(*) from harness.tables")
rows_old=$(scalar "select count(*) from harness.visible where phase = 'old' and pk not like 'ERROR %'")
errors=$(scalar "select count(*) from harness.visible where pk like 'ERROR %'")
echo "identities=$identities tables=$tables comparisons=$((identities * tables)) visible_rows_old=$rows_old error_cells=$errors"
sql -c "select label, count(*) as tables_with_error, min(pk) as error from harness.visible where phase = 'old' and pk like 'ERROR %' group by label order by label"

diffs=$(scalar "select harness.diff_count('old', 'new')")
echo "old vs new differences: $diffs"
sql -c "select * from harness.diff('old', 'new') order by 1, 2, 3 limit 40"
if [ "$diffs" != 0 ]; then echo "FAIL: visibility changed" >&2; exit 1; fi

echo "== the identities see different things (the comparison has teeth)"
sql -c "select * from harness.discrimination() order by tbl" | tee "$OUT/discrimination.txt"
flat=$(scalar "select count(*) from harness.discrimination() where distinct_views < 3")
if [ "$flat" != 0 ]; then echo "FAIL: $flat table(s) look the same to nearly every identity" >&2; exit 1; fi

# Every break-*.sql weakens one new policy or helper on purpose; each must show
# a difference against "new", and re-applying the migration must restore "old".
for break_file in "$HERE"/break-*.sql; do
  name=$(basename "$break_file" .sql)
  echo "== deliberate $name: $(head -1 "$break_file" | sed 's/^-- *//')"
  sql -f "$break_file" >/dev/null
  sql -c "select harness.capture('$name')" >/dev/null
  broken=$(scalar "select harness.diff_count('new', '$name')")
  echo "new vs $name differences: $broken"
  sql -c "select * from harness.diff('new', '$name') order by 1, 2, 3 limit 12"
  sql -f "$MIGRATION" >/dev/null
  sql -c "select harness.capture('restored-$name')" >/dev/null
  restored=$(scalar "select harness.diff_count('old', 'restored-$name')")
  echo "old vs restored-$name differences: $restored"
  if [ "$broken" = 0 ] || [ "$restored" != 0 ]; then echo "FAIL: $name not detected or restore failed" >&2; exit 1; fi
done

echo "== EXPLAIN (ANALYZE, BUFFERS) old vs new, as board_open, 3 runs each"
# Each run is a fresh session, so the query executes once unmeasured first:
# PostgREST reuses pooled connections, whose SQL-function plans are already
# cached, and a cold first call would charge that parsing to the row work.
explain_phase() {
  local phase=$1
  while IFS='|' read -r name query; do
    for run in 1 2 3; do
      sql -At -f - >"$OUT/explain-$phase-$name-$run.txt" <<EOF
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"iss":"https://harness.invalid","sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
select count(*) as warm_up from ($query) q;
explain (analyze, buffers) $query;
rollback;
EOF
    done
    local times buffers
    times=$(grep -h "Execution Time" "$OUT"/explain-$phase-$name-*.txt | awk '{printf "%s ", $3}')
    buffers=$(for f in "$OUT"/explain-$phase-$name-*.txt; do grep -m1 "Buffers:" "$f" | sed 's/^ *//'; done | sort | uniq -c | sed 's/^ *//' | paste -sd ';')
    printf '%-8s %-26s ms: %-28s %s\n' "$phase" "$name" "$times" "$buffers"
  done <"$HERE/explain-queries.txt"
}
# "old" was already replaced; rebuild it from the catalog of the previous version.
(cd "$ROOT" && npx supabase db reset --local --no-seed --version "$previous" >>"$OUT/reset.log" 2>&1)
sql -f "$HERE/seed.sql" >/dev/null
explain_phase old | tee "$OUT/explain-summary.txt"
sql -f "$MIGRATION" >/dev/null
explain_phase new | tee -a "$OUT/explain-summary.txt"
echo "set-function builds in the new plan for applications_with_pnm (every ProjectSet is one actor set; expect loops=1 on each):"
grep -E "ProjectSet" "$OUT/explain-new-applications_with_pnm-1.txt" | grep -oE "loops=[0-9]+" | sort | uniq -c

echo "PASS: $((identities * tables)) identity x table comparisons, 0 differences; every deliberate break detected; artifacts in $OUT"
