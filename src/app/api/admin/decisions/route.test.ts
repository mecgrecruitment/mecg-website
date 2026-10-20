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

test("RELEASE_ALL is accepted as a cycle-scoped release action", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({
    rpcHandlers: {
      release_ready_decisions: (args) => ({ data: { released: 3, skipped: 1, args }, error: null }),
    },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("release-all");
  const res = await POST(postRequest({ action: "RELEASE_ALL", cycleId: "real-cycle" }));
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { released: 3, skipped: 1, args: { target_cycle_id: "real-cycle" }, delivery: "QUEUED" });
  assert.deepEqual(rpcCalls, [{ name: "release_ready_decisions", args: { target_cycle_id: "real-cycle" } }]);
});

test("SET_DEADLINE rejects an impossible calendar date at the API boundary", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({ realCycleId: "real-cycle" });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("deadline-impossible-date");
  const res = await POST(postRequest({
    action: "SET_DEADLINE",
    applicationId: "application-1",
    expiresAt: "2030-02-30T20:00:00.000Z",
  }));
  assert.equal(res.status, 400);
  assert.deepEqual(rpcCalls, []);
});

test("SET_DEADLINE is forbidden when the caller only belongs to a client-claimed cycle", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({ realCycleId: "real-cycle" });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("attacker-claimed-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("deadline-forbidden");
  const res = await POST(postRequest({
    action: "SET_DEADLINE",
    applicationId: "application-1",
    cycleId: "attacker-claimed-cycle",
    expiresAt: "2030-09-10T20:00:00.000Z",
  }));
  assert.equal(res.status, 403);
  assert.deepEqual(rpcCalls, []);
});

test("SET_DEADLINE resolves the application's real cycle and reaches the audited RPC", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({
    realCycleId: "real-cycle",
    rpcHandlers: { set_offer_deadline: () => ({ data: true, error: null }) },
  });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("deadline-allowed");
  const res = await POST(postRequest({
    action: "SET_DEADLINE",
    applicationId: "application-1",
    cycleId: "bogus-cycle",
    expiresAt: "2030-09-10T20:00:00.000Z",
  }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { kind: "deadline-set", applicationId: "application-1", expiresAt: "2030-09-10T20:00:00.000Z" });
  assert.deepEqual(rpcCalls, [{
    name: "set_offer_deadline",
    args: { target_application_id: "application-1", expires_at: "2030-09-10T20:00:00.000Z" },
  }]);
});

test("SET_DEADLINE rejects a missing application before querying the database", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => ({ from: () => { throw new Error("database should not be queried"); } }) },
  });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("deadline-missing-application");
  const res = await POST(postRequest({ action: "SET_DEADLINE", expiresAt: "2030-09-10T20:00:00.000Z" }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Application is required" });
});

test("SET_DEADLINE rejects an offset-less wall time at the API boundary", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({ realCycleId: "real-cycle" });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  const { POST } = await importRoute("deadline-offset-required");
  const res = await POST(postRequest({
    action: "SET_DEADLINE",
    applicationId: "application-1",
    expiresAt: "2030-09-10T20:00",
  }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid deadline" });
  assert.deepEqual(rpcCalls, []);
});

test("POST /api/admin/decisions rejects payloads over the 1 MiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ action: "PREVIEW" }, { "content-length": String(1024 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
});

test("POST /api/admin/decisions bounds oversized streamed bodies without Content-Length", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413-streamed");
  const request = postRequest({ action: "PREVIEW", preview: "x".repeat(1024 * 1024) });
  assert.equal(request.headers.has("content-length"), false);
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
  assert.deepEqual(await res.json(), { decisionId: "decision-1", released: true, notified: true, queued: false });
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
  assert.deepEqual(await res.json(), { decisionId: "decision-1", released: true, notified: false, queued: true });
});

