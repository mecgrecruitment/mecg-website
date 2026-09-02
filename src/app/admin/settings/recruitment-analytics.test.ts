import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseRecruitmentAnalytics } from "./recruitment-analytics";

const valid = {
  available: true,
  minimumCohort: 5,
  advisoryOnly: true,
  funnel: [{ key: "submitted", label: "Submitted", count: 20 }],
  rounds: [{ roundName: "Quick chats", assigned: 40, completed: 38, applicantCount: 20, completionRate: 95 }],
  workload: { suppressed: false, evaluatorCount: 8, medianAssignments: 5, buckets: [{ label: "5–9", evaluatorCount: 8 }] },
  criteria: [{ roundName: "Quick chats", criterionName: "Curiosity", ratingCount: 38, suppressed: false, average: 4.1, spread: 0.7 }],
  evaluatorSignals: { suppressed: false, evaluatorCount: 6, medianConsistency: 0.5, medianAbsoluteDrift: 0.2, highVarianceCount: 1, highDriftCount: 0 },
};

test("parses aggregate analytics without accepting identity fields", () => {
  const parsed = parseRecruitmentAnalytics(valid);
  assert.equal(parsed?.available, true);
  assert.deepEqual(parsed?.funnel, [{ key: "submitted", label: "Submitted", count: 20 }]);
  assert.equal("evaluatorId" in (parsed?.evaluatorSignals ?? {}), false);
});

test("normalizes the pre-close response to an unavailable panel", () => {
  const parsed = parseRecruitmentAnalytics({ available: false, minimumCohort: 5 });
  assert.equal(parsed?.available, false);
  assert.deepEqual(parsed?.criteria, []);
});

test("rejects partial or malformed aggregate payloads", () => {
  assert.equal(parseRecruitmentAnalytics({ ...valid, rounds: [{ roundName: "Quick chats", assigned: "40" }] }), null);
  assert.equal(parseRecruitmentAnalytics({ ...valid, evaluatorSignals: { suppressed: false, evaluatorCount: -1 } }), null);
  assert.equal(parseRecruitmentAnalytics({ ...valid, workload: { suppressed: false, evaluatorCount: 8 } }), null);
});

test("database analytics stay Board or Owner gated and omit identity keys", () => {
  const migration = readFileSync(new URL("../../../../supabase/migrations/20260902350000_recruitment_analytics.sql", import.meta.url), "utf8");
  assert.match(migration, /has_cycle_role\(target_cycle_id, array\['BOARD','OWNER'\]/);
  assert.doesNotMatch(migration, /'(?:applicant|evaluator|reviewer)(?:Id|Name)'/);
  assert.match(migration, /minimum_cohort constant integer := 5/);
});
