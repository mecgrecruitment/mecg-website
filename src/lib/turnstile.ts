const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Server-side verification for the Cloudflare Turnstile widget (SEC-23/EX-61).
// Fails closed in production if TURNSTILE_SECRET_KEY isn't set — a real
// deploy must configure it. In development an unconfigured key just skips
// the check so local work isn't blocked on setting up a Cloudflare account.
export async function verifyTurnstile(token: FormDataEntryValue | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || !token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
