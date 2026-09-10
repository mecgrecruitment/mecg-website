export class RequestTimeoutError extends Error {
  constructor() {
    super("The request took too long.");
    this.name = "RequestTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new RequestTimeoutError()), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function reconcileSubmittedApplication({
  fetcher = fetch,
  waits = [0, 300, 900, 1_800],
  requestTimeoutMs = 2_500,
  wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
}: {
  fetcher?: typeof fetch;
  waits?: number[];
  requestTimeoutMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
} = {}) {
  for (const delay of waits) {
    if (delay > 0) await wait(delay);
    try {
      const response = await fetchWithTimeout(
        "/api/apply/status",
        { method: "GET", cache: "no-store" },
        requestTimeoutMs,
        fetcher,
      );
      if (!response.ok) continue;
      const status: unknown = await response.json();
      const application = status && typeof status === "object" && "application" in status
        ? status.application
        : undefined;
      if (application && typeof application === "object" && "submitted" in application && application.submitted === true) {
        return true;
      }
    } catch {
      // Reconciliation is best-effort. A negative or failed read is not proof
      // that the timed-out write cannot still commit.
    }
  }
  return false;
}
