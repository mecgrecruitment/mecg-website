import test from "node:test";
import assert from "node:assert/strict";
const alum = { id: "00000000-0000-4000-8000-000000000007", active: true, memberships: [{ cycleId: "old", role: "MEMBER", active: false }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
function request(payload: unknown) { return new Request("https://example.com/api/member/alumni/remove", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }
function recording(calls: Record<string, unknown>[], data: unknown = true) {
  return { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data, error: null }; } }) } };
}

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request({ id: null }))).status, 401);
});

test("someone whose membership ended can still opt out", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => alum } });
  t.mock.module("@/lib/supabase/server", recording(calls));
  const { POST } = await route("alum");
  const response = await POST(request({ id: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, removed: true });
  assert.deepEqual(calls, [{ name: "remove_alumni_listing", target_id: null }]);
});

test("removing by id passes the id, and nothing to remove is not an error", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => alum } });
  t.mock.module("@/lib/supabase/server", recording(calls, false));
  const { POST } = await route("byid");
  const response = await POST(request({ id: "00000000-0000-4000-8000-0000000000aa" }));
  assert.deepEqual(await response.json(), { ok: true, removed: false });
  assert.deepEqual(calls, [{ name: "remove_alumni_listing", target_id: "00000000-0000-4000-8000-0000000000aa" }]);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => alum } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [{}, { id: "nope" }, { id: 1 }, { id: null, extra: true }, [null]]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("someone else's listing reads as not found", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => alum } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: { code: "P0002", message: "Listing not found" } }) }) } });
  const { POST } = await route("missing");
  assert.equal((await POST(request({ id: "00000000-0000-4000-8000-0000000000aa" }))).status, 404);
});
