import {
  DECIDED_PIPELINE_STATUSES,
  isPipelineStatus,
  legalManualApplicationStatuses,
  type PipelineStatus,
} from "@/lib/workflow";

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
