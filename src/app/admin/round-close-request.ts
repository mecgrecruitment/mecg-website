import { authorizedFetch, RequestTimeoutError } from "@/lib/client-fetch";

export type RoundCloseOutcome = { kind: "acknowledged" } | { kind: "rejected"; message: string } | { kind: "unknown" };

// One deadline covers authorization, response headers, and the complete body.
// Racing also bounds non-cooperating transports; abort alone may never settle.
export async function roundCloseJsonRequest(input: string, init: RequestInit, timeoutMs = 10_000, fetcher: typeof fetch = authorizedFetch) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(input, { ...init, signal: controller.signal });
        const body: unknown = await response.json();
        return { response, body };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new RequestTimeoutError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function requestRoundClose(cycleId: string, roundId: string): Promise<RoundCloseOutcome> {
  try {
    const { response, body } = await roundCloseJsonRequest("/api/admin/rush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId, action: "SET_ROUND_STATUS", roundId, status: "FROZEN" }),
    });
    // A timeout or server/proxy error can follow a committed transaction.
    // Only an explicit client rejection can later permit a fresh confirmation.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return { kind: "rejected", message: body.error };
    }
    if (response.ok && body && typeof body === "object" && (("ok" in body && body.ok === true) || ("id" in body && typeof body.id === "string"))) return { kind: "acknowledged" };
  } catch {
    // A lost acknowledgement says nothing about whether the write committed.
  }
  return { kind: "unknown" };
}
