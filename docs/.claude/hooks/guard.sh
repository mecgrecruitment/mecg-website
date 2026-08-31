#!/usr/bin/env bash
# claudex PreToolUse guard — deterministic block for catastrophic / secret-exposing ops.
# Registered for TWO matchers (see settings.json):
#   Bash                         -> block a few unrecoverable commands (rm -rf /, mkfs, dd, fork bomb)
#   Write|Edit|MultiEdit|Notebook -> block writes to secret-bearing files (.env, ssh keys, creds)
# Input: hook JSON on stdin.  exit 2 = block + message to the model.  exit 0 = allow.
# This is a guardrail, not a linter: it only stops a few unrecoverable or secret-exposing ops.
# It evaluates each Bash simple-command SEGMENT (split on ; | & and newlines) independently,
# so a stray token in one command can't combine with a dangerous verb in another. Keep it
# conservative so it never fires on normal work; tune the patterns to taste.
input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)"

block() { printf 'claudex guard: blocked — %s. If you truly intend this, do it yourself.\n' "$1" >&2; exit 2; }

# ---------------------------------------------------------------------------
# Write / Edit / MultiEdit / NotebookEdit: block writes to secret-bearing files.
# Rationale: an errant edit can leak or clobber credentials the model should never touch.
# ---------------------------------------------------------------------------
case "$tool" in
  Write|Edit|MultiEdit|NotebookEdit)
    path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)"
    [[ -z "$path" ]] && exit 0
    base="$(basename "$path")"
    # Allow obvious non-secret example/template variants (never hold real secrets).
    case "$base" in
      *.example|*.sample|*.template|*.dist) exit 0 ;;
    esac
    # High-signal secret filename / path patterns.
    if printf '%s' "$path" | grep -Eq \
      '(^|/)\.env($|\.)|\.env$|(^|/)\.ssh/|(^|/)id_(rsa|dsa|ecdsa|ed25519)($|\.)|\.pem$|\.p12$|\.pfx$|(^|/)\.aws/credentials$|(^|/)\.netrc$|(^|/)\.kube/config$|(^|/)\.docker/config\.json$|cliproxyapi\.conf$'; then
      block "write to a secret-bearing file ($base)"
    fi
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Bash: block a few unrecoverable commands.
# ---------------------------------------------------------------------------
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[[ -z "$cmd" ]] && exit 0

# Whole-command patterns (these legitimately contain ; | & so must not be segment-split).
printf '%s' "$cmd" | grep -Eq ':[[:space:]]*\([[:space:]]*\)[[:space:]]*\{[[:space:]]*:[^}]*\}[[:space:]]*;[[:space:]]*:' && block "fork bomb"

# Per-segment patterns.
while IFS= read -r seg; do
  [[ -z "$seg" ]] && continue
  # 1) recursive+forceful rm aimed at a root/home path ( / , /* , ~ , $HOME ) IN THE SAME command
  if printf '%s' "$seg" | grep -Eiq '(^|[[:space:]])rm([[:space:]]+-[[:alnum:]-]+)*[[:space:]]+-[[:alnum:]]*([rR][[:alnum:]]*[fF]|[fF][[:alnum:]]*[rR])' \
     && printf '%s' "$seg" | grep -Eq '(^|[[:space:]])(/|~|/\*|\$\{?HOME\}?)([[:space:]]|/?\*?$)'; then
    block "recursive rm targeting a root or home path"
  fi
  # 2) formatting a filesystem / writing a raw disk device
  printf '%s' "$seg" | grep -Eiq '(^|[[:space:]])mkfs([[:space:]]|\.)'                        && block "mkfs (filesystem format)"
  printf '%s' "$seg" | grep -Eiq '(^|[[:space:]])dd([[:space:]]+[^;&|]*)?[[:space:]]of=/dev/'  && block "dd writing to a device"
  printf '%s' "$seg" | grep -Eq  '>[[:space:]]*/dev/(sd|nvme|disk|hd)[a-z0-9]*'               && block "redirect to a raw disk device"
done < <(printf '%s\n' "$cmd" | tr ';|&' '\n\n\n')

exit 0
