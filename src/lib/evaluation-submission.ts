type SubmissionResult =
  | { kind: "submitted"; evaluationId: string }
  | { kind: "unconfirmed"; message: string };

/** A conflict is not a receipt: it also represents closed assignments. */
export function evaluationSubmissionResult(status: number, body: unknown): SubmissionResult {
  if (status === 409) {
    return {
      kind: "unconfirmed",
      message: "Submission could not be confirmed. Your observations remain on this page. Refresh My work before retrying; this evaluation may already be locked.",
    };
  }
  const payload = typeof body === "object" && body !== null ? body : null;
  if (status >= 200 && status < 300 && payload && "id" in payload && typeof payload.id === "string" && payload.id.trim()) {
    return { kind: "submitted", evaluationId: payload.id };
  }
  return {
    kind: "unconfirmed",
    message: status >= 400 && status < 500 && payload && "error" in payload && typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "Submission could not be confirmed. Your observations remain on this page. Refresh My work before retrying; this evaluation may already be locked.",
  };
}
