import assert from "node:assert/strict";
import test from "node:test";
import { evaluationTaskHref, selectedEvaluationAssignment } from "./assignment-navigation";

test("evaluation task links identify and target the exact assignment", () => {
  assert.equal(
    evaluationTaskHref("assignment 2"),
    "/member?assignment=assignment%202#assignment-assignment%202",
  );
});

test("evaluation task links preserve the active round queue", () => {
  assert.equal(
    evaluationTaskHref("assignment 2", "GROUP_CASE"),
    "/member?assignment=assignment%202&round=GROUP_CASE#assignment-assignment%202",
  );
});

test("a requested eligible assignment is selected instead of the first assignment", () => {
  assert.equal(
    selectedEvaluationAssignment(["assignment-1", "assignment-2"], "assignment-2"),
    "assignment-2",
  );
});

test("an unknown assignment cannot open work outside the eligible list", () => {
  assert.equal(
    selectedEvaluationAssignment(["assignment-1", "assignment-2"], "assignment-3"),
    "assignment-1",
  );
});
