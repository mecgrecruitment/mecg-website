#!/usr/bin/env bash

set -uo pipefail

run_once=false
if [[ "${1:-}" == "--once" ]]; then
  run_once=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--once]" >&2
  exit 2
fi

audit_interval_seconds="${AUDIT_INTERVAL_SECONDS:-30}"
if ! [[ "$audit_interval_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "AUDIT_INTERVAL_SECONDS must be a positive integer." >&2
  exit 2
fi

run_audit() {
  local started_at
  started_at="$(date '+%Y-%m-%d %H:%M:%S')"

  echo "[$started_at] Starting project audit"

  if ! npm run lint; then
    echo "Audit failed: lint" >&2
    return 1
  fi

  if ! npm run typecheck; then
    echo "Audit failed: typecheck" >&2
    return 1
  fi

  if ! npm run build; then
    echo "Audit failed: build" >&2
    return 1
  fi

  echo "Audit passed: lint, typecheck, and build"
}

while true; do
  run_audit
  audit_status=$?

  if [[ "$run_once" == true ]]; then
    exit "$audit_status"
  fi

  echo "Waiting ${audit_interval_seconds}s before the next audit. Press Ctrl-C to stop."
  sleep "$audit_interval_seconds"
done
