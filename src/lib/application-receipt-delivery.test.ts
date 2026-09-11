import assert from "node:assert/strict";
import test from "node:test";

test("durable application receipts get an immediate post-response delivery attempt", async (t) => {
  let callback: (() => Promise<void>) | null = null;
  const delivered: string[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    lte: () => query,
    neq: () => query,
    order: () => query,
    maybeSingle: async () => ({ data: { id: "receipt-1" }, error: null }),
    limit: async () => ({ data: [{ id: "stale-1" }, { id: "stale-2" }], error: null }),
  };
  const client = { from: () => query, rpc: async () => ({ data: null, error: null }) };
  t.mock.module("next/server", { namedExports: { after: (work: () => Promise<void>) => { callback = work; } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  t.mock.module("@/lib/notifications", { namedExports: {
    deliverNotification: async (_client: unknown, id: string) => {
      if (id === "stale-1") throw new Error("provider down");
      delivered.push(id);
    },
  } });
  const durableSpecifier = "./application-receipt-delivery.ts?case=durable";
  const { scheduleApplicationReceiptDelivery } = await import(durableSpecifier) as typeof import("./application-receipt-delivery.ts");
  scheduleApplicationReceiptDelivery({ applicationId: "application-1", applicantName: "Ada", recipient: "ada@example.com", durableOutbox: true });
  assert.ok(callback);
  await (callback as () => Promise<void>)();
  assert.deepEqual(delivered, ["receipt-1", "stale-2"]);
});

test("a sweep lookup failure does not block the receipt", async (t) => {
  let callback: (() => Promise<void>) | null = null;
  const delivered: string[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    lte: () => query,
    neq: () => query,
    order: () => query,
    maybeSingle: async () => ({ data: { id: "receipt-1" }, error: null }),
    limit: async () => ({ data: null, error: { message: "boom" } }),
  };
  const client = { from: () => query, rpc: async () => ({ data: null, error: null }) };
  t.mock.module("next/server", { namedExports: { after: (work: () => Promise<void>) => { callback = work; } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  t.mock.module("@/lib/notifications", { namedExports: {
    deliverNotification: async (_client: unknown, id: string) => { delivered.push(id); },
  } });
  const sweepFailureSpecifier = "./application-receipt-delivery.ts?case=sweep-failure";
  const { scheduleApplicationReceiptDelivery } = await import(sweepFailureSpecifier) as typeof import("./application-receipt-delivery.ts");
  scheduleApplicationReceiptDelivery({ applicationId: "application-1", applicantName: "Ada", recipient: "ada@example.com", durableOutbox: true });
  assert.ok(callback);
  await (callback as () => Promise<void>)();
  assert.deepEqual(delivered, ["receipt-1"]);
});

test("old-database compatibility sends and logs one idempotent direct receipt", async (t) => {
  let callback: (() => Promise<void>) | null = null;
  const sent: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    from: () => { throw new Error("old database path must not query the outbox"); },
    rpc: async (name: string, args?: Record<string, unknown>) => { rpcCalls.push({ name, args }); return { data: null, error: null }; },
  };
  t.mock.module("next/server", { namedExports: { after: (work: () => Promise<void>) => { callback = work; } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => client } });
  t.mock.module("@/lib/email", { namedExports: {
    escapeHtml: (value: string) => value,
    wrapEmail: (value: string) => value,
    sendEmailDetailed: async (input: Record<string, unknown>) => {
      sent.push(input);
      return { delivered: true, providerMessageId: "email-1", errorCategory: null, retryable: false };
    },
  } });
  const legacySpecifier = "./application-receipt-delivery.ts?case=legacy";
  const { scheduleApplicationReceiptDelivery } = await import(legacySpecifier) as typeof import("./application-receipt-delivery.ts");
  scheduleApplicationReceiptDelivery({ applicationId: "application-1", applicantName: "Ada", recipient: "ada@example.com", durableOutbox: false });
  assert.ok(callback);
  await (callback as () => Promise<void>)();
  assert.equal(sent[0]?.idempotencyKey, "application-received:application-1");
  assert.equal(rpcCalls[0]?.name, "log_message");
});
