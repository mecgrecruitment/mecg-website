import type { Database } from "@/lib/supabase/database.types";

type Outcome = Database["rush"]["Enums"]["decision_outcome"];
export const RELEASE_REASONS = {
  ACTOR_CONFLICT: "You are recused. Ask another unconflicted panel member to review and release this outcome.",
  APPLICATION_WITHDRAWN: "The applicant withdrew. Keep the outcome unreleased; review the dossier with the recruitment lead.",
  EVIDENCE_NOT_READY: "Review the applicant dossier and round results for missing valid independent evidence. If grading is still open, collect the missing observations before freezing. If a required round is already closed, ask the recruitment owner to review the case through the Board-approved remediation process; the outcome stays blocked.",
  APPROVALS_REQUIRED: "Two active, unconflicted panel approvals are required. Review approvals in the dossier, then review release again.",
  DECISION_NOT_LOCKED: "The outcome is no longer locked. Review the current recommendation and approvals before retrying.",
  DECISION_MISSING: "The decision is unavailable. Refresh the board and review the applicant dossier.",
  RELEASE_FORBIDDEN: "Your release permission changed. Ask the recruitment owner to check access before retrying.",
  RELEASE_FAILED: "This outcome was not released. Ask the recruitment owner to investigate the failed release, then review and retry. Other outcomes may have succeeded.",
} satisfies Record<string, string>;
export type ReleaseReason = keyof typeof RELEASE_REASONS;
export type ReleaseItem = { decisionId: string; applicationId: string; outcome: Outcome; reasonCode: ReleaseReason | null };
export type ReleaseReport = { released: number; skipped: number; items: ReleaseItem[] };

function parseItems(value: unknown): ReleaseItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: ReleaseItem[] = [];
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const { decisionId, applicationId, outcome, reasonCode } = row;
    if (typeof decisionId !== "string" || !decisionId || typeof applicationId !== "string" || !applicationId || ids.has(decisionId)) return null;
    if (outcome !== "OFFER" && outcome !== "WAITLIST" && outcome !== "REJECT" && outcome !== "PROCEDURAL_REVIEW") return null;
    if (reasonCode !== null && !(typeof reasonCode === "string" && Object.hasOwn(RELEASE_REASONS, reasonCode))) return null;
    // Object.hasOwn validates membership at the external JSON boundary.
    items.push({ decisionId, applicationId, outcome, reasonCode: reasonCode as ReleaseReason | null });
    ids.add(decisionId);
  }
  return items;
}
export function parseReleasePreflight(value: unknown): ReleaseItem[] | null {
  if (!value || typeof value !== "object" || !("items" in value)) return null;
  return parseItems(value.items);
}
export function parseReleaseReport(value: unknown): ReleaseReport | null {
  if (!value || typeof value !== "object" || !("released" in value) || !("skipped" in value) || !("items" in value)) return null;
  const { released, skipped } = value;
  const items = parseItems(value.items);
  if (!items || typeof released !== "number" || typeof skipped !== "number" || !Number.isSafeInteger(released) || !Number.isSafeInteger(skipped) || released < 0 || skipped < 0) return null;
  if (released !== items.filter((item) => item.reasonCode === null).length || released + skipped !== items.length) return null;
  return { released, skipped, items };
}
export function releaseSnapshot(items: ReleaseItem[]) {
  return items.map(({ decisionId, outcome, reasonCode }) => ({ decisionId, outcome, reasonCode }));
}
export function parseReleaseSnapshot(value: unknown): ReturnType<typeof releaseSnapshot> | null {
  if (!Array.isArray(value)) return null;
  // Reuse the response boundary's identity/outcome/reason validation.
  const items = parseItems(value.map((row: unknown) => row && typeof row === "object" && !Array.isArray(row) ? { ...row, applicationId: "snapshot" } : row));
  return items ? releaseSnapshot(items) : null;
}

// Hashing stays on the server. The client receives only validated display codes.
export type LabeledReleaseItem = ReleaseItem & { applicantLabel: string };
export function labelReleaseItems(items: ReleaseItem[], value: unknown): LabeledReleaseItem[] | null {
  if (!value || typeof value !== "object" || !("applicantLabels" in value)) return null;
  const labels = value.applicantLabels;
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return null;
  const result: LabeledReleaseItem[] = [];
  for (const item of items) {
    const label = Reflect.get(labels, item.applicationId);
    if (typeof label !== "string" || !/^Applicant [0-9A-F]{6}$/.test(label)) return null;
    result.push({ ...item, applicantLabel: label });
  }
  return result;
}


export type ReleaseViewFilters = { query: string; eligibility: "ALL" | "ELIGIBLE" | "BLOCKED"; outcome: Outcome | "ALL" };
export function filterReleaseItems(items: readonly LabeledReleaseItem[], filters: ReleaseViewFilters) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => (!query || item.applicantLabel.toLowerCase().includes(query))
    && (filters.eligibility === "ALL" || (filters.eligibility === "ELIGIBLE" ? item.reasonCode === null : item.reasonCode !== null))
    && (filters.outcome === "ALL" || item.outcome === filters.outcome));
}
