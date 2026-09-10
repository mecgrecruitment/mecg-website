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
