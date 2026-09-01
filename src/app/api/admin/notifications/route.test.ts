import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

function user(role: "BOARD" | "RECRUITMENT_COMMITTEE") {
  return {
    id: "user-1",
    email: "member@umich.edu",
    name: "Member",
    active: true,
    memberships: [{ id: "m1", cycleId: "cycle-1", role, active: true, cycle: { id: "cycle-1", name: "Cycle", status: "IN_PROCESS", createdAt: new Date() } }],
  };
}

function request(notificationId = "notification-1") {
  return new NextRequest("http://localhost/api/admin/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notificationId }),
  });
}

function client() {
  const calls: string[] = [];
  return {
    calls,
    value: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { cycle_id: "cycle-1" }, error: null }) }),
        }),
      }),
      rpc: async (name: string) => {
        calls.push(name);
        return { data: null, error: null };
      },
    },
  };
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

test("manual retry is Board-authorized, audited by RPC, and immediately attempted", async (t) => {
  const fake = client();
  const deliveries: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("BOARD") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/notifications", {
    namedExports: {
      deliverNotification: async (_client: unknown, id: string) => {
        deliveries.push(id);
        return { attempted: true, delivered: true, status: "SENT" };
      },
    },
  });
  const { POST } = await importRoute("board-retry");
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(fake.calls, ["retry_notification"]);
  assert.deepEqual(deliveries, ["notification-1"]);
});

test("recruitment committee cannot retry a decision notification", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("RECRUITMENT_COMMITTEE") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => { throw new Error("must not send"); } } });
  const { POST } = await importRoute("committee-forbidden");
  const response = await POST(request());
  assert.equal(response.status, 403);
  assert.deepEqual(fake.calls, []);
});
