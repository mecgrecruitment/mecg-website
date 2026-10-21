import assert from "node:assert/strict";
import test from "node:test";
import { createRetryBackoff } from "./retry-backoff";

function fakeTimers() {
  let next = 1;
  const queued = new Map<number, { run: () => void; ms: number }>();
  return {
    queued,
    timers: {
      set: (run: () => void, ms: number) => { queued.set(next, { run, ms }); return next++; },
      clear: (handle: number) => { queued.delete(handle); },
    },
    fireAll() {
      const due = [...queued.entries()];
      queued.clear();
      due.forEach(([, { run }]) => run());
    },
  };
}

test("each failure waits longer, then the backoff stops and leaves manual retry", () => {
  const clock = fakeTimers();
  const backoff = createRetryBackoff([3_000, 10_000, 30_000], clock.timers);
  let runs = 0;
  const fail = () => { runs += 1; return backoff.schedule("a", fail); };
  const waits: number[] = [];
  assert.equal(backoff.schedule("a", fail), true);
  for (let round = 0; round < 5 && clock.queued.size; round += 1) {
    waits.push(...[...clock.queued.values()].map(({ ms }) => ms));
    clock.fireAll();
  }
  assert.deepEqual(waits, [3_000, 10_000, 30_000]);
  assert.equal(runs, 3);
  assert.equal(backoff.scheduled("a"), false);
  assert.equal(backoff.schedule("a", fail), false, "exhausted until something resets it");
});

test("a newer edit or success cancels the queued attempt and starts the count over", () => {
  const clock = fakeTimers();
  const backoff = createRetryBackoff([3_000, 10_000], clock.timers);
  let stale = 0;
  backoff.schedule("a", () => { stale += 1; });
  assert.equal(backoff.scheduled("a"), true);
  backoff.reset("a");
  clock.fireAll();
  assert.equal(stale, 0, "the superseded save is never resent");
  backoff.schedule("a", () => {});
  assert.deepEqual([...clock.queued.values()].map(({ ms }) => ms), [3_000]);
});

test("keys back off independently and resetAll cancels everything on unmount", () => {
  const clock = fakeTimers();
  const backoff = createRetryBackoff([3_000, 10_000], clock.timers);
  let fired = 0;
  backoff.schedule("a", () => { fired += 1; });
  backoff.schedule("b", () => { fired += 1; });
  backoff.schedule("b", () => { fired += 1; });
  assert.deepEqual([...clock.queued.values()].map(({ ms }) => ms).sort(), [10_000, 3_000].sort());
  backoff.resetAll();
  clock.fireAll();
  assert.equal(fired, 0);
});
