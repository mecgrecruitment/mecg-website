export type ApplicantStatusRefreshConditions = {
  hidden: boolean;
  online: boolean;
  pendingActions: number;
  refreshing: boolean;
};

export function canRefreshApplicantStatus({
  hidden,
  online,
  pendingActions,
  refreshing,
}: ApplicantStatusRefreshConditions) {
  return !hidden && online && pendingActions === 0 && !refreshing;
}

export function formatLastChecked(lastCheckedAt: number, now: number) {
  const elapsedMinutes = Math.max(0, Math.floor((now - lastCheckedAt) / 60_000));
  if (elapsedMinutes === 0) return "Last checked just now.";
  if (elapsedMinutes === 1) return "Last checked 1 minute ago.";
  return `Last checked ${elapsedMinutes} minutes ago.`;
}
