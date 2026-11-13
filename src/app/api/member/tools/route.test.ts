import test from "node:test";
import assert from "node:assert/strict";
const user = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "test", role: "MEMBER", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const input = { action: "save", cycleId: "test", kind: "pipeline", id: "10000000-0000-4000-8000-000000000001", revision: 0, content: { title: "Synthetic", track: "Client", stage: "Research", problem: "Test", source: "https://example.com", nextAction: "Verify" } };
function request(payload: unknown) { return new Request("https://example.com/api/member/tools", { method: "POST", body: JSON.stringify(payload) }); }
test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } });
  const { POST } = await route("signedout");
  assert.equal((await POST(request(input))).status, 401);
});
test("non-member cycle cannot be selected to access records", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } });
  const { POST } = await route("wrongcycle");
  assert.equal((await POST(request({ ...input, cycleId: "other" }))).status, 403);
});
test("valid saves carry actor-independent content and stable ID to RPC", async (t) => {
  const calls: unknown[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: {}, error: null }; } }) } });
  const { POST } = await route("save");
  assert.equal((await POST(request(input))).status, 200);
  assert.equal(calls.length, 1);
  assert.equal((await POST(request({ ...input, content: { ...input.content, owner_id: "someone-else" } }))).status, 400);
  assert.equal(calls.length, 1);
});
test("database stale-write rejection becomes a conflict, not a success", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: { code: "55000", message: "Record changed. Reload before saving." } }) }) } });
  const { POST } = await route("conflict");
  assert.equal((await POST(request(input))).status, 409);
});
