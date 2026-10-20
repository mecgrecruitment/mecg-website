import assert from "node:assert/strict";
import test from "node:test";
import { parseGroupCaseWriteRequest, parseGroupCaseWriteResult } from "./group-case-write";
import { isGroupCaseRoster } from "./group-case-roster";
const revision = "22222222-2222-4222-8222-222222222222";
const mutationId = "11111111-1111-4111-8111-111111111111";
const quality = { valid: false, coverage: 0, observedCount: 0, criteriaCount: 1, minimumObserved: 1, missingRequired: ["Reasoning"] };
const request = { roundId: "round", applicationId: "app", scores: { reasoning: null }, note: "Observed listening", expectedRevision: null, mutationId };
const snapshot = { applicationId: "app", scores: request.scores, note: request.note, revision, savedAt: "2026-10-16T20:00:00Z", quality };
const receipt = { ...snapshot, kind: "saved", mutationId };
test("versioned writes preserve exact null scores, note, revision and mutation identity", () => {
  assert.deepEqual(parseGroupCaseWriteRequest(request), request);
  assert.deepEqual(parseGroupCaseWriteRequest({ ...request, expectedRevision: revision }), { ...request, expectedRevision: revision });
  assert.deepEqual(parseGroupCaseWriteResult(receipt), receipt);
  assert.deepEqual(parseGroupCaseWriteResult({ kind: "conflict", snapshot }), { kind: "conflict", snapshot });
});
test("missing or invalid mutation/revision boundaries cannot enter versioned writes", () => {
  for (const patch of [{ mutationId: undefined }, { mutationId: "legacy" }, { expectedRevision: undefined }, { expectedRevision: "legacy" }, { note: undefined }, { scores: {} }, { scores: { reasoning: 6 } }]) assert.equal(parseGroupCaseWriteRequest({ ...request, ...patch }), null);
});
test("legacy, malformed quality and incomplete saved receipts cannot confirm persistence", () => {
  for (const patch of [{ kind: undefined }, { revision: null }, { mutationId: "other" }, { savedAt: "not-a-date" }, { quality: null }, { quality: { ...quality, valid: "yes" } }]) assert.equal(parseGroupCaseWriteResult({ ...receipt, ...patch }), null);
  assert.equal(parseGroupCaseWriteResult({ kind: "conflict", snapshot: { ...snapshot, revision: "invalid" } }), null);
  assert.deepEqual(parseGroupCaseWriteResult({ kind: "conflict", snapshot: { ...snapshot, revision: null, savedAt: null, quality: null } }), { kind: "conflict", snapshot: { ...snapshot, revision: null, savedAt: null, quality: null } });
});
test("roster requires applicant revisions while rubric criteria need no revision field", () => {
  const applicant = { ...snapshot, name: "Synthetic", speedDating: null };
  const roster = { roundId: "round", roundName: "Group case", roundStatus: "ACTIVE", canSeeSpeedDating: false, criteria: [{ id: "reasoning", name: "Reasoning", description: "Observe reasoning", weight: 100, required: true }], progress: { scored: 0, total: 1 }, groups: [{ groupId: null, groupName: "Unassigned", applicants: [applicant] }] };
  assert.equal(isGroupCaseRoster(roster), true);
  for (const badRevision of [undefined, "old-non-uuid", 7]) assert.equal(isGroupCaseRoster({ ...roster, groups: [{ ...roster.groups[0], applicants: [{ ...applicant, revision: badRevision }] }] }), false);
  assert.equal(isGroupCaseRoster({ ...roster, groups: [{ ...roster.groups[0], applicants: [{ ...applicant, revision: null }] }] }), true);
});
