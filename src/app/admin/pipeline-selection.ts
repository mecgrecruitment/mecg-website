import type { PipelineStatus } from "@/lib/workflow";

type Applicant = { id: string; name: string; status: PipelineStatus };

export function canSelectForAdvancement(status: PipelineStatus) {
  return status === "ELIGIBLE" || status === "INVITED" || status === "GROUP_CASE" || status === "IN_PROCESS";
}

// Copy the reviewed identity and visibility, so later filters or source refreshes
// cannot silently change the cohort the operator is confirming.
export function snapshotAdvancement(applications: readonly Applicant[], ids: ReadonlySet<string>, visibleIds: ReadonlySet<string>) {
  return applications.filter((application) => ids.has(application.id)).map((application) => ({
    id: application.id,
    name: application.name,
    hidden: !visibleIds.has(application.id),
  }));
}


export function advancementReceipt(value: unknown, selectedApplications: number) {
  if (!value || typeof value !== "object" || !("id" in value) || !value.id || typeof value.id !== "object") return null;
  const receipt = value.id;
  if (!("roundId" in receipt) || typeof receipt.roundId !== "string" || !receipt.roundId.trim()
    || !("selectedApplications" in receipt) || receipt.selectedApplications !== selectedApplications
    || !("newAssignments" in receipt) || typeof receipt.newAssignments !== "number" || !Number.isSafeInteger(receipt.newAssignments) || receipt.newAssignments < 0
    || !("notificationsEnqueued" in receipt) || typeof receipt.notificationsEnqueued !== "number" || !Number.isSafeInteger(receipt.notificationsEnqueued) || receipt.notificationsEnqueued < 0) return null;
  return { newAssignments: receipt.newAssignments, notificationsEnqueued: receipt.notificationsEnqueued };
}
