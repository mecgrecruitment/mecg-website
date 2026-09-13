import test from "node:test";
import assert from "node:assert/strict";
import { speedDatingApplicantCoverage } from "./speed-dating-coverage";

test("applicant coverage counts groups and distinct submitting evaluators", () => {
  const participants = [
    { applicationId: "app-1", name: "Ada" },
    { applicationId: "app-2", name: "Ben" },
    { applicationId: "app-3", name: "Cy" },
  ];
  const rows = speedDatingApplicantCoverage(participants, [
    { applicationIds: ["app-1", "app-2"], createdBy: "judge-1", submittedAt: "2026-09-13T01:00:00Z" },
    { applicationIds: ["app-1", "app-3"], createdBy: "judge-2", submittedAt: "2026-09-13T01:10:00Z" },
    { applicationIds: ["app-1", "app-2", "app-3"], createdBy: "judge-1", submittedAt: "2026-09-13T01:20:00Z" },
    { applicationIds: ["app-2", "app-3"], createdBy: "judge-3", submittedAt: null },
  ]);
  assert.deepEqual(rows, [
    { applicationId: "app-1", name: "Ada", groups: 3, evaluatorsSubmitted: 2 },
    { applicationId: "app-2", name: "Ben", groups: 3, evaluatorsSubmitted: 1 },
    { applicationId: "app-3", name: "Cy", groups: 3, evaluatorsSubmitted: 2 },
  ]);
});
