import { parseApplicationDraftSnapshot } from "@/app/apply/application-server-draft";
import type { NextAction } from "./next-action";

export type ApplicationEditAccess = "available" | "unavailable" | "unknown";
export function editableApplicationStatus(application: { display_status: string; released_outcome: string | null }) {
  if (application.released_outcome) return null;
  if (application.display_status === "DRAFT") return {
    kind: "draft" as const,
    label: "Draft · Not submitted",
    headline: "Your application is a draft.",
    detail: "This draft has not been submitted. Saving your work does not submit your application.",
    actionLabel: "Continue application",
  };
  if (application.display_status === "NEEDS_INFO") return {
    kind: "changes-requested" as const,
    label: "Changes requested · Resubmission needed",
    headline: "Your application needs changes.",
    detail: "The Board requested more information. Your application needs to be reviewed and resubmitted.",
    actionLabel: "Review and resubmit",
  };
  return null;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The dashboard has no cycle id. Bind an owned application row to the existing
// intake authority before advertising that /apply can edit this application.
export function applicationEditAccess({ applicationId, intake, ownedApplications }: { applicationId: string; intake: unknown; ownedApplications: unknown }): ApplicationEditAccess {
  if (!record(intake) || typeof intake.open !== "boolean") return "unknown";
  if (!intake.open) return "unavailable";
  if (typeof intake.cycleId !== "string" || !intake.cycleId || typeof intake.needsInfo !== "boolean" || !Array.isArray(ownedApplications)) return "unknown";
  const row: unknown = ownedApplications.find((value: unknown) => record(value) && value.id === applicationId);
  if (!record(row) || typeof row.cycle_id !== "string" || typeof row.status !== "string") return "unknown";
  if (row.cycle_id !== intake.cycleId || !["DRAFT", "NEEDS_INFO"].includes(row.status)) return "unavailable";
  if ((row.status === "NEEDS_INFO") !== intake.needsInfo || !parseApplicationDraftSnapshot(intake.draft)) return "unknown";
  return "available";
}

export function editableApplicationNextAction(status: NonNullable<ReturnType<typeof editableApplicationStatus>>, access: ApplicationEditAccess): NextAction {
  if (access === "available") return {
    eyebrow: status.label,
    title: status.kind === "draft" ? "Finish your application" : "Review and resubmit your application",
    detail: status.kind === "draft" ? "Your draft is saved, but it has not been submitted. Continue to review and submit your application." : "Review the requested changes, then submit your application again while the application window is open.",
    href: "/apply", label: status.actionLabel,
  };
  if (access === "unavailable") return {
    eyebrow: status.label,
    title: "Application editing is unavailable",
    detail: `${status.detail} Editing and submission are not available right now. Contact the recruitment team if you need help with this application.`,
    href: "mailto:mecg-board@umich.edu", label: "Contact recruitment team",
  };
  return {
    eyebrow: status.label,
    title: "Application access could not be verified",
    detail: `${status.detail} We could not verify whether editing and submission are available. Reload this page to retry, or contact the recruitment team.`,
    href: "mailto:mecg-board@umich.edu", label: "Contact recruitment team",
  };
}
