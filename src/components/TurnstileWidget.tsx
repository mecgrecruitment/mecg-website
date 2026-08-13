import Script from "next/script";
import { isTurnstileConfigured } from "@/lib/turnstile";

// Cloudflare Turnstile challenge for public write endpoints (signup,
// application submit — SEC-23/EX-61). It is optional, but both halves of the
// key pair must be configured before the widget and server check are enabled.
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey || !isTurnstileConfigured()) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" />
    </>
  );
}
