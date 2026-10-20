import assert from "node:assert/strict";
import test from "node:test";
import { evaluationPrerequisites, isGroupCaseResults, roundPrerequisites, type GroupCaseResults } from "./group-case-results.ts";

const noteOnly: GroupCaseResults["applicants"][number]["evaluations"][number] = {
  evaluatorId: "one", evaluatorName: "One", weighted: null, valid: false, coverage: 0, minimumObserved: 3,
  missingRequired: ["Collaboration"], scoredCount: 0, criteriaCount: 6, scores: {}, note: "Only a note", submittedAt: null,
};
const applicant: GroupCaseResults["applicants"][number] = { applicationId: "app", name: "Applicant", status: "GROUP_CASE", groupName: null,
  count: 0, savedCount: 1, completionStatus: "PENDING", mean: null, criterionMeans: {}, evaluations: [noteOnly] };
const results: GroupCaseResults = { roundId: "round", roundName: "Group Case", roundStatus: "ACTIVE", criteria: [],
  summary: { applicants: 1, graded: 0, graders: 1, evaluations: 0, saved: 1, savedEvaluations: 1 }, applicants: [applicant], graders: [] };

test("accepts explicit saved-versus-valid evidence contract", () => assert.equal(isGroupCaseResults(results), true));
test("rejects historical shallow payloads without completeness evidence", () => {
  assert.equal(isGroupCaseResults({ roundId: "round", roundName: "Group Case", criteria: [], summary: {}, applicants: [], graders: [] }), false);
});
test("rejects partial evaluations carrying a full-scale grade", () => {
  assert.equal(isGroupCaseResults({ ...results, applicants: [{ ...applicant, evaluations: [{ ...noteOnly, weighted: 40 }] }] }), false);
});
test("rejects complete labels without two valid evaluators or a mean", () => {
  assert.equal(isGroupCaseResults({ ...results, applicants: [{ ...applicant, completionStatus: "COMPLETE" }] }), false);
});
test("does not call notes complete and names each missing prerequisite", () => {
  assert.match(evaluationPrerequisites(noteOnly), /0% weighted coverage/);
  assert.match(evaluationPrerequisites(noteOnly), /Required: Collaboration/);
  assert.match(evaluationPrerequisites(noteOnly), /Needs 3 observed criteria/);
  assert.match(evaluationPrerequisites(noteOnly), /Needs 75% weighted coverage/);
  assert.doesNotMatch(evaluationPrerequisites(noteOnly), /Valid evaluation/);
  assert.match(roundPrerequisites(applicant), /0\/2 valid independent evaluators/);
  assert.match(roundPrerequisites(applicant), /Missing required: Collaboration/);
});
test("reaching two valid evaluators preserves the remaining decision checks", () => {
  assert.match(roundPrerequisites({ ...applicant, count: 2, savedCount: 2, completionStatus: "COMPLETE", mean: 32 }), /Freeze and decision checks still apply/);
  assert.match(roundPrerequisites({ ...applicant, completionStatus: "REVIEW" }), /Score spread needs review/);
});

test("rejects a complete count manufactured from invalid or duplicate evidence", () => {
  assert.equal(isGroupCaseResults({ ...results, applicants: [{ ...applicant, count: 2, savedCount: 2, completionStatus: "COMPLETE", mean: 40, evaluations: [noteOnly, noteOnly] }] }), false);
});
