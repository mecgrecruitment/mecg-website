import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function mockDeps(t: test.TestContext) {
  t.mock.module("@/lib/rate-limit", {
    namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7", emailBucket: (prefix: string, email: string) => `${prefix}:${email}` },
  });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
}

test("POST /api/auth/forgot-password rejects payloads over the 2 KiB cap before parsing", async (t) => {
  mockDeps(t);
  const { POST } = await importRoute("413");
  const request = postRequest({ email: "a@umich.edu" }, { "content-length": String(2 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID_EMAIL");
});
