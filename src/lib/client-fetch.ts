import { confirmedApplicationSubmission } from "./application-submission";

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

// The deadline covers consuming the response body, not only receiving headers.
export async function fetchJsonWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new RequestTimeoutError()); }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(input, { ...init, signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        return { response, body };
      })(),
      deadline,
    ]);
  } finally { clearTimeout(timer); }
}

export async function reconcileSubmittedApplication({
  cycleId,
  fetcher = fetch,
  waits = [0, 300, 900, 1_800],
  requestTimeoutMs = 2_500,
  wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
}: {
  cycleId: string;
  fetcher?: typeof fetch;
  waits?: number[];
  requestTimeoutMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}) {
  for (const delay of waits) {
    if (delay > 0) await wait(delay);
    try {
      const { response, body: status } = await fetchJsonWithTimeout(
        `/api/apply/status?cycleId=${encodeURIComponent(cycleId)}`,
        { method: "GET", cache: "no-store" },
        requestTimeoutMs,
        fetcher,
      );
      if (!response.ok) continue;
      const application = status && typeof status === "object" && "application" in status ? status.application : null;
      const id = confirmedApplicationSubmission(application, cycleId);
      if (id) return id;
    } catch {
      // Reconciliation is best-effort. A negative or failed read is not proof
      // that the timed-out write cannot still commit.
    }
  }
  return null;
}

// Clerk's session cookie is a 60-second JWT that clerk-js refreshes only while
// the tab is awake. A phone that slept between taps sends an expired cookie,
// the middleware answers 401 before the route runs, and the user sees
// "Unauthorized" for an action they are entitled to. Fetching a fresh token
// makes clerk-js rewrite the cookie (it emits token:update, the cookie service
// listens), so one retry with the same request is enough.
type ClerkWindow = Window & {
  Clerk?: { session?: { getToken(options?: { skipCache?: boolean }): Promise<string | null> } | null };
};

export const SESSION_EXPIRED_MESSAGE = "Your sign-in expired. Reload the page and try again.";

// A page waking from sleep fails thirty headshots at once; they share one
// token request instead of each asking Clerk for their own.
let inflightRefresh: Promise<boolean> | null = null;

export function refreshSessionToken(
  timeoutMs = 5_000,
  clerkWindow: ClerkWindow = window as ClerkWindow,
) {
  const session = clerkWindow.Clerk?.session;
  if (!session) return Promise.resolve(false);
  if (inflightRefresh) return inflightRefresh;
  // clerk-js retries a failed token fetch with a 3s-plus backoff of its own; on
  // venue wifi that can outlast the user's patience, so cap the wait here.
  inflightRefresh = Promise.race([
    session.getToken({ skipCache: true }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]).then((token) => token !== null).finally(() => { inflightRefresh = null; });
  return inflightRefresh;
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  {
    fetcher = fetch,
    refresh = refreshSessionToken,
  }: { fetcher?: typeof fetch; refresh?: () => Promise<boolean> } = {},
) {
  const response = await fetcher(input, init);
  if (response.status !== 401) return response;
  await refresh();
  const retried = await fetcher(input, init);
  if (retried.status !== 401) return retried;
  // Still refused with a fresh token: the session is gone, not just stale.
  // Callers already render `body.error`, so hand them the instruction there
  // instead of the middleware's bare "Unauthorized".
  return Response.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 401 });
}

// Runs `attempt` again after a thrown network error (fetch rejects; an HTTP
// error status resolves and is not retried here). `stillWanted` lets a caller
// drop a retry that a newer action has superseded, so a stale write cannot
// land after the one that replaced it.
export async function retryOnNetworkError<T>(
  attempt: () => Promise<T>,
  {
    delays = [1_000, 3_000, 9_000],
    stillWanted = () => true,
    wait = waitForNetwork,
    onRetry,
  }: { delays?: number[]; stillWanted?: () => boolean; wait?: (milliseconds: number) => Promise<void>; onRetry?: () => void } = {},
): Promise<T> {
  for (let index = 0; ; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (index >= delays.length || !stillWanted()) throw error;
      onRetry?.();
      await wait(delays[index]);
      if (!stillWanted()) throw error;
    }
  }
}

// Sleeps for the delay, or until the browser reports it is back online,
// whichever is later; a retry fired while offline is a wasted attempt.
export function waitForNetwork(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      if (typeof navigator === "undefined" || navigator.onLine) return resolve();
      window.addEventListener("online", () => resolve(), { once: true });
    }, milliseconds);
  });
}
