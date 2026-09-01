import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options.ts";

function importProxy(testCase: string) {
  return import(`./proxy.ts?case=${testCase}`) as Promise<typeof import("./proxy.ts")>;
}

test("session cookie options are httpOnly", () => {
  // Regression for the HIGH finding: the auth cookie (access + refresh token)
  // must not be readable from JS. This only stays safe as long as nothing in
  // the browser needs to read it back out -- see supabase/client.ts, which as
  // of the resume-upload fix has zero production callers.
  assert.equal(SESSION_COOKIE_OPTIONS.httpOnly, true);
});

test("refreshSupabaseSession wires cookieOptions into createServerClient", async (t) => {
  const captured: { options: { cookieOptions?: unknown } | null } = { options: null };
  t.mock.module("@supabase/ssr", {
    namedExports: {
      createServerClient: (_url: string, _key: string, options: { cookieOptions?: unknown }) => {
        captured.options = options;
        return { auth: { getUser: async () => ({ data: { user: null } }) } };
      },
    },
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  const { refreshSupabaseSession } = await importProxy("cookie-options-wiring");
  await refreshSupabaseSession(new NextRequest("http://localhost/admin"));
  assert.deepEqual(captured.options?.cookieOptions, SESSION_COOKIE_OPTIONS);
});
