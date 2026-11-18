import test from "node:test";
import assert from "node:assert/strict";

const owner = { id: "owner-1", memberships: [{ cycleId: "c1", role: "OWNER", active: true }] };
const board = { id: "board-1", memberships: [{ cycleId: "c1", role: "BOARD", active: true }, { cycleId: "c2", role: "OWNER", active: true }] };
const exported = {
  format: "mecg-cycle-records/1", exportedAt: "2026-11-18T12:00:00Z", cycle: { id: "c1", name: "Fall 2026", status: "CLOSED" }, fullContentTools: [],
  memberToolRecords: [{ id: "r1", kind: "pipeline", ownerId: "u1", ownerName: "Ada", revision: 1, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", verification: "Pending", sharing: "Restricted", contentWithheld: true, content: null, review: null }],
  reviewerGrants: [], projects: [{ id: "p1", slug: "acme", title: "Acme", client_label: "", is_public: false }], projectMembers: [],
};

function mock(t: import("node:test").TestContext, user: unknown, rpc: (name: string, args: unknown) => unknown) {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => rpc(name, args) }) } });
}
const load = (name: string) => import(`./route.ts?case=${name}`) as Promise<typeof import("./route.ts")>;

test("refuses a board member, or an Owner of another cycle, before calling the database", async (t) => {
  mock(t, board, () => { throw new Error("should not call"); });
  const { GET, POST } = await load("not-owner");
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1"))).status, 403);
  assert.equal((await POST(new Request("http://x/api/admin/cycle-records?cycleId=c1", { method: "POST" }))).status, 403);
});

test("refuses an unknown format or section", async (t) => {
  mock(t, owner, () => { throw new Error("should not call"); });
  const { GET } = await load("bad-format");
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1&format=xlsx"))).status, 400);
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1&format=json&section=records"))).status, 400);
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records"))).status, 400);
});

test("downloads JSON and CSV as uncached attachments from one audited export", async (t) => {
  const calls: unknown[] = [];
  mock(t, owner, (name, args) => { calls.push([name, args]); return { data: exported, error: null }; });
  const { GET } = await load("download");
  const json = await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1"));
  assert.equal(json.status, 200);
  assert.equal(json.headers.get("cache-control"), "no-store");
  assert.match(json.headers.get("content-disposition") ?? "", /mecg-cycle-c1-all-2026-11-18\.json/);
  assert.equal((await json.json()).memberToolRecords[0].contentWithheld, true);
  const csv = await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1&format=csv&section=projects"));
  assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
  assert.equal((await csv.text()).split("\n")[1], "p1,acme,Acme,,no,");
  assert.deepEqual(calls, [["export_cycle_records", { c: "c1" }], ["export_cycle_records", { c: "c1" }]]);
});

test("a response for another cycle or with leaked content is refused", async (t) => {
  const leaky = structuredClone(exported);
  leaky.memberToolRecords[0].content = { title: "secret" } as never;
  let answer: unknown = { ...exported, cycle: { ...exported.cycle, id: "c2" } };
  mock(t, owner, () => ({ data: answer, error: null }));
  const { GET } = await load("mismatch");
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1"))).status, 500);
  answer = leaky;
  assert.equal((await GET(new Request("http://x/api/admin/cycle-records?cycleId=c1"))).status, 500);
});

test("archive passes the database refusal through", async (t) => {
  mock(t, owner, () => ({ data: null, error: { code: "55000", message: "Export the cycle records before archiving" } }));
  const { POST } = await load("archive-refused");
  const response = await POST(new Request("http://x/api/admin/cycle-records?cycleId=c1", { method: "POST" }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Export the cycle records before archiving");
});
