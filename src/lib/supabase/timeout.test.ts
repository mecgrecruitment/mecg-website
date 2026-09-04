import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { SUPABASE_TIMEOUT_MS, withDeadline } from "./timeout.ts";

test("a query with no signal of its own still gets a deadline", async () => {
  const signal = withDeadline(undefined, 5);
  assert.equal(signal.aborted, false);
  await delay(20);
  assert.equal(signal.aborted, true);
  assert.equal((signal.reason as Error).name, "TimeoutError");
});

test("an explicit abortSignal is not clobbered: either source aborts the query", async () => {
  // The health and operations probes pass their own 2s signal through
  // .abortSignal(), so the wrapper has to combine rather than replace.
  const caller = new AbortController();
  const combined = withDeadline(caller.signal, SUPABASE_TIMEOUT_MS);
  assert.equal(combined.aborted, false);
  caller.abort(new Error("probe gave up first"));
  assert.equal(combined.aborted, true);
  assert.equal((combined.reason as Error).message, "probe gave up first");

  const patient = new AbortController();
  const timedOut = withDeadline(patient.signal, 5);
  await delay(20);
  assert.equal(timedOut.aborted, true);
  assert.equal((timedOut.reason as Error).name, "TimeoutError");
});
