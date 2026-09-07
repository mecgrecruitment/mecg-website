export function evaluationTaskHref(assignmentId: string, roundKind?: "SPEED_DATING" | "GROUP_CASE") {
  const encodedId = encodeURIComponent(assignmentId);
  const roundQuery = roundKind ? `&round=${roundKind}` : "";
  return `/member?assignment=${encodedId}${roundQuery}#assignment-${encodedId}`;
}

export function selectedEvaluationAssignment(
  eligibleAssignmentIds: readonly string[],
  requestedAssignmentId?: string,
) {
  return requestedAssignmentId && eligibleAssignmentIds.includes(requestedAssignmentId)
    ? requestedAssignmentId
    : eligibleAssignmentIds[0];
}
