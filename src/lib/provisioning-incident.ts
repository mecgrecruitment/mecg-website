import { randomUUID } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { operationalLog } from "@/lib/operational-log";

type ProvisioningFailure = {
  cycleId: string;
  requestedBy: string;
  email: string;
  clerkUserId: string | null;
  appUserId: string | null;
  phase: "CREATE_ACCOUNT" | "IDENTITY_LINK" | "MEMBERSHIP_GRANT";
  clerkCleanupFailed: boolean;
  profileCleanupFailed: boolean;
};

// A definitive client rejection did not create an account. A timeout, transport
// failure or server error cannot prove that, and must be reconciled before retry.
export function creationOutcomeIsUncertain(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return true;
  return typeof error.status !== "number" || !Number.isInteger(error.status) || error.status < 400 || error.status >= 500 || error.status === 408;
}

export async function recordProvisioningFailure(admin: ReturnType<typeof createAdminClient>, input: ProvisioningFailure) {
  const incidentId = randomUUID();
  let recorded = false;
  try {
    const { error } = await admin.from("provisioning_incidents").insert({
      id: incidentId,
      cycle_id: input.cycleId,
      requested_by: input.requestedBy,
      email: input.email,
      clerk_user_id: input.clerkUserId,
      app_user_id: input.appUserId,
      phase: input.phase,
      clerk_cleanup_failed: input.clerkCleanupFailed,
      profile_cleanup_failed: input.profileCleanupFailed,
    });
    recorded = !error;
  } catch {
    // Failure to store remediation details must never fall back to logging PII.
  }
  operationalLog("error", {
    event: "provisioning.review_required",
    requestId: incidentId,
    code: input.phase,
    detail: { recorded, clerkCleanupFailed: input.clerkCleanupFailed, profileCleanupFailed: input.profileCleanupFailed },
  });
  return {
    incidentId,
    remediationRecorded: recorded,
    error: recorded
      ? `Account setup needs owner review before retrying. Open account recovery and use reference ${incidentId}.`
      : `Account setup needs owner review before retrying. Recovery details could not be saved. Keep this form's account details and give the owner reference ${incidentId}.`,
  };
}
