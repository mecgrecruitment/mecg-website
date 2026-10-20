export type RoundCloseSummary = {
  roundId: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  checkedAt: string;
  applicants: number;
  applicantsReady: number;
  applicantsIncomplete: number;
  submittedEvaluations: number;
  validEvaluations: number;
  openAssignments: number;
};

// The RPC and HTTP response are external JSON boundaries. Never turn an
// unavailable or malformed count into zero in an irreversible-action review.
export function parseRoundCloseSummary(value: unknown): RoundCloseSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("roundId" in value) || typeof value.roundId !== "string" || !value.roundId) return null;
  if (!("roundStatus" in value)) return null;
  const roundStatus = value.roundStatus;
  if (roundStatus !== "DRAFT" && roundStatus !== "PUBLISHED" && roundStatus !== "ACTIVE" && roundStatus !== "FROZEN" && roundStatus !== "FINALIZED" && roundStatus !== "ARCHIVED") return null;
  if (!("checkedAt" in value) || typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))) return null;
  const count = (key: string) => {
    const item = Reflect.get(value, key);
    return typeof item === "number" && Number.isSafeInteger(item) && item >= 0 ? item : null;
  };
  const applicants = count("applicants");
  const applicantsReady = count("applicantsReady");
  const applicantsIncomplete = count("applicantsIncomplete");
  const submittedEvaluations = count("submittedEvaluations");
  const validEvaluations = count("validEvaluations");
  const openAssignments = count("openAssignments");
  if (applicants === null || applicantsReady === null || applicantsIncomplete === null || submittedEvaluations === null || validEvaluations === null || openAssignments === null) return null;
  if (applicantsReady + applicantsIncomplete !== applicants || validEvaluations > submittedEvaluations || applicantsReady * 2 > validEvaluations) return null;
  return { roundId: value.roundId, roundStatus, checkedAt: value.checkedAt, applicants, applicantsReady, applicantsIncomplete, submittedEvaluations, validEvaluations, openAssignments };
}
