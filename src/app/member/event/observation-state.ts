// Only an explicit database closure response establishes that the window closed.
export function observationFailure(error: { code?: string; message: string }) {
  if (error.code === "42501" && error.message === "observations are closed") return {
    title: "The observation window is closed",
    detail: "Observations for this event can no longer be added or edited.",
  };
  if (error.code === "42501" && error.message === "check in to this event first") return {
    title: "Check-in is required",
    detail: "Ask the event organizer to confirm your member check-in, then reload this event.",
  };
  if (error.code === "42501") return {
    title: "Observations are unavailable",
    detail: "This event or your access may have changed. Check with the event organizer before recording observations.",
  };
  return {
    title: "The applicant list could not be loaded",
    detail: "Check your connection and reload this event. A loading error does not mean the observation window is closed.",
  };
}
