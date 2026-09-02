import assert from "node:assert/strict";
import test from "node:test";
import { retryAfterMilliseconds, withRetryAfter } from "./retry-after.mjs";

test("Retry-After is honored for Clerk 429 responses", async () => {
  const waits = [];
  let calls = 0;
  const result = await withRetryAfter(async () => {
    calls += 1;
    if (calls < 3) throw { status: 429, headers: new Headers({ "retry-after": "2" }) };
    return "ok";
  }, { sleep: async (milliseconds) => { waits.push(milliseconds); }, jitter: () => 250 });
  assert.equal(result, "ok");
  assert.deepEqual(waits, [2250, 2250]);
});

test("non-rate-limit errors and malformed Retry-After values are not retried", async () => {
  assert.equal(retryAfterMilliseconds({ status: 500 }), null);
  assert.equal(retryAfterMilliseconds({ status: 429, headers: { "retry-after": "later" } }), null);
  let calls = 0;
  await assert.rejects(withRetryAfter(async () => { calls += 1; throw new Error("no"); }));
  assert.equal(calls, 1);
});
