import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

// Ballot visibility, note gating and the membership gate are member_hash_live's
// (supabase/tests/member_hash_live.sql). The route owns the request contract.
function importRoute(key: string) {
  return import(`./route.ts?case=${key}`) as Promise<typeof import("./route.ts")>;
}

function mockRpc(t: test.TestContext, result: { data: unknown; error: { code: string; message: string } | null }, calls: unknown[] = []) {
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, "member_hash_live");
      calls.push(args);
      return result;
    },
  }) } });
}

test("a poll is one database call carrying the selected cycle and requested applicant", async (t) => {
  const calls: unknown[] = [];
  mockRpc(t, { data: { cycleId: "cycle", presenting: null, applicationId: null, notes: [] }, error: null }, calls);
  const { GET } = await importRoute("args");
  await GET(new NextRequest("http://localhost/api/member/hash/live?cycleId=cycle&applicationId=other"));
  await GET(new NextRequest("http://localhost/api/member/hash/live"));
  assert.deepEqual(calls, [
    { target_cycle_id: "cycle", target_application_id: "other" },
    { target_cycle_id: null, target_application_id: "" },
  ]);
});

test("the presented applicant gets its readable major and year line", async (t) => {
  mockRpc(t, { data: {
    cycleId: "cycle",
    presenting: { id: "presenter", name: "Visible applicant", major: null, class_year: null },
    applicationId: "presenter",
    notes: [{ source: "GROUP_CASE", note: "Evidence" }],
  }, error: null });
  const { GET } = await importRoute("shape");
  const response = await GET(new NextRequest("http://localhost/api/member/hash/live"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    presentingId: "presenter",
    presenting: { id: "presenter", name: "Visible applicant", meta: "", decided: null },
    applicationId: "presenter",
    notes: [{ source: "GROUP_CASE", note: "Evidence" }],
  });
});

for (const [code, status] of [["28000", 401], ["42501", 403], ["XX000", 500]] as const) {
  test(`a database refusal ${code} answers ${status} without applicant data`, async (t) => {
    mockRpc(t, { data: null, error: { code, message: "refused" } });
    t.mock.method(console, "error", () => {});
    const { GET } = await importRoute(`error-${code}`);
    const response = await GET(new NextRequest("http://localhost/api/member/hash/live"));
    assert.equal(response.status, status);
    assert.equal(JSON.stringify(await response.json()).includes("presenter"), false);
  });
}

for (const url of ["?cycleId=a&cycle=b", `?applicationId=${"x".repeat(201)}`]) {
  test(`a malformed request is refused before the database: ${url.slice(0, 30)}`, async (t) => {
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not query"); } } });
    const { GET } = await importRoute(`bad-${url.length}`);
    const response = await GET(new NextRequest(`http://localhost/api/member/hash/live${url}`));
    assert.equal(response.status, 400);
  });
}
