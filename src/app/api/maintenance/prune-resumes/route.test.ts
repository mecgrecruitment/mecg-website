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
  const { GET } = await withCronSecret(SECRET, () => importRoute("correct"));
  const res = await withCronSecret(SECRET, () => GET(request({ authorization: `Bearer ${SECRET}` })));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, removed: 0, failed: 0 });
});
