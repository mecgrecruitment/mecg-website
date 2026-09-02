import test from "node:test";
import assert from "node:assert/strict";

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function mockSupabase(
  t: test.TestContext,
  rpc: (signal: AbortSignal) => Promise<{ error: unknown }>,
) {
  let calls = 0;
  let suppliedSignal: AbortSignal | undefined;
  t.mock.module("@/lib/supabase/public", {
    namedExports: {
      createPublicClient: () => ({
        rpc: () => ({
          abortSignal: (signal: AbortSignal) => {
            calls += 1;
            suppliedSignal = signal;
            return rpc(signal);
          },
        }),
      }),
    },
  });
  return {
    calls: () => calls,
    signal: () => suppliedSignal,
  };
}

test("GET /api/health returns 200 for a healthy Supabase probe", async (t) => {
  const probe = mockSupabase(t, async () => ({ error: null }));
  const { GET } = await importRoute("healthy");
  const response = await GET();

  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get("cache-control"), "public, max-age=10");
  assert.ok(probe.signal() instanceof AbortSignal);
});

test("GET /api/health returns 503 without error details when the RPC fails", async (t) => {
  mockSupabase(t, async () => ({ error: new Error("database secret") }));
  t.mock.method(console, "error", () => {});
  const { GET } = await importRoute("rpc-failure");
  const response = await GET();

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("GET /api/health cancels a timed-out Supabase probe and returns 503", async (t) => {
  const controller = new AbortController();
  let timeoutMs: number | undefined;
  let requestCancelled = false;
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    timeoutMs = milliseconds;
    return controller.signal;
  });
  mockSupabase(
    t,
    (signal) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            requestCancelled = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  );
  t.mock.method(console, "error", () => {});
  const { GET } = await importRoute("timeout");
  const pending = GET();
  await Promise.resolve();
  await Promise.resolve();
  controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
  const response = await pending;

  assert.equal(timeoutMs, 2_000);
  assert.equal(requestCancelled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("GET /api/health reuses a healthy result within the cache window", async (t) => {
  const probe = mockSupabase(t, async () => ({ error: null }));
  const { GET } = await importRoute("cache");

  assert.equal((await GET()).status, 200);
  assert.equal((await GET()).status, 200);
  assert.equal(probe.calls(), 1);
});

test("GET /api/health shares one probe across concurrent cache misses", async (t) => {
  let resolveProbe: ((result: { error: null }) => void) | undefined;
  const probe = mockSupabase(
    t,
    () =>
      new Promise((resolve) => {
        resolveProbe = resolve;
      }),
  );
  const { GET } = await importRoute("concurrent");

  const first = GET();
  const second = GET();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(probe.calls(), 1);

  resolveProbe?.({ error: null });
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
});
