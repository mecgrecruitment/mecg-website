import assert from "node:assert/strict";
import test from "node:test";
import type { GroupCaseResults } from "@/lib/group-case-results";
import { countsTowardCoverage, groupCaseCoverageRank, groupCaseCoverageState, groupCaseEvidenceState, groupCaseStaffingLabel } from "./group-case-coverage";

test("recused and missed assignments do not count as Group Case coverage", () => {
  assert.equal(countsTowardCoverage("RECUSED"), false);
  assert.equal(countsTowardCoverage("MISSED"), false);
  assert.deepEqual(groupCaseCoverageState(["RECUSED", "MISSED"]), {
    assigned: 0,
    submitted: 0,
    state: "UNASSIGNED",
  });
});

test("one usable assignment is partial and two open assignments are in progress", () => {
  assert.equal(groupCaseCoverageState(["ASSIGNED"]).state, "PARTIAL");
  assert.deepEqual(groupCaseCoverageState(["ASSIGNED", "IN_PROGRESS"]), {
    assigned: 2,
    submitted: 0,
    state: "IN_PROGRESS",
  });
});

test("staffing receipt shows both forms submitted without deciding evidence validity", () => {
  assert.deepEqual(groupCaseCoverageState(["SUBMITTED", "LOCKED", "RECUSED"]), {
    assigned: 2,
    submitted: 2,
    state: "SUBMITTED",
  });
  assert.equal(groupCaseCoverageState(["SUBMITTED", "LOCKED", "ASSIGNED"]).state, "IN_PROGRESS");
});

test("coverage ranking puts applicants needing assignment first", () => {
  assert.deepEqual(
    ["SUBMITTED", "IN_PROGRESS", "UNASSIGNED", "PARTIAL"].sort((a, b) =>
      groupCaseCoverageRank(a as Parameters<typeof groupCaseCoverageRank>[0])
      - groupCaseCoverageRank(b as Parameters<typeof groupCaseCoverageRank>[0])),
    ["UNASSIGNED", "PARTIAL", "IN_PROGRESS", "SUBMITTED"],
  );
});

const partialApplicant: GroupCaseResults["applicants"][number] = {
  applicationId: "partial", name: "Partial applicant", status: "GROUP_CASE", groupName: "Team A",
  count: 0, savedCount: 2, completionStatus: "PENDING", mean: null, criterionMeans: {},
  evaluations: ["one", "two"].map((evaluatorId) => ({ evaluatorId, evaluatorName: evaluatorId, weighted: null, valid: false, coverage: 0.25,
    minimumObserved: 3, missingRequired: ["Collaboration"], scoredCount: 1, criteriaCount: 6, scores: {}, note: "Partial observation", submittedAt: "2026-10-16T20:00:00Z" })),
};
function qualifyingApplicant(completionStatus: "REVIEW" | "COMPLETE"): GroupCaseResults["applicants"][number] {
  return { ...partialApplicant, count: 2, savedCount: 2, completionStatus, mean: 50,
    evaluations: partialApplicant.evaluations.map((evaluation) => ({ ...evaluation, valid: true, weighted: 50, coverage: 1, scoredCount: 6, missingRequired: [] })),
  };
}
test("two submitted partial observations still need canonical evidence attention", () => {
  const staffing = groupCaseCoverageState(["SUBMITTED", "SUBMITTED"]);
  assert.equal(groupCaseStaffingLabel(staffing), "All assigned forms submitted");
  const evidence = groupCaseEvidenceState(partialApplicant);
  assert.equal(evidence.state, "incomplete");
  assert.equal(evidence.needsAttention, true);
  assert.match(evidence.detail, /0\/2 valid independent evaluators/);
  assert.match(evidence.detail, /Incomplete weighted coverage/);
  assert.match(evidence.detail, /Missing required: Collaboration/);
});
test("canonical score spread remains attention work even after validity is reached", () => {
  const evidence = groupCaseEvidenceState(qualifyingApplicant("REVIEW"));
  assert.equal(evidence.state, "review");
  assert.equal(evidence.needsAttention, true);
  assert.match(evidence.detail, /Score spread needs review/);
});
test("only canonical completion removes evidence from the attention queue", () => {
  const complete = groupCaseEvidenceState(qualifyingApplicant("COMPLETE"));
  assert.equal(complete.needsAttention, false);
  assert.ok(groupCaseEvidenceState(partialApplicant).rank < complete.rank);
  assert.match(complete.detail, /Freeze and decision checks still apply/);
});
test("restricted or missing canonical evidence never implies completion", () => {
  const unknown = groupCaseEvidenceState(undefined);
  assert.equal(unknown.needsAttention, true);
  assert.equal(unknown.state, "unknown");
  assert.match(unknown.detail, /Ask the Board/);
  assert.equal(groupCaseStaffingLabel(groupCaseCoverageState(["ASSIGNED"])), "0/1 forms submitted · 1/2 evaluators assigned");
});
