#!/usr/bin/env node
/**
 * Fail fast when required env vars are missing or obviously wrong.
 *
 * Modes:
 *   default     — require .env.local with non-empty values
 *   process/CI  — read from process.env (CHECK_ENV_MODE=process or CI=true)
 *
 * Keep required keys aligned with .env.example and requireEnv() call sites
 * in src/lib/supabase/{client,server,admin}.ts.
 *
 * Usage:
 *   npm run check:env
 *   CHECK_ENV_MODE=process npm run check:env
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

// Turnstile is optional as a pair: both set or both unset (see src/lib/turnstile.ts).
const turnstilePair = [
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

const mode =
  process.env.CHECK_ENV_MODE === "process" || process.env.CI === "true"
    ? "process"
    : "file";

/** @type {Map<string, string>} */
const values = new Map();

if (mode === "process") {
  for (const key of [...required, ...turnstilePair]) {
    const value = process.env[key]?.trim() ?? "";
    if (value) values.set(key, value);
  }
} else {
  if (!existsSync(envPath)) {
    console.error(
      "Missing .env.local. Copy .env.example → .env.local and fill from `supabase status`."
    );
    console.error("Use http://127.0.0.1 (not localhost) for URL + Site URL.");
    process.exit(1);
  }

  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).trim();
    if (value) values.set(key, value);
  }
}

const missing = required.filter((key) => !values.has(key));
if (missing.length) {
  console.error(
    `Missing required env vars${mode === "file" ? " in .env.local" : ""}: ${missing.join(", ")}`
  );
  console.error(
    "Local: copy .env.example → .env.local, then paste API URL / anon / service_role from `supabase status`."
  );
  process.exit(1);
}

// Brick risk: one Turnstile key without the other fails signup/apply closed.
const turnstilePresent = turnstilePair.filter((key) => values.has(key));
if (turnstilePresent.length === 1) {
  console.error(
    `Turnstile keys must be set together (both on or both off). Present: ${turnstilePresent[0]}; missing: ${turnstilePair.find((k) => !values.has(k))}.`
  );
  process.exit(1);
}

// Soft guard: service role must never be public.
if (values.has("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
  console.error(
    "Refuse NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY — service role must stay server-only as SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const siteUrl = values.get("NEXT_PUBLIC_SITE_URL") ?? "";
const supabaseUrl = values.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const mistakes = [];

if (/^https?:\/\/localhost\b/i.test(siteUrl)) {
  mistakes.push(
    `NEXT_PUBLIC_SITE_URL uses localhost (${siteUrl}). Use http://127.0.0.1:3000 so it matches supabase/config.toml allow-list.`
  );
}

if (/^https?:\/\/localhost\b/i.test(supabaseUrl)) {
  mistakes.push(
    `NEXT_PUBLIC_SUPABASE_URL uses localhost (${supabaseUrl}). Prefer http://127.0.0.1:54321.`
  );
}

if (mistakes.length) {
  console.error("Env check failed (loud, intentional):");
  for (const mistake of mistakes) console.error(`  - ${mistake}`);
  process.exit(1);
}

console.log(
  turnstilePresent.length === 2
    ? `Env check OK (${mode} mode; Turnstile pair configured).`
    : `Env check OK (${mode} mode; Turnstile unset — optional locally; enable both keys in production).`
);
