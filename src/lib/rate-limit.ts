import { screeningRpc } from "@/lib/screening-rpc";

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
export async function checkRateLimit(bucket: string): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await screeningRpc<boolean>(createAdminClient(), "check_rate_limit", {
    p_bucket: bucket,
  });
  if (error) {
    // Fail closed: deny the request if the rate limiter itself errors, rather than
    // silently disabling abuse protection during an incident.
    console.error("check_rate_limit failed", error);
    return false;
  }
  return data === true;
}
