# <Project> — CLAUDE.md

Thin, high-authority context (< ~60 lines). Detail lives in `.claude/rules/*` (glob-scoped)
and skills — not here. Every line in this file costs context on every turn.

## What this is
<one line: what it does + the critical invariant / money-path>

## Commands
- build: `<cmd>`
- test:  `<cmd>`
- run:   `<cmd>`

## Orchestrator ↔ runner  (claudeo)
- You (Opus) orchestrate: plan, decompose, review, decide. Delegate implementation to the
  **`runner`** subagent (gpt-5.6-sol), broad search to **`researcher`**, and verification of a
  finished change to **`reviewer`** (independent family — an honest second opinion on your intent).
- Keep your own context lean — dispatch work and integrate results; don't grind edits
  yourself when a runner can.
- **Delegate above a threshold:** any implementation spanning more than a single small hunk —
  multi-file, multi-step, or repetitive — goes to `runner`. Only trivial one-hunk edits stay with
  you. This is what makes the Opus→GPT split pay: offloading real execution volume, not tiny edits.
- **Delegation contract** — the runner is a different model family and won't infer what you meant.
  Every dispatch spells out: (1) the exact files/paths to touch, (2) a concrete acceptance check
  (a command to run or an observable outcome), and (3) a style anchor (an existing file/function
  to match). Then have `reviewer` confirm the acceptance check independently before you call it done.

## Boundaries
- Hard rules are deterministic — see `.claude/hooks/` (a PreToolUse guard blocks destructive
  Bash). Don't restate them as prose here.
- <domain invariant, e.g. "money is integer minor units — never float">

## Conventions
- Match surrounding code. Context-specific rules auto-load from `.claude/rules/` when you
  touch a matching file.
