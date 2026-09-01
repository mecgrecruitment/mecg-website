import { createHash } from "node:crypto";

/**
 * Deterministic pseudonym for an applicant, shown to PANEL-only Hash viewers instead
 * of the real name. Mirrors the pattern blind screening already uses for
 * `candidate_code` (`'Applicant '||upper(substr(digest(...),1,6))` in
 * `20260824160000_blind_screening.sql`), computed here in TypeScript because Hash has
 * no packet table to persist a code in.
 */
export function applicantCode(applicationId: string) {
  return `Applicant ${createHash("sha256").update(applicationId).digest("hex").slice(0, 6).toUpperCase()}`;
}
