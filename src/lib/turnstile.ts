const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      process.env.TURNSTILE_SECRET_KEY
  );
}

// Server-side verification for the Cloudflare Turnstile widget (SEC-23/EX-61).
// Turnstile is enabled only when the matching public and private keys are both
// configured. Supabase still applies its own signup rate limits when this
// optional defense-in-depth check is disabled.
export async function verifyTurnstile(token: FormDataEntryValue | null): Promise<boolean> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!siteKey && !secret) return true;
  if (!siteKey || !secret) return false;
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