test("RELEASE_PREFLIGHT uses release permission and does not mutate decisions", async (t) => {
  const items = [{ decisionId: "d1", applicationId: "a1", outcome: "OFFER", reasonCode: null }];
  const { client, rpcCalls } = fakeSupabaseClient({ rpcHandlers: { decision_release_preflight: () => ({ data: { items }, error: null }) } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("release-preflight");
  const res = await POST(postRequest({ action: "RELEASE_PREFLIGHT", cycleId: "real-cycle" }));
  assert.equal(res.status, 200);
  const response = await res.json();
  assert.deepEqual(response.items, items);
  assert.match(response.applicantLabels.a1, /^Applicant [0-9A-F]{6}$/);
  assert.deepEqual(rpcCalls, [{ name: "decision_release_preflight", args: { target_cycle_id: "real-cycle" } }]);
});

test("reviewed RELEASE_ALL forwards exact snapshot rather than releasing an expanded cohort", async (t) => {
  const snapshot = [{ decisionId: "d1", outcome: "WAITLIST", reasonCode: null }];
  const { client, rpcCalls } = fakeSupabaseClient({ rpcHandlers: { release_decision_batch: () => ({ data: { released: 1, skipped: 0, items: [] }, error: null }) } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("release-snapshot");
  const res = await POST(postRequest({ action: "RELEASE_ALL", cycleId: "real-cycle", snapshot }));
  assert.equal(res.status, 202);
  assert.deepEqual(rpcCalls, [{ name: "release_decision_batch", args: { target_cycle_id: "real-cycle", expected_decisions: snapshot } }]);
});

test("reviewed RELEASE_ALL accepts 500 decisions above 16 KiB without truncating the snapshot", async (t) => {
  const snapshot = Array.from({ length: 500 }, (_, index) => ({
    decisionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    outcome: "WAITLIST",
    reasonCode: null,
  }));
  const body = { action: "RELEASE_ALL", cycleId: "real-cycle", snapshot };
  assert.ok(Buffer.byteLength(JSON.stringify(body)) > 16 * 1024);
  const { client, rpcCalls } = fakeSupabaseClient({ rpcHandlers: {
    release_decision_batch: () => ({ data: { released: 500, skipped: 0,
      items: snapshot.map((item, index) => ({ ...item, applicationId: `application-${index}` })),
    }, error: null }),
  } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("release-large-snapshot");
  const res = await POST(postRequest(body));
  assert.equal(res.status, 202);
  assert.deepEqual(rpcCalls, [{ name: "release_decision_batch", args: { target_cycle_id: "real-cycle", expected_decisions: snapshot } }]);
});

test("snapshot drift is a recoverable conflict and never exposes SQL error details", async (t) => {
  const { client } = fakeSupabaseClient({ rpcHandlers: { release_decision_batch: () => ({ data: null, error: { code: "40001", message: "internal secret" } }) } });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("release-drift");
  const res = await POST(postRequest({ action: "RELEASE_ALL", cycleId: "real-cycle", snapshot: [] }));
  assert.equal(res.status, 409);
  assert.doesNotMatch(JSON.stringify(await res.json()), /internal secret/);
});

test("invalid release snapshots cannot invoke either batch RPC", async (t) => {
  const { client, rpcCalls } = fakeSupabaseClient({});
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("release-invalid-snapshot");
  const res = await POST(postRequest({ action: "RELEASE_ALL", cycleId: "real-cycle", snapshot: [{ decisionId: "d1", outcome: "OFFER", reasonCode: "UNKNOWN" }] }));
  assert.equal(res.status, 400);
  assert.deepEqual(rpcCalls, []);
});

for (const scenario of ["lookup-failure", "delivery-throws", "delivery-failed"] as const) {
  test(`confirmed RELEASE retains decision-specific receipt when ${scenario}`, async (t) => {
    const { client } = fakeSupabaseClient({ applicationId: "app-1", realCycleId: "real-cycle", rpcHandlers: {
      release_decision: () => ({ data: null, error: null }),
      decision_notification_id: () => scenario === "lookup-failure" ? { data: null, error: { code: "XX000", message: "private error" } } : { data: "notification-1", error: null },
    } });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
    t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => {
      if (scenario === "delivery-throws") throw new Error("private delivery error");
      return { attempted: true, delivered: false, status: "FAILED" };
    } } });
    const { POST } = await importRoute(`release-receipt-${scenario}`);
    const response = await POST(postRequest({ action: "RELEASE", decisionId: "decision-1" }));
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { decisionId: "decision-1", released: true, notified: false, queued: scenario !== "delivery-failed" });
  });
}

for (const value of ["", "2030-09-10T16:00:00-04:00"]) {
  test(`SET_DEADLINE binds its ${value ? "normalized date" : "clear"} receipt to the exact application`, async (t) => {
    const { client, rpcCalls } = fakeSupabaseClient({ realCycleId: "real-cycle", rpcHandlers: { set_offer_deadline: () => ({ data: true, error: null }) } });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
    const { POST } = await importRoute(`deadline-receipt-${value ? "offset" : "clear"}`);
    const res = await POST(postRequest({ action: "SET_DEADLINE", applicationId: "application-1", expiresAt: value }));
    assert.equal(res.status, 200);
    const expected = value ? "2030-09-10T20:00:00.000Z" : null;
    assert.deepEqual(await res.json(), { kind: "deadline-set", applicationId: "application-1", expiresAt: expected });
    assert.deepEqual(rpcCalls[0]?.args, { target_application_id: "application-1", expires_at: expected });
  });
}
for (const [label, acknowledgement] of [["missing", null], ["false", false], ["unrelated", { ok: true }]] as const) {
  test(`SET_DEADLINE does not confirm a ${label} RPC acknowledgement`, async (t) => {
    const { client } = fakeSupabaseClient({ realCycleId: "real-cycle", rpcHandlers: { set_offer_deadline: () => ({ data: acknowledgement, error: null }) } });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => panelUser("real-cycle") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ admin: true }) } });
    const { POST } = await importRoute(`deadline-unconfirmed-${label}`);
    const res = await POST(postRequest({ action: "SET_DEADLINE", applicationId: "application-1", expiresAt: "" }));
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /could not be confirmed/);
  });
}
