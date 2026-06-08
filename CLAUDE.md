# CLAUDE.md

<!-- Last generated: 2026-06-08 -->
<!-- Global rules in ~/.claude/CLAUDE.md apply automatically. Do not duplicate them here. -->

## Project

**Name:** mecg-website
**Stack:** TypeScript · Next.js (App Router) · npm
**Architecture:** Marketing/content website for MECG. Greenfield — app code not yet scaffolded.
**Deployment:** [manual — likely Vercel; confirm]
**Status:** greenfield

---

## Stack — never suggest alternatives unless asked

**Language:** TypeScript (strict mode)
**Runtime:** Node.js
**Framework:** Next.js — App Router
**Package manager:** npm
**Database:** none yet
**Styling:** [inferred: unknown — update manually once chosen]
**Testing:** [inferred: unknown — update manually]
**Linting:** ESLint (Next.js default config)
**CI:** none yet

---

## Code Standards

**Commits:** conventional commits — feat/fix/chore/docs/refactor/test
**Branches:** never commit directly to `main` — branch first
**PR size:** keep under 400 lines where possible — split larger work
**Types:** no `any` — use `unknown` and narrow
**Errors:** never swallow silently — handle or rethrow

---

## File & Folder Conventions

```
app/          # Next.js App Router routes, layouts, pages
components/    # Reusable React components
lib/          # Shared utilities and helpers
public/       # Static assets
```

> Structure above is the intended convention — create directories as the app grows.

**Naming:** files kebab-case, components PascalCase, functions camelCase, constants SCREAMING_SNAKE_CASE

---

## Permanent Rules — apply without exception

- Use the App Router (`app/`), not the legacy Pages Router
- Server Components by default; add `"use client"` only when a component needs interactivity
- Environment variables read via `process.env`; never commit `.env*` files (only `.env.example`)
- No hardcoded secrets or API keys in committed code
- Keep `public/` for static assets only — no source code there

If any task conflicts with these, flag it before proceeding.

---

## Deployment & Environments

**Local setup:** `npm install` then `npm run dev`
**Test command:** [manual — not configured yet]
**Build command:** `npm run build`
**Lint command:** `npm run lint`

---

## Current Sprint

> **Update every Monday.**

**Sprint goal:** [manual]
**My current focus:** [manual]
**Active tasks:** [manual]
**Blocked on:** [manual]

---

## What I Am and What I Know

**Role:** [manual: founder / engineer / designer]
**Strong in:** [manual]
**Still learning:** [manual]
