// Outcome → next-step copy. Keep short; tell the applicant what to do.
// Shared by the phrase-entry form (app/apply/checkin/actions.ts) and the
// QR-scan route (app/apply/checkin/[code]/page.tsx) so both paths through
// check_in_by_phrase show identical messaging.
export const CHECKIN_MESSAGES: Record<string, string> = {
  ok: "Checked in. You're on the open-rush list for this event.",
  invalid:
    "That code didn't match an open rush event. Ask a recruiter for today's phrase, then try again.",
  duplicate: "You're already checked in for that event — nothing else to do.",
  unauthenticated: "Your session expired. Log in again, then enter the event phrase.",
};
