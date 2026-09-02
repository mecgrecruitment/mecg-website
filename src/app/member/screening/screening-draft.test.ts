import assert from "node:assert/strict";
import test from "node:test";
import { parseScreeningDraft, parseScreeningProgress, screeningDeadlineLabel } from "./screening-draft";

const draft = {
  ratings: [
    { criterionId: "motivation", score: "5", note: "Specific example" },
    { criterionId: "judgment", score: "", note: "" },
  ],
  evidence: "",
  recommendation: "",
};

test("accepts partial private screening drafts", () => {
  assert.deepEqual(parseScreeningDraft(draft), draft);
});

test("rejects duplicate criteria, invalid scores, and overlong evidence", () => {
  assert.equal(parseScreeningDraft({ ...draft, ratings: [draft.ratings[0], draft.ratings[0]] }), null);
  assert.equal(parseScreeningDraft({ ...draft, ratings: [{ criterionId: "x", score: "6", note: "" }] }), null);
  assert.equal(parseScreeningDraft({ ...draft, evidence: "x".repeat(6001) }), null);
});

test("validates reviewer-only progress and formats its deadline", () => {
  assert.deepEqual(parseScreeningProgress({ completed: 2, total: 5, deadline: null, publishedAt: null }), {
    completed: 2,
    total: 5,
    deadline: null,
    publishedAt: null,
  });
  assert.equal(parseScreeningProgress({ completed: 6, total: 5, deadline: null, publishedAt: null }), null);
  assert.equal(screeningDeadlineLabel(null), "No deadline is set");
  assert.match(screeningDeadlineLabel("2026-09-08T22:00:00Z"), /^Due /);
});
