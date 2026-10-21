export type PendingNote = { timer: number; score: number; note: string };

// Sends every debounced note now instead of letting the timer fire, so leaving
// the page or the roster never drops a note typed in the last moment.
export function flushPendingNotes(
  pending: Record<string, PendingNote>,
  send: (applicationId: string, score: number, note: string) => void,
  clear: (timer: number) => void = (timer) => window.clearTimeout(timer),
) {
  for (const [applicationId, { timer, score, note }] of Object.entries(pending)) {
    clear(timer);
    delete pending[applicationId];
    send(applicationId, score, note);
  }
}
