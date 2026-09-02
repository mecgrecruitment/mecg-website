import assert from "node:assert/strict";
import test from "node:test";
import { summarizeEventObservations } from "./observation-summary";

test("summarizes event observations without a numeric score", () => {
  const summaries = summarizeEventObservations([
    { applicationId: "app-1", tags: ["Curious", "Clear communicator"], note: "Asked a thoughtful question." },
    { applicationId: "app-1", tags: ["Curious"], note: "  " },
    { applicationId: "app-2", tags: [], note: "Followed up after the event." },
  ]);

  assert.deepEqual(summaries.get("app-1"), {
    count: 2,
    topTags: ["Curious", "Clear communicator"],
    notes: ["Asked a thoughtful question."],
  });
  assert.deepEqual(summaries.get("app-2"), {
    count: 1,
    topTags: [],
    notes: ["Followed up after the event."],
  });
});
