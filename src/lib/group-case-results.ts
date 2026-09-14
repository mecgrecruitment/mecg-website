// Light shape check for the group_case_results RPC; the table component owns the full type.
export function isGroupCaseResults(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.roundId === "string"
    && typeof record.roundName === "string"
    && Boolean(record.summary) && typeof record.summary === "object" && !Array.isArray(record.summary)
    && Array.isArray(record.criteria)
    && Array.isArray(record.applicants)
    && Array.isArray(record.graders);
}
