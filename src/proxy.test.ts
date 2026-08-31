import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";

async function importProxy(testCase: string) {
  return import(`./proxy.ts?case=${testCase}`) as Promise<typeof import("./proxy.ts")>;
}

function request(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`);
}

function mockSession(t: test.TestContext, user: object | null = null) {
  let refreshes = 0;
  t.mock.module("@/lib/supabase/proxy", {
    namedExports: {
      refreshSupabaseSession: async () => {
        refreshes += 1;
        return { response: NextResponse.next(), user };
      },
    },
  });
  return () => refreshes;
}

test("proxy skips Supabase Auth for exempt routes", async (t) => {
  const refreshes = mockSession(t);
  const { proxy } = await importProxy("exempt");

  for (const pathname of ["/login", "/admin/login", "/apply", "/auth/callback", "/api/auth/callback", "/api/admin/login"]) {
    const response = await proxy(request(pathname));
    assert.equal(response.headers.get("x-middleware-next"), "1", pathname);
  }
  assert.equal(refreshes(), 0);
});

test("proxy refreshes protected pages and redirects anonymous users", async (t) => {
  const refreshes = mockSession(t);
  const { proxy } = await importProxy("protected-page");
  const response = await proxy(request("/admin"));

  assert.equal(refreshes(), 1);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/login");
});

test("proxy refreshes protected APIs and returns 401 for anonymous users", async (t) => {
  const refreshes = mockSession(t);
  const { proxy } = await importProxy("protected-api");
  const response = await proxy(request("/api/member/profile"));

  assert.equal(refreshes(), 1);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("proxy preserves the refreshed response for authenticated users", async (t) => {
  const refreshes = mockSession(t, { id: "member" });
  const { proxy } = await importProxy("authenticated");
  const response = await proxy(request("/member"));

  assert.equal(refreshes(), 1);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("proxy fails closed when protected-route session refresh fails", async (t) => {
  t.mock.module("@/lib/supabase/proxy", {
    namedExports: {
      refreshSupabaseSession: async () => { throw new Error("Missing Supabase configuration"); },
    },
  });
  const { proxy } = await importProxy("missing-config");

  await assert.rejects(proxy(request("/admin")), /Missing Supabase configuration/);
});
