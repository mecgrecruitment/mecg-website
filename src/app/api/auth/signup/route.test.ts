import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function mockDeps(t: test.TestContext) {
  t.mock.module("@/lib/auth", {
    namedExports: { destinationForUser: async () => { throw new Error("destinationForUser should not be called"); } },
  });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
}

test("POST /api/auth/signup rejects payloads over the 4 KiB cap before parsing", async (t) => {
  mockDeps(t);
  const { POST } = await importRoute("413");
  const request = postRequest({ name: "Ada", email: "a@umich.edu", password: "password1" }, { "content-length": String(4 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID_PASSWORD");
});
