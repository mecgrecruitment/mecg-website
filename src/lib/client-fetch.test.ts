import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout, reconcileSubmittedApplication, RequestTimeoutError } from "./client-fetch.ts";

test("fetchWithTimeout returns a response and clears its deadline", async () => {
  const response = await fetchWithTimeout("https://example.test", {}, 50, async () => new Response("ok"));
  assert.equal(await response.text(), "ok");
});

test("fetchWithTimeout aborts a request that does not settle", async () => {
  const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
  await assert.rejects(fetchWithTimeout("https://example.test", {}, 5, fetcher), RequestTimeoutError);
});

test("submission reconciliation polls through stale draft status until committed", async () => {
  let attempts = 0;
  const fetcher: typeof fetch = async () => {
    attempts += 1;
    return Response.json({ application: { submitted: attempts >= 3 } });
  };
  assert.equal(await reconcileSubmittedApplication({ fetcher, waits: [0, 0, 0] }), true);
  assert.equal(attempts, 3);
});

test("submission reconciliation keeps a non-committed result ambiguous", async () => {
  const fetcher: typeof fetch = async () => Response.json({ application: null });
  assert.equal(await reconcileSubmittedApplication({ fetcher, waits: [0, 0] }), false);
});

import { authorizedFetch, refreshSessionToken, retryOnNetworkError, SessionExpiredError } from "./client-fetch.ts";

test("authorizedFetch retries once with a refreshed session after a 401", async () => {
  const statuses = [401, 200];
  let refreshed = 0;
  const fetcher: typeof fetch = async () => new Response(null, { status: statuses.shift() });
  const response = await authorizedFetch("/api/x", {}, { fetcher, refresh: async () => { refreshed += 1; return true; } });
  assert.equal(response.status, 200);
  assert.equal(refreshed, 1);
});

test("authorizedFetch leaves non-401 responses alone", async () => {
  const fetcher: typeof fetch = async () => new Response(null, { status: 400 });
  const response = await authorizedFetch("/api/x", {}, { fetcher, refresh: async () => { throw new Error("must not refresh"); } });
  assert.equal(response.status, 400);
});

test("authorizedFetch reports an expired sign-in when the retry is refused too", async () => {
  const fetcher: typeof fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(authorizedFetch("/api/x", {}, { fetcher, refresh: async () => false }), SessionExpiredError);
});

test("refreshSessionToken is a no-op without a Clerk session and bounded with one", async () => {
  assert.equal(await refreshSessionToken(10, {} as Window), false);
  const hung = { Clerk: { session: { getToken: () => new Promise<string>(() => {}) } } } as unknown as Window;
  assert.equal(await refreshSessionToken(5, hung), false);
  const fresh = { Clerk: { session: { getToken: async () => "jwt" } } } as unknown as Window;
  assert.equal(await refreshSessionToken(5, fresh), true);
});

test("retryOnNetworkError retries thrown errors with the given delays and then gives up", async () => {
  const waits: number[] = [];
  let calls = 0;
  const result = await retryOnNetworkError(async () => {
    calls += 1;
    if (calls < 3) throw new TypeError("Failed to fetch");
    return "ok";
  }, { delays: [1, 2, 3], wait: async (ms) => { waits.push(ms); } });
  assert.equal(result, "ok");
  assert.deepEqual(waits, [1, 2]);

  await assert.rejects(retryOnNetworkError(async () => { throw new TypeError("down"); }, { delays: [0], wait: async () => {} }), TypeError);
});

test("retryOnNetworkError stops when the action is superseded or the session expired", async () => {
  let wanted = true;
  let calls = 0;
  await assert.rejects(retryOnNetworkError(async () => {
    calls += 1;
    wanted = false;
    throw new TypeError("down");
  }, { delays: [0, 0], wait: async () => {}, stillWanted: () => wanted }), TypeError);
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(retryOnNetworkError(async () => { calls += 1; throw new SessionExpiredError(); }, { delays: [0], wait: async () => {} }), SessionExpiredError);
  assert.equal(calls, 1);
});
