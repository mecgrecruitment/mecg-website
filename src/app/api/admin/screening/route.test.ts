import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = {
  id: "board-1",
  email: "board@umich.edu",
  name: "Board",
  active: true,
  memberships: [{ id: "m1", cycleId: "cycle-1", role: "BOARD", active: true, cycle: { id: "cycle-1", name: "Fall", status: "OPEN", createdAt: new Date() } }],
};

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/screening", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("POST /api/admin/screening rejects payloads over the 64 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ cycleId: "cycle-1", action: "CREATE" }, { "content-length": String(64 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Payload is too large");
});
