import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcHandlers = Record<string, (args?: Record<string, unknown>) => RpcResponse>;

function panelUser(cycleId: string) {
  return {
    id: "panelist-1",
    email: "panel@umich.edu",
    name: "Panelist",
    active: true,
    memberships: [{ id: "m1", cycleId, role: "PANEL" as const, active: true, cycle: { id: cycleId, name: cycleId, status: "IN_PROCESS", createdAt: new Date() } }],
  };
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/decisions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// Mimics the `.from(table).select(...).eq(...).maybeSingle()` chain the route
// uses to re-derive a decision's real cycle from its application.
function fakeSupabaseClient(options: { applicationId?: string; realCycleId?: string; rpcHandlers?: RpcHandlers }) {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  return {
    rpcCalls,
    client: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "decisions") return { data: { application_id: options.applicationId ?? null }, error: null };
              if (table === "applications") return { data: { cycle_id: options.realCycleId ?? null }, error: null };
              return { data: null, error: null };
            },
          }),
        }),
      }),
      rpc: async (name: string, args?: Record<string, unknown>): Promise<RpcResponse> => {
        rpcCalls.push({ name, args });
        const handler = options.rpcHandlers?.[name];
        if (!handler) throw new Error(`unexpected rpc call: ${name}`);
        return handler(args);
      },
    },
  };
}

test("PREVIEW is forbidden when the caller only holds DECIDE in the cycleId they supplied, not the decision's real cycle", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({ applicationId: "app-1", realCycleId: "real-cycle" });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("attacker-claimed-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("preview-forbidden");
  const res = await POST(postRequest({ action: "PREVIEW", decisionId: "d1", cycleId: "attacker-claimed-cycle", preview: "hi" }));
  assert.equal(res.status, 403);
  assert.deepEqual(rpcCalls, []);
});

test("PREVIEW succeeds based on the decision's real cycle even when the client omits/misstates cycleId", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({
    applicationId: "app-1",
    realCycleId: "real-cycle",
    rpcHandlers: { set_decision_preview: () => ({ data: { ok: true }, error: null }) },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("preview-allowed");
  const res = await POST(postRequest({ action: "PREVIEW", decisionId: "d1", cycleId: "bogus-cycle", preview: "hi" }));
  assert.equal(res.status, 200);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0]!.name, "set_decision_preview");
});

test("POST /api/admin/decisions rejects payloads over the 16 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ action: "PREVIEW" }, { "content-length": String(16 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
});

test("RELEASE attempts the durable notification created by the release transaction", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({
    applicationId: "app-1",
    realCycleId: "real-cycle",
    rpcHandlers: {
      release_decision: () => ({ data: null, error: null }),
      decision_notification_id: () => ({ data: "notification-1", error: null }),
    },
  });
  const deliveredIds: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/notifications", {
    namedExports: {
      deliverNotification: async (_client: unknown, id: string) => {
        deliveredIds.push(id);
        return { attempted: true, delivered: true, status: "SENT" };
      },
    },
  });
  const { POST } = await importRoute("release-delivers-outbox");
  const res = await POST(postRequest({ action: "RELEASE", decisionId: "decision-1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(deliveredIds, ["notification-1"]);
  assert.deepEqual(rpcCalls.map((call) => call.name), ["release_decision", "decision_notification_id"]);
});

test("RELEASE remains successful and reports queued when provider delivery is deferred", async (t) => {
  const { client } = fakeSupabaseClient({
    applicationId: "app-1",
    realCycleId: "real-cycle",
    rpcHandlers: {
      release_decision: () => ({ data: null, error: null }),
      decision_notification_id: () => ({ data: "notification-1", error: null }),
    },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/notifications", {
    namedExports: {
      deliverNotification: async () => ({ attempted: true, delivered: false, status: "PENDING" }),
    },
  });
  const { POST } = await importRoute("release-queues-outbox");
  const res = await POST(postRequest({ action: "RELEASE", decisionId: "decision-1" }));
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { released: true, notified: false, queued: true });
});
