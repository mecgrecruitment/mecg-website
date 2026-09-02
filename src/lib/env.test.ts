import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  hasClerkConfiguration,
  hasClerkFrontendConfiguration,
  hasClerkRuntimeConfiguration,
  requireSupabaseServiceRoleKey,
} from "./env.ts";

const names = [
  "NEXT_PUBLIC_MECG_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MECG_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("Supabase env prefers trimmed nonblank MECG values and falls back", () => {
  process.env.NEXT_PUBLIC_MECG_SUPABASE_URL = "   ";
  process.env.NEXT_PUBLIC_SUPABASE_URL = " https://fallback.supabase.co ";
  process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY = " mecg-anon ";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fallback-anon";
  process.env.MECG_SUPABASE_SERVICE_ROLE_KEY = " ";
  process.env.SUPABASE_SERVICE_ROLE_KEY = " fallback-service ";

  assert.deepEqual(getSupabasePublicEnv(), {
    url: "https://fallback.supabase.co",
    anonKey: "mecg-anon",
  });
  assert.equal(getSupabaseServiceRoleKey(), "fallback-service");

  process.env.NEXT_PUBLIC_MECG_SUPABASE_URL = " https://mecg.supabase.co ";
  process.env.MECG_SUPABASE_SERVICE_ROLE_KEY = " mecg-service ";

  assert.equal(getSupabasePublicEnv().url, "https://mecg.supabase.co");
  assert.equal(getSupabaseServiceRoleKey(), "mecg-service");
});

test("required public and admin configuration throws when blank", () => {
  for (const name of names) process.env[name] = "  ";

  assert.throws(getSupabasePublicEnv, /NEXT_PUBLIC_MECG_SUPABASE_URL/);
  assert.equal(getSupabaseServiceRoleKey(), undefined);
  assert.throws(requireSupabaseServiceRoleKey, /MECG_SUPABASE_SERVICE_ROLE_KEY/);
});

test("Clerk runtime configuration requires keys and the trusted issuer", () => {
  const complete = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " pk_test_example ",
    CLERK_SECRET_KEY: " sk_test_example ",
    CLERK_ISSUER: " https://example.clerk.accounts.dev ",
  };

  assert.equal(hasClerkConfiguration(complete), true);
  assert.equal(hasClerkFrontendConfiguration(complete), true);
  assert.equal(hasClerkRuntimeConfiguration(complete), true);
  assert.equal(hasClerkFrontendConfiguration({ ...complete, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " " }), false);
  assert.equal(hasClerkRuntimeConfiguration({ ...complete, CLERK_ISSUER: " " }), false);
  assert.equal(hasClerkRuntimeConfiguration({ ...complete, CLERK_SECRET_KEY: undefined }), false);
});
