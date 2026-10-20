import type { ReleaseEvidenceReport } from "./release-evidence";

export const releaseEvidenceFixture = {
  applicationId: "synthetic-application", applicationStatus: "FINAL_REVIEW", ready: false, blockers: [],
  rounds: [
    { roundId: "synthetic-closed-round", roundName: "Group Case — synthetic closed round", kind: "GROUP_CASE", status: "FROZEN", validLockedEvaluations: 1, requiredEvaluations: 2, missingRequiredCriteria: ["Evidence-based reasoning", "Clear handoff"], blockers: ["VALID_LOCKED_EVALUATIONS_MISSING"] },
    { roundId: "synthetic-active-round", roundName: "Speed Dating — synthetic active round", kind: "SPEED_DATING", status: "ACTIVE", validLockedEvaluations: 2, requiredEvaluations: 2, missingRequiredCriteria: [], blockers: ["ROUND_NOT_CLOSED"] },
  ],
} satisfies ReleaseEvidenceReport;
