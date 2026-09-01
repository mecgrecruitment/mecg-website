import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };

function request(body: unknown) {
  return new NextRequest("http://localhost/api/account/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

test("password change is rate limited before the signInWithPassword re-check", async (t) => {
  let verifyCalls = 0;
  const client = {
    auth: {
      signInWithPassword: async () => { verifyCalls += 1; return { error: null }; },
      updateUser: async () => ({ error: null }),
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => false } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("rate-limited");
  const response = await POST(request({ currentPassword: "old-password", newPassword: "new-password" }));
  assert.equal(response.status, 429);
  assert.equal(verifyCalls, 0);
});

test("password change proceeds when under the rate limit", async (t) => {
  let bucket = "";
  const client = {
    auth: {
      signInWithPassword: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
  };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async (b: string) => { bucket = b; return true; } } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("allowed");
  const response = await POST(request({ currentPassword: "old-password", newPassword: "new-password" }));
  assert.equal(response.status, 200);
  assert.equal(bucket, `account-password:${USER.id}`);
});
