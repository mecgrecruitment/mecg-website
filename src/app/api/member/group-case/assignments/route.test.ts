import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };
const RESULT = { assignmentIds: ["assignment-1", "assignment-2"], created: 2, skippedConflicts: 0 };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/member/group-case/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("self-assignment requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("unauthorized");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1"] }));
  assert.equal(response.status, 401);
});

test("self-assignment validates the body before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("invalid");
  for (const body of [
    { roundId: "round-1", applicationIds: [] },
    { roundId: "round-1", applicationIds: "app-1" },
    { roundId: "round-1", applicationIds: [""] },
    { roundId: "round-1", applicationIds: [7] },
    { roundId: "round-1", applicationIds: ["x".repeat(201)] },
    { roundId: "round-1", applicationIds: Array.from({ length: 51 }, (_, index) => `app-${index}`) },
    { roundId: "", applicationIds: ["app-1"] },
    { applicationIds: ["app-1"] },
    ["app-1"],
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("self-assignment passes the round and applicants to the guarded RPC", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: {
      screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: RESULT, error: null };
      },
    },
  });
  const { POST } = await importRoute("success");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1", "app-2"] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), RESULT);
  assert.deepEqual(calls, [{
    name: "open_group_case_assignments",
    args: { target_round_id: "round-1", target_application_ids: ["app-1", "app-2"] },
  }]);
});

test("self-assignment surfaces the database's own message when the round is not open", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => ({ data: null, error: { code: "55000", message: "round is not open for grading" } }) },
  });
  const { POST } = await importRoute("closed");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1"] }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "round is not open for grading" });
});
