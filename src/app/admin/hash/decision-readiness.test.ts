import assert from "node:assert/strict";
import test from "node:test";
import { applicantReadinessIssues, cycleReadinessIssues, type DecisionRoundEvidence } from "./decision-readiness";

const readyRound: DecisionRoundEvidence = {
  id: "round-1",
  name: "Quick chats",
  status: "FROZEN",
  weight: 1,
  lockedEvaluations: 2,
  aggregateStatus: "READY",
  spread: 4,
};

test("cycle readiness names missing and open rounds", () => {
  assert.deepEqual(cycleReadinessIssues("IN_PROCESS", [{ ...readyRound, status: "ACTIVE" }]).map((issue) => issue.key), ["cycle", "round-round-1"]);
  assert.deepEqual(cycleReadinessIssues("DECISION_LOCK", [] as DecisionRoundEvidence[]).map((issue) => issue.key), ["rounds"]);
});

test("applicant readiness requires two locked evaluations in every weighted round", () => {
  const result = applicantReadinessIssues([
    readyRound,
    { ...readyRound, id: "round-2", name: "Group case", lockedEvaluations: 1 },
  ]);

  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.label), ["Group case needs 1 more locked evaluation."]);
});

test("score spread is review evidence but does not block a database-ready decision", () => {
  const result = applicantReadinessIssues([{ ...readyRound, aggregateStatus: "REVIEW", spread: 22 }], true);

  assert.equal(result.ready, true);
  assert.deepEqual(result.issues, [{ key: "spread-round-1", kind: "review", label: "Quick chats has a wide score spread (22)." }]);
});

test("speed dating spread is not review evidence", () => {
  const result = applicantReadinessIssues([{ ...readyRound, kind: "SPEED_DATING", aggregateStatus: "REVIEW", spread: 50 }], true);

  assert.deepEqual(result.issues, []);
});

test("canonical readiness can block when visible evidence appears complete", () => {
  const result = applicantReadinessIssues([readyRound], false);

  assert.equal(result.ready, false);
  assert.equal(result.issues.at(-1)?.key, "canonical");
});
