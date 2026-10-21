// Venue wifi often drops without the browser ever firing `online`, so a failed
// save also retries on its own a few times before it waits for a manual Retry.
export const SAVE_RETRY_DELAYS_MS: readonly number[] = [3_000, 10_000, 30_000];

type Timers<Handle> = { set: (run: () => void, ms: number) => Handle; clear: (handle: Handle) => void };

const globalTimers: Timers<ReturnType<typeof setTimeout>> = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle),
};

export type RetryBackoff = ReturnType<typeof createRetryBackoff>;

// Per-key bounded retry. Each failure calls `schedule`, which queues the next
// attempt until the delays run out and then returns false. A newer edit, a
// success or a manual retry calls `reset`, which drops the queued attempt and
// starts the count over, so a superseded write is never resent.
export function createRetryBackoff<Handle = ReturnType<typeof setTimeout>>(
  delays: readonly number[] = SAVE_RETRY_DELAYS_MS,
  timers: Timers<Handle> = globalTimers as unknown as Timers<Handle>,
) {
  const keys = new Map<string, { attempts: number; handle: Handle | null }>();
  function reset(key: string) {
    const entry = keys.get(key);
    if (entry?.handle != null) timers.clear(entry.handle);
    keys.delete(key);
  }
  return {
    schedule(key: string, run: () => void): boolean {
      const entry = keys.get(key) ?? { attempts: 0, handle: null };
      if (entry.handle != null) timers.clear(entry.handle);
      const delay = delays[entry.attempts];
      if (delay === undefined) {
        keys.set(key, { attempts: entry.attempts, handle: null });
        return false;
      }
      const next: { attempts: number; handle: Handle | null } = { attempts: entry.attempts + 1, handle: null };
      next.handle = timers.set(() => { next.handle = null; run(); }, delay);
      keys.set(key, next);
      return true;
    },
    scheduled(key: string) {
      return keys.get(key)?.handle != null;
    },
    reset,
    resetAll() {
      for (const key of [...keys.keys()]) reset(key);
    },
  };
}
