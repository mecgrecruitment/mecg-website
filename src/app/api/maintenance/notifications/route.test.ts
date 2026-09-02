import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const SECRET = "n".repeat(40);

function request() {
  return new NextRequest("http://localhost/api/maintenance/notifications", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

function withCronSecret<T>(fn: () => T): T {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
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

test("notification worker reports retryable deliveries as degraded", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: notificationClient } });
  t.mock.module("@/lib/notifications", {
    namedExports: { deliverNotification: async () => ({ attempted: true, delivered: false, status: "PENDING" }) },
  });
  const { GET } = await withCronSecret(() => importRoute("pending"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { processed: 1, delivered: 0, deferred: 1, failed: 0, skipped: 0 });
});

test("notification worker treats a concurrently claimed item as skipped", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: notificationClient } });
  t.mock.module("@/lib/notifications", {
    namedExports: { deliverNotification: async () => ({ attempted: false, delivered: false, status: "NOT_DUE" }) },
  });
  const { GET } = await withCronSecret(() => importRoute("not-due"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 1, delivered: 0, deferred: 0, failed: 0, skipped: 1 });
});
