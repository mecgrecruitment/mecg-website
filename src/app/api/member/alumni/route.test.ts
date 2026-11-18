import test from "node:test";
import assert from "node:assert/strict";
const member = { id: "00000000-0000-4000-8000-000000000001", active: true, memberships: [{ cycleId: "test", role: "MEMBER", active: true }] };
async function route(name: string): Promise<typeof import("./route")> { return import(`./route.ts?${name}`); }
const listing = { gradTerm: "Winter 2027", major: "IOE", employer: "Ford", jobTitle: "", location: "", linkedinUrl: "https://www.linkedin.com/in/morgan", contactEmail: "", note: "" };
function request(payload: unknown) { return new Request("https://example.com/api/member/alumni", { method: "POST", body: JSON.stringify(payload) }); }
function unreachable() { return { namedExports: { createClient: async () => { throw new Error("Persistence must not be reached"); } } }; }

test("signed-out callers cannot reach persistence", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("signedout");
  assert.equal((await POST(request({ revision: 0, listing }))).status, 401);
});

test("panel-only and ended memberships cannot add a listing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ ...member, memberships: [{ cycleId: "test", role: "PANEL", active: true }, { cycleId: "old", role: "MEMBER", active: false }] }) } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("panel");
  assert.equal((await POST(request({ revision: 0, listing }))).status, 403);
});

test("invalid payloads are refused before the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", unreachable());
  const { POST } = await route("invalid");
  for (const payload of [
    { revision: -1, listing },
    { revision: 1.5, listing },
    { revision: 2_147_483_648, listing },
    { revision: "1", listing },
    { revision: 0, listing: { ...listing, linkedinUrl: "https://example.com/x" } },
    { revision: 0, listing: { ...listing, contactEmail: "nope" } },
    { revision: 0, listing: { ...listing, phone: "555" } },
    { revision: 0, listing, id: "x" },
    [{ revision: 0, listing }],
  ]) assert.equal((await POST(request(payload))).status, 400, JSON.stringify(payload));
});

test("a save calls the RPC with the trimmed form", async (t) => {
  const calls: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, ...args }); return { data: { id: "x" }, error: null }; } }) } });
  const { POST } = await route("save");
  const response = await POST(request({ revision: 0, listing: { ...listing, employer: "  Ford  " } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await POST(request({ revision: 4, listing }));
  assert.deepEqual(calls, [
    { name: "save_alumni_listing", expected_revision: 0, payload: listing },
    { name: "save_alumni_listing", expected_revision: 4, payload: listing },
  ]);
});

test("a stale save keeps its meaning", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => member } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: { code: "55000", message: "Your listing changed since you opened it. Reload before saving." } }) }) } });
  const { POST } = await route("stale");
  const response = await POST(request({ revision: 2, listing }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Reload/);
});
