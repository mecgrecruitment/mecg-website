// One dropped poll is normal on venue wifi; two in a row is worth telling the room.
const RECONNECT_AFTER_FAILURES = 2;

export type PollOutcome = "ok" | "signed-out" | "failed";
export type LiveSync = { failures: number; signedOut: boolean };
export type LiveSyncNotice = "session-ended" | "reconnecting" | null;

export const LIVE_SYNC_START: LiveSync = { failures: 0, signedOut: false };

// `status` is null when the request never got a response. authorizedFetch has
// already retried a 401 with a fresh token, so 401 or 403 here means this
// session can no longer read the feed and polling again will not fix it.
export function pollOutcome(status: number | null): PollOutcome {
  if (status === 401 || status === 403) return "signed-out";
  return status !== null && status >= 200 && status < 300 ? "ok" : "failed";
}

export function nextLiveSync(state: LiveSync, outcome: PollOutcome): LiveSync {
  if (outcome === "ok") return LIVE_SYNC_START;
  if (outcome === "signed-out") return { failures: 0, signedOut: true };
  return { ...state, failures: state.failures + 1 };
}

export function liveSyncNotice(state: LiveSync): LiveSyncNotice {
  if (state.signedOut) return "session-ended";
  return state.failures >= RECONNECT_AFTER_FAILURES ? "reconnecting" : null;
}
