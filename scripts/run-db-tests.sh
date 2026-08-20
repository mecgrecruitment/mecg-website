#!/usr/bin/env bash
# Run every SQL smoke file under supabase/tests/ against the LOCAL stack.
# Requires: Docker running + local DB (`supabase db start` or full `supabase start`).
# Seeded data required (db start applies migrations+seed; else `npm run db:reset`).
#
# These files use psql meta-commands (`\set ON_ERROR_STOP on`), so we must run
# them with real psql inside the DB container — `supabase db query` rejects `\…`.
#
# Usage:
#   npm run db:test
#   bash scripts/run-db-tests.sh                 # all files
#   bash scripts/run-db-tests.sh rls_phase0.sql  # one file

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Start OrbStack/Docker Desktop, then: supabase db start" >&2
  exit 2
fi

# Only the DB container is required (full `supabase start` is optional for SQL smokes).
# Do not gate on `supabase status` — that fails when Auth/Kong are down but Postgres is up.
db_container="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)"
if [[ -z "$db_container" ]]; then
  echo "No running supabase_db_* container." >&2
  echo "Start the local DB: supabase db start   (or: supabase start)" >&2
  echo "Then re-seed if needed: npm run db:reset" >&2
  exit 1
fi

tests_dir="$root/supabase/tests"
if [[ $# -gt 0 ]]; then
  files=()
  for name in "$@"; do
    if [[ -f "$name" ]]; then
      files+=("$name")
    elif [[ -f "$tests_dir/$name" ]]; then
      files+=("$tests_dir/$name")
    else
      echo "Unknown test file: $name" >&2
      exit 2
    fi
  done
else
  # Stable order so failures are reproducible (bash 3–safe; no mapfile).
  files=()
  while IFS= read -r line; do
    files+=("$line")
  done < <(find "$tests_dir" -maxdepth 1 -type f -name '*.sql' | sort)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No SQL tests found under supabase/tests/" >&2
  exit 2
fi

run_psql_file() {
  local file="$1"
  # Copy into the container so -f works with ON_ERROR_STOP / begin/rollback.
  # stdin pipe also works; -f keeps line numbers useful on failure.
  local remote="/tmp/mecg-db-test.sql"
  docker cp "$file" "$db_container:$remote" >/dev/null
  docker exec -i "$db_container" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$remote"
}

failed=0
for file in "${files[@]}"; do
  rel="${file#"$root/"}"
  echo "==> $rel"
  if ! run_psql_file "$file"; then
    echo "FAIL: $rel" >&2
    failed=1
  else
    echo "PASS: $rel"
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "One or more DB smoke tests failed." >&2
  echo "If seed data is missing, run: npm run db:reset" >&2
  exit 1
fi

echo "All DB smoke tests passed (${#files[@]} files)."
