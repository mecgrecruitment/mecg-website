// Decides whether a Supabase session came from a password-recovery link, by
// reading the `amr` (Authentication Method References) claim out of the access
// token's payload. Pure and token-only so it is unit-testable without a live
// Supabase; the token's authenticity is established separately by getUser().
//
// GoTrue labels a PKCE recovery exchange with the flow's authentication method,
// which for `resetPasswordForEmail` is "recovery". Older/non-PKCE verifications
// land as "otp" or "magiclink". None of those three can be produced by this
// app's other entry points (password sign-in and sign-up), so all three are
// accepted; "password" alone is exactly the stolen-cookie case we reject.
//
// ponytail: accept-list, not a timestamp window. If a recovery session is ever
// allowed to live long enough to matter, bound it on the AMR entry's timestamp.
const RECOVERY_AMR_METHODS = new Set(["recovery", "otp", "magiclink"]);

// "unknown" means the token carried no usable `amr` claim at all. Callers must
// fail open on it (with a loud log): an absent claim is an unrecognized Supabase
// shape, not evidence of an attack, and locking users out of password reset is
// worse than the bug this check exists for.
export type RecoverySessionState = "recovery" | "not-recovery" | "unknown";

export function recoverySessionState(accessToken: string | null | undefined): RecoverySessionState {
  const amr = jwtPayload(accessToken)?.amr;
  if (!Array.isArray(amr) || amr.length === 0) return "unknown";
  const methods = amr.map((entry) =>
    typeof entry === "string" ? entry : (entry as { method?: unknown })?.method,
  );
  if (methods.every((method) => typeof method !== "string")) return "unknown";
  return methods.some((method) => typeof method === "string" && RECOVERY_AMR_METHODS.has(method))
    ? "recovery"
    : "not-recovery";
}

// Payload only: the signature and `exp` are Supabase's to validate (getUser()
// round-trips to the auth server), so re-checking them here would only add a
// second, weaker copy of that check.
function jwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
