import { createHash } from "node:crypto";
import { screeningRpc } from "@/lib/screening-rpc";

// `x-forwarded-for` is client-controlled at its leftmost entry, so keying a
// bucket on it hands an attacker a fresh bucket per request. Prefer the headers
// only the platform can set (`x-vercel-forwarded-for` is stripped from inbound
// requests and rewritten by Vercel's edge; `x-real-ip` is the single
// platform-observed peer), and fall back to the *rightmost* XFF entry, which is
// the hop appended by the nearest trusted proxy rather than whatever the client
// typed. Local dev sends none of these and collapses to "unknown", which is the
// safe direction: one shared bucket, not unlimited buckets.
export function clientIp(req: { headers: Headers }): string {
  const platform = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (platform?.trim()) return platform.split(",")[0]!.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  return forwarded[forwarded.length - 1]?.trim() || "unknown";
}

// The bucket name is the primary key of rush.rate_limits, so a raw email would
// park every address anyone types into the login or forgot-password form in the
// table in plaintext. The prefix stays readable so buckets remain telling apart
// in the DB; only the address is digested.
export function emailBucket(prefix: string, email: string): string {
  return `${prefix}:${createHash("sha256").update(email).digest("hex")}`;
}

// check_rate_limit isn't in the generated Database types yet (added in the same
// migration batch as this file) — route through the untyped RPC helper like
// screening-rpc.ts does for its own not-yet-generated functions.
//
// Uses the service-role admin client, not the caller's session client:
// check_rate_limit's max/window policy is enforced server-side inside the
// function and EXECUTE is restricted to service_role, so this helper is the
// only caller allowed to invoke it (see supabase/migrations/20260825000000_rate_limits.sql).
//
// The admin client import is dynamic (not a top-level static import) so
// merely importing this module never loads src/lib/supabase/admin.ts's
// `import "server-only"` — that package throws unconditionally outside a
// bundler, and Node's module-mock loader evaluates a mocked CJS-interop
// module's real body regardless of the mock, which would otherwise crash
// any plain-Node test (e.g. route.test.ts) that merely imports a route
// using checkRateLimit.
//
// `onError` defaults to "deny" (fail closed): if the limiter itself errors we
// deny rather than silently disabling abuse protection during an incident. Pass
// "allow" only where locking everyone out is worse than losing the limit for the
// duration of an outage -- login is the one such path, since failing closed
// there 429s the whole site including the board members trying to fix it.
export type RateLimitStatus = "allowed" | "limited" | "unavailable";

export async function checkRateLimitStatus(bucket: string): Promise<RateLimitStatus> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await screeningRpc<boolean>(createAdminClient(), "check_rate_limit", {
      p_bucket: bucket,
    });
    if (!error && typeof data === "boolean") return data ? "allowed" : "limited";
  } catch {
    // Client setup, session transport, and RPC execution can reject instead
    // of returning an RPC error. Preserve the caller's outage policy for both.
  }
  console.error("check_rate_limit unavailable");
  return "unavailable";
}

// Compatibility wrapper for routes whose existing policy deliberately chooses
// whether a limiter outage should fail open or closed. Applicant submission
// routes use checkRateLimitStatus directly so an outage can be reported as a
// retryable 503 rather than being mislabeled as a 429.
export async function checkRateLimit(bucket: string, onError: "deny" | "allow" = "deny"): Promise<boolean> {
  const status = await checkRateLimitStatus(bucket);
  if (status !== "unavailable") return status === "allowed";
  if (onError === "allow") {
    console.error(`rate limit failing open for ${bucket.split(":")[0]} -- abuse protection is OFF until the limiter recovers`);
    return true;
  }
  return false;
}
