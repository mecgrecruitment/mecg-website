import test from "node:test";
import assert from "node:assert/strict";

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

test("wrong-pair report preserves drafts and delegates only the claimed pair id", async (t) => {
  const calls: unknown[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async (_client: unknown, name: string, args: unknown) => {
    calls.push({ name, args });
    return { data: { pairId: "pair-1", reported: true }, error: null };
  } } });
  const { POST } = await importRoute("success");
  const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ pairId: "pair-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "report_wrong_speed_dating_pair", args: { target_pair_id: "pair-1" } }]);
});
