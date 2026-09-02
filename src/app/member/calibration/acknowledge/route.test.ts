import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

function request(body: unknown) {
  return new NextRequest("http://localhost/member/calibration/acknowledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function route(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

test("calibration acknowledgement requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => { throw new Error("not called"); } } });
  const { POST } = await route("unauthorized");
  assert.equal((await POST(request({ roundId: "round-1", rubricId: "rubric-1" }))).status, 401);
});

test("calibration acknowledgement validates bounded identifiers", async (t) => {
  let calls = 0;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => { calls += 1; return { data: null, error: null }; } } });
  const { POST } = await route("validation");
  assert.equal((await POST(request({ roundId: "", rubricId: "rubric-1" }))).status, 400);
  assert.equal((await POST(request({ roundId: "r".repeat(201), rubricId: "rubric-1" }))).status, 400);
  assert.equal(calls, 0);
});

test("calibration acknowledgement delegates ownership and active-rubric checks to the RPC", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: {
    screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: "2026-09-02T20:00:00Z", error: null };
    },
  } });
  const { POST } = await route("success");
  const response = await POST(request({ roundId: "round-1", rubricId: "rubric-1" }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "acknowledge_round_calibration", args: {
    target_round_id: "round-1",
    target_rubric_id: "rubric-1",
  } }]);
});
