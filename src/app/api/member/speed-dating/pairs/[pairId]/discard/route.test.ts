import test from "node:test";
import assert from "node:assert/strict";

const USER = { id: "member-1", email: "member@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function context(pairId = "pair-1") {
  return { params: Promise.resolve({ pairId }) };
}

test("group discard requires authentication", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("database should not be called"); } },
  });
  const { POST } = await importRoute("unauthorized");
  const response = await POST(new Request("http://localhost", { method: "POST" }), context());
  assert.equal(response.status, 401);
});

test("group discard passes only the route pair id to the guarded RPC", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> | undefined }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: {
      screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { pairId: "pair-1", discarded: true }, error: null };
      },
    },
  });
  const { POST } = await importRoute("success");
  const response = await POST(new Request("http://localhost", { method: "POST" }), context());
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "discard_speed_dating_group", args: { target_pair_id: "pair-1" } }]);
});

test("group discard maps a submitted-group conflict without exposing database details", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => ({ data: null, error: { code: "55000", message: "private database detail" } }) },
  });
  const { POST } = await importRoute("submitted");
  const response = await POST(new Request("http://localhost", { method: "POST" }), context());
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "This group cannot be discarded" });
});
