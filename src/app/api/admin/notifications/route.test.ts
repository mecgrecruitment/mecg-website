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

test("uncertain delivery acknowledgement stays unconfirmed and identifies its notification", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("BOARD") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({}) } });
  t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => { throw new Error("response interrupted"); } } });
  const { POST } = await importRoute("uncertain-retry");
  const response = await POST(request());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { notificationId: "notification-1", status: "UNCONFIRMED" });
});

test("checking a notification is read only and returns no recipient or message content", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("readback must not send"); } } });
  t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => { throw new Error("readback must not send"); } } });
  const fake = client();
  const value = { ...fake.value, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "notification-1", cycle_id: "cycle-1", status: "SENT" }, error: null }) }) }) }) };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("BOARD") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => value } });
  const { GET } = await importRoute("read-status");
  const response = await GET(new NextRequest("http://localhost/api/admin/notifications?notificationId=notification-1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { notificationId: "notification-1", status: "SENT" });
  assert.deepEqual(fake.calls, []);
});

test("readback cannot expose another cycle's notification to a committee member", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("readback must not send"); } } });
  t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => { throw new Error("readback must not send"); } } });
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("RECRUITMENT_COMMITTEE") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  const { GET } = await importRoute("forbidden-read-status");
  const response = await GET(new NextRequest("http://localhost/api/admin/notifications?notificationId=notification-1"));
  assert.equal(response.status, 403);
  assert.deepEqual(fake.calls, []);
});
