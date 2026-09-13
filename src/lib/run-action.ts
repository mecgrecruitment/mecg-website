// Pure fetch/parse logic shared by the `useAction` hook (see use-action.ts). Kept dependency-free
// (no React/Next imports) so it can run under plain `node --test` without a DOM.
import { authorizedFetch } from "./client-fetch";

export type ActionResult = { ok: true; body: unknown } | { ok: false; body: unknown; error: string };

export async function runAction(url: string, payload: unknown, fallbackError: string): Promise<ActionResult> {
  try {
    const response = await authorizedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, body, error: (body as { error?: string } | null)?.error ?? fallbackError };
    return { ok: true, body };
  } catch {
    return { ok: false, body: null, error: fallbackError };
  }
}
