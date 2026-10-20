export function parseApplicationSubmissionReceipt(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("applicationId" in value)) return null;
  const id = value.applicationId;
  return typeof id === "string" && id.length > 0 && id.length <= 100 && id.trim() === id ? id : null;
}

export function confirmedApplicationSubmission(value: unknown, cycleId: string): string | null {
  if (!value || typeof value !== "object" || !("cycleId" in value) || value.cycleId !== cycleId || !("submitted" in value) || value.submitted !== true) return null;
  return parseApplicationSubmissionReceipt(value);
}
