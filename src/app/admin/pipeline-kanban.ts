import {
  DECIDED_PIPELINE_STATUSES,
  isPipelineStatus,
  legalManualApplicationStatuses,
  type PipelineStatus,
} from "@/lib/workflow";

// `grid-cols-1` is the mobile layout. It must be cleared when the board switches
// to column auto-flow, otherwise the explicit first track collapses and its
// stage content paints over the first generated column.
export const KANBAN_TRACK_CLASS_NAME = "scroll-cue mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-[minmax(240px,280px)] sm:overflow-x-auto sm:pb-2";

// INVITED is an advancement, gated on MANAGE_CYCLE, so committee users
// (canOperate without canAdvance) never get it as a destination.
export function kanbanDropStatuses(status: PipelineStatus, canAdvance = true): PipelineStatus[] {
  return legalManualApplicationStatuses(status).filter(
    (candidate): candidate is PipelineStatus =>
      isPipelineStatus(candidate)
      && !DECIDED_PIPELINE_STATUSES.has(candidate)
      && (canAdvance || candidate !== "INVITED"),
  );
}

export function canMoveApplication(from: PipelineStatus, to: string, canAdvance = true): to is PipelineStatus {
  return to !== from && isPipelineStatus(to) && kanbanDropStatuses(from, canAdvance).includes(to);
}

export function moveApplicationInBoard<T extends { id: string; status: PipelineStatus }>(
  applications: T[],
  applicationId: string,
  status: PipelineStatus,
): T[] {
  return applications.map((application) =>
    application.id === applicationId ? { ...application, status } : application,
  );
}

// INVITED means enrolled in Speed Dating with evaluators, so that move goes
// through ADVANCE_SPEED_DATING; a plain status flip is refused by the RPC.
export function moveApplicationRequest(cycleId: string, applicationId: string, status: PipelineStatus) {
  return status === "INVITED"
    ? { action: "ADVANCE_SPEED_DATING" as const, cycleId, applicationIds: [applicationId] }
    : { action: "SET_APPLICATION_STATUS" as const, cycleId, applicationId, status };
}
