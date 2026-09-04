// Supabase has no client-side deadline of its own, so a hung query would run
// until the Vercel function limit (60s on the Node runtime, nothing in this
// repo raises it) and take the whole request with it. 10s is longer than any
// healthy RPC here and still leaves the rest of the budget for auth, render,
// and a retry, while the two probe call sites keep their tighter 2s signal.
export const SUPABASE_TIMEOUT_MS = 10_000;

export function withDeadline(signal: AbortSignal | null | undefined, milliseconds = SUPABASE_TIMEOUT_MS) {
  const deadline = AbortSignal.timeout(milliseconds);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

// Passed as supabase-js `global.fetch` so every query inherits the deadline
// without touching call sites, and an explicit .abortSignal() still wins when
// it fires first.
export const fetchWithDeadline: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: withDeadline(init?.signal) });
