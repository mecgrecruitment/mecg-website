import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "member-1", email: "m@umich.edu", name: "Member", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/member/buddy", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("POST /api/member/buddy rejects payloads over the 2 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ cycleId: "cycle-1", startsAt: "2026-09-10T18:00:00Z", endsAt: "2026-09-10T19:00:00Z" }, { "content-length": String(2 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Payload is too large");
});

test("POST /api/member/buddy creates a slot for a valid payload", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args?: Record<string, unknown>) => {
          calls.push({ name, args });
          return { data: null, error: null };
        },
      }),
    },
  });
  const { POST } = await importRoute("success");
  const res = await POST(postRequest({ cycleId: "cycle-1", startsAt: "2026-09-10T18:00:00Z", endsAt: "2026-09-10T19:00:00Z" }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, "create_buddy_slot");
});
