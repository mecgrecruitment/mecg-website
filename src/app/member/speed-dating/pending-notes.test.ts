import assert from "node:assert/strict";
import test from "node:test";
import { flushPendingNotes, type PendingNote } from "./pending-notes";

test("sends each pending note once with its score and cancels its timer", () => {
  const pending: Record<string, PendingNote> = {
    "app-1": { timer: 11, score: 4, note: "Sharp answers" },
    "app-2": { timer: 12, score: 2, note: "" },
  };
  const sent: Array<[string, number, string]> = [];
  const cleared: number[] = [];
  flushPendingNotes(pending, (...args) => sent.push(args), (timer) => cleared.push(timer));
  assert.deepEqual(sent, [["app-1", 4, "Sharp answers"], ["app-2", 2, ""]]);
  assert.deepEqual(cleared, [11, 12]);

  flushPendingNotes(pending, (...args) => sent.push(args), (timer) => cleared.push(timer));
  assert.equal(sent.length, 2, "a second flush (unmount after pagehide) sends nothing again");
});
