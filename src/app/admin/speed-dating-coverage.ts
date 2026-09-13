export type SpeedDatingApplicantCoverage = {
  applicationId: string;
  name: string;
  groups: number;
  evaluatorsSubmitted: number;
};

export function speedDatingApplicantCoverage(
  participants: readonly { applicationId: string; name: string }[],
  pairs: readonly { applicationIds: readonly string[]; createdBy: string; submittedAt: string | null }[],
): SpeedDatingApplicantCoverage[] {
  return participants.map((participant) => {
    const mine = pairs.filter((pair) => pair.applicationIds.includes(participant.applicationId));
    return {
      applicationId: participant.applicationId,
      name: participant.name,
      groups: mine.length,
      evaluatorsSubmitted: new Set(mine.filter((pair) => pair.submittedAt).map((pair) => pair.createdBy)).size,
    };
  });
}
