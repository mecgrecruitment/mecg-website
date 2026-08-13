#!/usr/bin/env bash

set -euo pipefail

status=0

report_files() {
  local heading="$1"
  local matches="$2"

  if [[ -n "$matches" ]]; then
    echo "Sensitive-information audit failed: $heading" >&2
    printf '%s\n' "$matches" | sed 's/^/  - /' >&2
    status=1
  fi
}

secret_files="$(
  rg -Il --hidden \
    --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' \
    --glob '!playwright-report/**' --glob '!test-results/**' \
    --glob '!supabase/.temp/**' --glob '!.env*' \
    --glob '!scripts/audit-sensitive.sh' \
    '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk_(live|test)_[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})' \
    . || true
)"
report_files "credential-like material is tracked" "$secret_files"

public_personal_emails="$(
  rg -I -o --no-filename '[A-Za-z0-9._%+-]+@umich\.edu' \
    'app/(external)' 'src/components/site' 'src/lib/site-content.ts' \
    'src/lib/team-members.json' 'public' 2>/dev/null \
    | sort -u \
    | grep -Fvx -e 'mecg-board@umich.edu' -e 'you@umich.edu' || true
)"
report_files "individual email addresses are present in public-facing content" "$public_personal_emails"

real_looking_umich_emails="$(
  rg -I -o --no-filename '[A-Za-z0-9._%+-]+@umich\.edu' \
    --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' \
    --glob '!playwright-report/**' --glob '!test-results/**' \
    --glob '!supabase/.temp/**' --glob '!.env*' . \
    | sort -u \
    | grep -Ev '^((mecg-board|you|replace-me(-2)?|not\.invited|manual-check|pending-test|[A-Za-z0-9._%+-]+\.(test|candidate))@umich\.edu|%@umich\.edu)$' \
    || true
)"
report_files "real-looking individual UMich email addresses are tracked" "$real_looking_umich_emails"

public_hash_files="$(
  rg -Il '(App Hash|Group Hash)' \
    'app/(external)' 'src/components/site' 'src/lib/site-content.ts' || true
)"
report_files "private hash-session details are present in public-facing content" "$public_hash_files"

archived_team_files="$(find data/public -maxdepth 1 -type f -iname '*team*' -print 2>/dev/null || true)"
report_files "raw team scrape artifacts are tracked" "$archived_team_files"

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

echo "Sensitive-information audit passed"
