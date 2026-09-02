import assert from "node:assert/strict";
import test from "node:test";
import { retryClerkRateLimit } from "./clerk-retry.ts";

test("Clerk signup retry waits for Retry-After with bounded jitter", async () => {
  const waits: number[] = [];
  const notices: number[] = [];
  let calls = 0;
  const result = await retryClerkRateLimit(async () => {
    calls += 1;
    if (calls < 3) throw { status: 429, retryAfter: 2 };
    return "created";
  }, { sleep: async (ms) => { waits.push(ms); }, jitter: () => 400, onWait: (seconds) => notices.push(seconds) });
  assert.equal(result, "created");
  assert.deepEqual(waits, [2400, 2400]);
  assert.deepEqual(notices, [2, 2]);
});

test("verification errors without Retry-After are not replayed", async () => {
  let calls = 0;
  await assert.rejects(retryClerkRateLimit(async () => { calls += 1; throw { status: 429 }; }));
  assert.equal(calls, 1);
});

test("new Clerk hook errors expose rate-limit metadata through their cause", async () => {
  let calls = 0;
  const result = await retryClerkRateLimit(async () => {
    calls += 1;
    if (calls === 1) throw { code: "rate_limited", cause: { status: 429, retryAfter: 0 } };
    return "created";
  }, { sleep: async () => undefined, jitter: () => 0 });
  assert.equal(result, "created");
  assert.equal(calls, 2);
});
