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

test("POST /api/admin/screening APPROVE_ALL calls approve_screening_packets and returns its summary", async (t) => {
  const calls: Array<[string, unknown]> = [];
  const summary = { approved: 148, failed: [{ packetId: "p1", code: "A-07", reason: "answer still names the applicant" }] };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data: summary, error: null }; },
      }),
    },
  });
  const { POST } = await importRoute("approve-all");
  const res = await POST(postRequest({ cycleId: "cycle-1", action: "APPROVE_ALL", batchId: "batch-1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: summary });
  assert.deepEqual(calls, [["approve_screening_packets", { target_batch_id: "batch-1" }]]);
});

test("POST /api/admin/screening RESET calls reset_screening_batch", async (t) => {
  const calls: Array<[string, unknown]> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data: null, error: null }; },
      }),
    },
  });
  const { POST } = await importRoute("reset");
  const res = await POST(postRequest({ cycleId: "cycle-1", action: "RESET", batchId: "batch-1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [["reset_screening_batch", { target_batch_id: "batch-1" }]]);
});

test("POST /api/admin/screening REASSIGN_READER calls reassign_screening_reader and returns the count", async (t) => {
  const calls: Array<[string, unknown]> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data: 7, error: null }; },
      }),
    },
  });
  const { POST } = await importRoute("reassign");
  const res = await POST(postRequest({ cycleId: "cycle-1", action: "REASSIGN_READER", batchId: "batch-1", reviewerId: "reader-1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: { reassigned: 7 } });
  assert.deepEqual(calls, [["reassign_screening_reader", { target_batch_id: "batch-1", target_reviewer_id: "reader-1" }]]);
});

test("POST /api/admin/screening surfaces the RPC message for a 55000 refusal", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async () => ({ data: null, error: { code: "55000", message: "Reviews have been submitted; the batch cannot be reset" } }),
      }),
    },
  });
  t.mock.method(console, "error", () => {});
  const { POST } = await importRoute("reset-refused");
  const res = await POST(postRequest({ cycleId: "cycle-1", action: "RESET", batchId: "batch-1" }));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "Reviews have been submitted; the batch cannot be reset");
});
