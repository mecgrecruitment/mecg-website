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

export function kanbanDropStatuses(status: PipelineStatus): PipelineStatus[] {
  return legalManualApplicationStatuses(status).filter(
    (candidate): candidate is PipelineStatus =>
      isPipelineStatus(candidate) && !DECIDED_PIPELINE_STATUSES.has(candidate),
  );
}

export function canMoveApplication(from: PipelineStatus, to: string): to is PipelineStatus {
  return to !== from && isPipelineStatus(to) && kanbanDropStatuses(from).includes(to);
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
