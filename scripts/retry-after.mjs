export function retryAfterMilliseconds(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (status !== 429) return null;
  const headers = error?.headers ?? error?.response?.headers;
  const raw = typeof headers?.get === "function"
    ? headers.get("retry-after")
    : headers?.["retry-after"] ?? headers?.["Retry-After"] ?? error?.retryAfter;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : null;
}

export async function withRetryAfter(operation, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitter = options.jitter ?? (() => Math.floor(Math.random() * 1000));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const delay = retryAfterMilliseconds(error);
      if (delay === null || attempt >= maxRetries) throw error;
      await sleep(delay + jitter());
    }
  }
}
