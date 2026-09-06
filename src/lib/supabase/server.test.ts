import test from "node:test";
import assert from "node:assert/strict";

// createClient() is the only Clerk chokepoint that used to call auth()
// unconditionally. Without Clerk configured, proxy() runs
// handleUnconfiguredProxy, clerkMiddleware never runs, and auth() throws
// "Clerk can't detect usage of clerkMiddleware()", which surfaced as a 500 on
// every session-reading route. resolveCurrentIdentity() already guarded this.
test("createClient skips auth() when Clerk is unconfigured", async (t) => {
  let authCalls = 0;
  t.mock.module("@clerk/nextjs/server", {
    namedExports: {
      auth: async () => {
        authCalls += 1;
        return { userId: null, getToken: async () => null };
      },
    },
  });

  const previous = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MECG_SUPABASE_URL: process.env.NEXT_PUBLIC_MECG_SUPABASE_URL,
    NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  };
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  delete process.env.NEXT_PUBLIC_MECG_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";

  // Assigned first so the specifier is not a literal type: a literal would be
  // resolved as a real module path and fail the build's type check.
  const serverModule = "./server.ts?case=unconfigured-clerk";
  const { createClient } = await import(serverModule) as typeof import("./server.ts");

  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";
  delete process.env.CLERK_SECRET_KEY;
  assert.ok(await createClient());
  assert.equal(authCalls, 0, "an unconfigured Clerk must not reach auth()");

  process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
  assert.ok(await createClient());
  assert.equal(authCalls, 1, "a configured Clerk must still read the session");
});
