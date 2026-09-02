type ClerkRateLimitError = {
  status?: number;
  retryAfter?: number;
};

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
      const clerkError = error as ClerkRateLimitError;
      const seconds = Number(clerkError.retryAfter);
      if (clerkError.status !== 429 || !Number.isFinite(seconds) || seconds < 0 || attempt >= maxRetries) throw error;
      options.onWait?.(seconds);
      await sleep(Math.ceil(seconds * 1000) + jitter());
    }
  }
}
