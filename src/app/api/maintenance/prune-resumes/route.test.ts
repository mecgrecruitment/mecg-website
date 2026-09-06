import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const SECRET = "s".repeat(40);

function request(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/maintenance/prune-resumes", { headers });
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function withCronSecret<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
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

test("GET /api/maintenance/prune-resumes rejects a wrong secret of the same length", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  const { GET } = await withCronSecret(SECRET, () => importRoute("wrong-same-length"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${"x".repeat(40)}` })));
  assert.equal(res.status, 401);
});

test("GET /api/maintenance/prune-resumes rejects a shorter secret without throwing", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  const { GET } = await withCronSecret(SECRET, () => importRoute("wrong-shorter"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: "Bearer short" })));
  assert.equal(res.status, 401);
});

test("GET /api/maintenance/prune-resumes rejects a longer secret without throwing", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  const { GET } = await withCronSecret(SECRET, () => importRoute("wrong-longer"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${SECRET}extra` })));
  assert.equal(res.status, 401);
});

test("GET /api/maintenance/prune-resumes rejects a missing authorization header", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  const { GET } = await withCronSecret(SECRET, () => importRoute("missing-header"));
  const res = await withCronSecret(SECRET, () => GET(request()));
  assert.equal(res.status, 401);
});

test("GET /api/maintenance/prune-resumes accepts the correct secret", async (t) => {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string) => {
          assert.equal(name, "stale_pending_resume_uploads");
          return { data: [], error: null };
        },
      }),
    },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(SECRET, () => importRoute("correct"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${SECRET}` })));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, removed: 0, failed: 0 });
  assert.equal(records.length, 0);
});

test("GET /api/maintenance/prune-resumes reports deletion failures as degraded", async (t) => {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async () => ({ data: [{ document_id: "document-1", object_path: "stale.pdf" }], error: null }),
        storage: { from: () => ({ remove: async () => ({ error: { message: "provider unavailable" } }) }) },
      }),
    },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(SECRET, () => importRoute("delete-failure"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${SECRET}` })));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, removed: 0, failed: 1 });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    {
      event: "cron.prune_resumes_degraded",
      code: "STORAGE_DELETE_FAILED",
      detail: { removed: 0, failed: 1, deleteFailed: 1, retireFailed: 0 },
    },
  );
});

test("GET /api/maintenance/prune-resumes logs a degraded run when the row retire fails after delete", async (t) => {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string) =>
          name === "stale_pending_resume_uploads"
            ? { data: [{ document_id: "document-1", object_path: "stale.pdf" }], error: null }
            : { data: null, error: { code: "P0001" } },
        storage: { from: () => ({ remove: async () => ({ error: null }) }) },
      }),
    },
  });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(SECRET, () => importRoute("retire-failure"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${SECRET}` })));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, removed: 0, failed: 1 });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    {
      event: "cron.prune_resumes_degraded",
      code: "ROW_RETIRE_FAILED",
      detail: { removed: 0, failed: 1, deleteFailed: 0, retireFailed: 1 },
    },
  );
});
