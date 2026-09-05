import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const SECRET = "n".repeat(40);

function request(headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return new NextRequest("http://localhost/api/maintenance/notifications", { headers });
}

// null unsets the variable; assigning undefined would store the string "undefined".
function withCronSecret<T>(fn: () => T, value: string | null = SECRET): T {
  const previous = process.env.CRON_SECRET;
  if (value === null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

function notificationClient() {
  const chain = {
    select: () => chain,
    in: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: async () => ({ data: [{ id: "notification-1" }], error: null }),
  };
  return { from: () => chain };
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

// operationalLog writes one JSON line per record through console.error; keep
// only those so the loop's ad hoc console.error calls do not pollute the check.
function degradedRecords(t: test.TestContext) {
  const records: Array<Record<string, unknown>> = [];
  t.mock.method(console, "error", (value: unknown) => {
    if (typeof value !== "string" || !value.startsWith("{")) return;
    const record = JSON.parse(value);
    if (record.service === "mecg-recruitment" && record.level === "error") records.push(record);
  });
  return records;
}

test("notification worker reports retryable deliveries as degraded", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: notificationClient } });
  t.mock.module("@/lib/notifications", {
    namedExports: { deliverNotification: async () => ({ attempted: true, delivered: false, status: "PENDING" }) },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("pending"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { processed: 1, delivered: 0, deferred: 1, failed: 0, skipped: 0 });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    {
      event: "cron.notifications_degraded",
      code: "DEFERRED",
      detail: { processed: 1, delivered: 0, deferred: 1, failed: 0, skipped: 0, category: null },
    },
  );
});

test("notification worker logs the thrown category when delivery throws", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: notificationClient } });
  t.mock.module("@/lib/notifications", {
    namedExports: { deliverNotification: async () => { throw new Error("claim_notification failed: 57014"); } },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("thrown"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { processed: 1, delivered: 0, deferred: 0, failed: 1, skipped: 0 });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    {
      event: "cron.notifications_degraded",
      code: "DELIVERY_FAILED",
      detail: { processed: 1, delivered: 0, deferred: 0, failed: 1, skipped: 0, category: "claim_notification failed: 57014" },
    },
  );
});

test("notification worker treats a concurrently claimed item as skipped", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: notificationClient } });
  t.mock.module("@/lib/notifications", {
    namedExports: { deliverNotification: async () => ({ attempted: false, delivered: false, status: "NOT_DUE" }) },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("not-due"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 1, delivered: 0, deferred: 0, failed: 0, skipped: 1 });
  assert.equal(records.length, 0);
});

function mockNoWork(t: test.TestContext) {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  t.mock.module("@/lib/notifications", { namedExports: { deliverNotification: async () => { throw new Error("should not run"); } } });
}

test("notification worker rejects a missing authorization header", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("missing-header"));
  const response = await withCronSecret(() => GET(request({})));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("notification worker rejects a wrong secret", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("wrong-secret"));
  const response = await withCronSecret(() => GET(request({ authorization: "Bearer nope" })));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("notification worker refuses to run when CRON_SECRET is unset", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("unset-secret"));
  const response = await withCronSecret(() => GET(request()), null);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Not configured" });
});

test("notification worker refuses to run when CRON_SECRET is blank", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("blank-secret"));
  const response = await withCronSecret(() => GET(request({ authorization: "Bearer  " })), "  ");

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Not configured" });
});
