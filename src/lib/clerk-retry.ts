type ClerkRateLimitError = {
  status?: number;
  retryAfter?: number;
  cause?: unknown;
};

function rateLimitDetails(error: unknown): ClerkRateLimitError {
  if (!error || typeof error !== "object") return {};
  const clerkError = error as ClerkRateLimitError;
  if (clerkError.status !== undefined || clerkError.retryAfter !== undefined) return clerkError;
  return rateLimitDetails(clerkError.cause);
}

export async function retryClerkRateLimit<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    onWait?: (seconds: number) => void;
    sleep?: (milliseconds: number) => Promise<void>;
    jitter?: () => number;
  } = {},
) {
  const maxRetries = options.maxRetries ?? 2;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const jitter = options.jitter ?? (() => Math.floor(Math.random() * 1000));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const clerkError = rateLimitDetails(error);
      const seconds = Number(clerkError.retryAfter);
      if (clerkError.status !== 429 || !Number.isFinite(seconds) || seconds < 0 || attempt >= maxRetries) throw error;
      options.onWait?.(seconds);
      await sleep(Math.ceil(seconds * 1000) + jitter());
    }
  }
}

// Clerk's backend SDK takes no fetch or timeout option (@clerk/backend 3.17),
// so a hung Backend API call would otherwise run out the Vercel function
// limit. Reject instead: every call site already treats a thrown Clerk error
// as a failure. AbortSignal.timeout is unref'd, so a fast call leaves no timer
// holding the function open.
export const CLERK_TIMEOUT_MS = 10_000;

export function withClerkTimeout<T>(operation: () => Promise<T>, milliseconds = CLERK_TIMEOUT_MS) {
  return Promise.race([
    operation(),
    new Promise<never>((_resolve, reject) => {
      AbortSignal.timeout(milliseconds).addEventListener("abort", () => reject(new Error("Clerk request timed out")));
    }),
  ]);
}
