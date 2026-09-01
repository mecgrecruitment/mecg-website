"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { runAction, type ActionResult } from "./run-action";

/**
 * Shared fetch/pending/error/success control flow — the pattern every mutation form in the
 * portal repeats: `setPending(true); setError(""); setSuccess?.(""); try { fetch → check ok →
 * setError(body?.error) } catch { setError(fallback) } finally { setPending(false) }`.
 *
 * State shape matches what `OperationNotice` (components/operation-notice.tsx) expects.
 */
export function useAction(url: string, fallbackError = "Request failed. Check your connection and try again.") {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const run = useCallback(
    async (
      payload: unknown,
      options: { successMessage?: string; skipRefresh?: boolean; fallbackError?: string } = {},
    ): Promise<ActionResult> => {
      setPending(true);
      setError("");
      setSuccess("");
      const result = await runAction(url, payload, options.fallbackError ?? fallbackError);
      if (!result.ok) {
        setError(result.error);
      } else {
        if (options.successMessage) setSuccess(options.successMessage);
        if (!options.skipRefresh) router.refresh();
      }
      setPending(false);
      return result;
    },
    [url, fallbackError, router],
  );

  return { pending, error, success, setError, setSuccess, run, router };
}
