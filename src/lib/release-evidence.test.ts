import assert from "node:assert/strict";
import test from "node:test";
import { parseReleaseEvidence, releaseEvidenceHref } from "./release-evidence";
import { releaseEvidenceFixture } from "./release-evidence-fixture";

test("release diagnostics retain actual round blockers and missing criteria without implying readiness", () => {
  assert.deepEqual(parseReleaseEvidence(releaseEvidenceFixture), releaseEvidenceFixture);
  assert.equal(releaseEvidenceHref("application/id", "older cycle"), "/admin/applications/application%2Fid/release-evidence?cycleId=older%20cycle");
});
test("only internally consistent canonical reports can claim evidence readiness", () => {
  const ready = { ...releaseEvidenceFixture, ready: true, rounds: releaseEvidenceFixture.rounds.map((round) => ({ ...round, status: "FINALIZED", validLockedEvaluations: 2, blockers: [] })) };
  assert.equal(parseReleaseEvidence(ready)?.ready, true);
  for (const invalid of [
    { ...releaseEvidenceFixture, ready: true },
    { ...ready, ready: false },
    { ...ready, rounds: [{ ...ready.rounds[0], validLockedEvaluations: 1 }] },
    { ...ready, rounds: [{ ...ready.rounds[0], status: "ACTIVE" }] },
  ]) assert.equal(parseReleaseEvidence(invalid), null);
});
test("missing required rounds and ineligible applications remain explicit blockers", () => {
  assert.equal(parseReleaseEvidence({ ...releaseEvidenceFixture, rounds: [], blockers: ["NO_REQUIRED_ROUNDS"] })?.ready, false);
  assert.equal(parseReleaseEvidence({ ...releaseEvidenceFixture, applicationStatus: "WITHDRAWN", blockers: ["APPLICATION_INELIGIBLE"] })?.ready, false);
  assert.equal(parseReleaseEvidence({ ...releaseEvidenceFixture, applicationStatus: "WITHDRAWN" }), null);
  assert.equal(parseReleaseEvidence({ ...releaseEvidenceFixture, rounds: [] }), null);
});
test("partial, malformed, duplicate and unknown diagnostic rows fail closed", () => {
  const round = releaseEvidenceFixture.rounds[0];
  for (const invalid of [null, {}, { ...releaseEvidenceFixture, rounds: null },
    { ...releaseEvidenceFixture, applicationStatus: "UNKNOWN" },
    { ...releaseEvidenceFixture, blockers: ["SQL_PROVIDER_ERROR"] },
    ...[{ ...round, validLockedEvaluations: -1 }, { ...round, validLockedEvaluations: 1.5 }, { ...round, requiredEvaluations: 1 }, { ...round, status: "UNKNOWN" }, { ...round, missingRequiredCriteria: [null] }, { ...round, blockers: [] }, { ...round, blockers: ["UNKNOWN"] }].map((row) => ({ ...releaseEvidenceFixture, rounds: [row] })),
    { ...releaseEvidenceFixture, rounds: [round, round] },
  ]) assert.equal(parseReleaseEvidence(invalid), null);
});
