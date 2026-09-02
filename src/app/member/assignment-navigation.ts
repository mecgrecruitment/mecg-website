export function evaluationTaskHref(assignmentId: string) {
  const encodedId = encodeURIComponent(assignmentId);
  return `/member?assignment=${encodedId}#assignment-${encodedId}`;
}

export function selectedEvaluationAssignment(
  eligibleAssignmentIds: readonly string[],
  requestedAssignmentId?: string,
) {
  return requestedAssignmentId && eligibleAssignmentIds.includes(requestedAssignmentId)
    ? requestedAssignmentId
    : eligibleAssignmentIds[0];
}
