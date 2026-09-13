import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/member/speed-dating/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("group start requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("unauthorized");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1", "app-2"] }));
  assert.equal(response.status, 401);
});

test("group start validates the applicant list before opening a database client", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("invalid");
  for (const body of [
    { roundId: "round-1", applicationIds: [], table: 4 },
    { roundId: "round-1", applicationIds: ["app-1", "app-2", "app-3", "app-4"], table: 4 },
    { roundId: "round-1", applicationIds: ["app-1", "app-1"], table: 4 },
    { roundId: "round-1", applicationIds: ["app-1", "app-2"], session: 5, table: 4 },
    { roundId: "round-1", applicationIds: ["app-1", "app-2"] },
    { roundId: "round-1", applicationIds: ["app-1", "app-2"], table: 0 },
    { roundId: "round-1", applicationIds: ["app-1", "app-2"], table: 100 },
    { roundId: "round-1", applicationIds: ["app-1", "app-2"], table: "4" },
    { applicationIds: ["app-1", "app-2"], table: 4 },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("group start passes the round, applicants, session, and table to the guarded RPC", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: {
      screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { pairId: "pair-1", label: "Group 01" }, error: null };
      },
    },
  });
  const { POST } = await importRoute("success");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1"], session: 2, table: 7 }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { pairId: "pair-1", label: "Group 01" });
  assert.deepEqual(calls, [{
    name: "start_speed_dating_group",
    args: { target_round_id: "round-1", target_application_ids: ["app-1"], target_session: 2, target_table: 7 },
  }]);
});

test("group start surfaces the database's own message for an already scored applicant", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => ({ data: null, error: { code: "55000", message: "you already scored Sam Lee" } }) },
  });
  const { POST } = await importRoute("scored");
  const response = await POST(request({ roundId: "round-1", applicationIds: ["app-1", "app-2"], table: 4 }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "you already scored Sam Lee" });
});
