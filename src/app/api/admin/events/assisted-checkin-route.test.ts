import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const BOARD = {
  id: "board-1", email: "board@umich.edu", name: "Board", active: true,
  memberships: [{ id: "m1", cycleId: "cycle-1", role: "BOARD", active: true, cycle: { id: "cycle-1", name: "Fall", status: "IN_PROCESS", createdAt: new Date() } }],
};
const MEMBER = { ...BOARD, memberships: [{ ...BOARD.memberships[0], role: "MEMBER" }] };

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/events/event-1/assisted-checkin", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: "event-1" }) };
}

function client(result: { data?: unknown; error?: { code?: string; message: string } } = { data: { duplicate: false }, error: undefined }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { cycle_id: "cycle-1" }, error: null }; },
  };
  return {
    calls,
    value: {
      from: () => query,
      rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return result; },
    },
  };
}

async function route(testCase: string) {
  return import(`./[id]/assisted-checkin/route.ts?case=${testCase}`) as Promise<typeof import("./[id]/assisted-checkin/route.ts")>;
}

test("assisted check-in requires an authenticated applicant-operations user", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  const { POST } = await route("unauthenticated");
  assert.equal((await POST(request({ identifier: "applicant@umich.edu", reasonCode: "NO_CAMERA" }), context())).status, 401);
});

test("assisted check-in rejects a regular member before invoking the RPC", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => MEMBER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  const { POST } = await route("forbidden");
  assert.equal((await POST(request({ identifier: "applicant@umich.edu", reasonCode: "NO_CAMERA" }), context())).status, 403);
  assert.equal(fake.calls.length, 0);
});

test("assisted check-in bounds and validates its input", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  const { POST } = await route("validation");
  assert.equal((await POST(request({ identifier: "x".repeat(255), reasonCode: "NO_CAMERA" }), context())).status, 400);
  assert.equal((await POST(request({ identifier: "applicant@umich.edu", reasonCode: "FREE_TEXT" }), context())).status, 400);
  assert.equal(fake.calls.length, 0);
});

test("assisted check-in passes an exact identifier to the database-owned lookup", async (t) => {
  const fake = client({ data: { checkinId: "checkin-1", applicationId: "application-1", duplicate: false } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  const { POST } = await route("success");
  const response = await POST(request({ identifier: "  Applicant@UMICH.edu  ", reasonCode: "CONNECTIVITY_FAILURE" }), context());
  assert.equal(response.status, 200);
  assert.deepEqual(fake.calls, [{ name: "staff_assisted_check_in", args: {
    target_event_id: "event-1", applicant_identifier: "Applicant@UMICH.edu", reason_code: "CONNECTIVITY_FAILURE",
  } }]);
});

test("assisted check-in maps a cross-cycle lookup failure", async (t) => {
  const missing = client({ data: null, error: { code: "P0002", message: "applicant missing" } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => missing.value } });
  const first = await route("missing");
  assert.equal((await first.POST(request({ identifier: "othercycle", reasonCode: "QR_FAILURE" }), context())).status, 404);
});

test("assisted check-in maps an ambiguous database lookup failure", async (t) => {
  const ambiguous = client({ data: null, error: { code: "22023", message: "ambiguous applicant identifier" } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ambiguous.value } });
  const second = await route("ambiguous");
  assert.equal((await second.POST(request({ identifier: "Applicant ABC123", reasonCode: "QR_FAILURE" }), context())).status, 400);
});
