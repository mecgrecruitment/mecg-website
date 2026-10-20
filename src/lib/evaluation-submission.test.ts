import test from "node:test";
import assert from "node:assert/strict";
import { evaluationSubmissionResult } from "./evaluation-submission";

test("only an accepted submission with an evaluation receipt permits draft cleanup", () => {
  assert.deepEqual(evaluationSubmissionResult(201, { id: "evaluation-1", score: 75 }), { kind: "submitted", evaluationId: "evaluation-1" });
  for (const body of [null, {}, { id: "" }, { id: " " }, { id: 1 }]) {
    assert.equal(evaluationSubmissionResult(201, body).kind, "unconfirmed");
  }
});

test("all conflict responses retain work, including ambiguous retry and closed-assignment failures", () => {
  for (const body of [{ error: "assignment closed" }, { error: "rubric missing" }, { error: "already submitted" }, { id: "evaluation-1" }, null]) {
    const result = evaluationSubmissionResult(409, body);
    assert.equal(result.kind, "unconfirmed");
    if (result.kind === "unconfirmed") assert.match(result.message, /Refresh My work/);
  }
});

test("failed authorization, validation, and service responses never become receipts", () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    assert.equal(evaluationSubmissionResult(status, { id: "evaluation-1" }).kind, "unconfirmed");
  }
  assert.deepEqual(evaluationSubmissionResult(400, { error: "Add an evidence note" }), { kind: "unconfirmed", message: "Add an evidence note" });
});


test("unknown successful and service receipts never assert that the assignment is still open", () => {
  for (const status of [200, 201, 409, 500, 503]) {
    const result = evaluationSubmissionResult(status, { error: "Unconfirmed response" });
    assert.equal(result.kind, "unconfirmed");
    if (result.kind === "unconfirmed") {
      assert.match(result.message, /may already be locked/);
      assert.doesNotMatch(result.message, /draft remains open/);
    }
  }
});
