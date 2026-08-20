#!/usr/bin/env bash
# Signed-out auth redirect smoke for protected prefixes.
# Does NOT log in (that needs a live seeded Supabase + browser). For role logins
# see: npm run seed:users
#
# Usage:
#   npm run test:role-smoke
#   BASE_URL=http://127.0.0.1:3000 npm run test:role-smoke

set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:3000}"
base_url="${base_url%/}"

# Keep in sync with PROTECTED_PREFIXES in src/lib/supabase/middleware.ts
protected_paths=(
  /internal
  /internal/members
  /apply/dashboard
  /apply/application
  /apply/checkin
)

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for role-smoke" >&2
  exit 2
fi

echo "Role-smoke (signed-out redirects) against $base_url"

failed=0
for path in "${protected_paths[@]}"; do
  # Follow nothing; we want the first hop.
  headers="$(curl -sS -D - -o /dev/null "$base_url$path" || true)"
  status="$(printf '%s' "$headers" | head -n 1 | awk '{print $2}')"
  location="$(printf '%s' "$headers" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r')"

  if [[ "$status" != "307" && "$status" != "302" && "$status" != "303" ]]; then
    echo "FAIL $path — expected redirect, got HTTP $status" >&2
    failed=1
    continue
  fi

  if [[ "$location" != *"/auth/login"* ]]; then
    echo "FAIL $path — Location missing /auth/login (got: $location)" >&2
    failed=1
    continue
  fi

  if [[ "$location" != *"next="* ]]; then
    echo "FAIL $path — Location missing next= (got: $location)" >&2
    failed=1
    continue
  fi

  echo "PASS $path → $location"
done

if [[ "$failed" -ne 0 ]]; then
  echo "role-smoke failed. Is the app up? Try: npm run dev" >&2
  echo "Tip: use 127.0.0.1, not localhost (NEXT_PUBLIC_SITE_URL / allow-list)." >&2
  exit 1
fi

echo "Signed-out redirect smoke passed."
echo "For board/committee/member UI checks, run npm run seed:users and log in manually."
