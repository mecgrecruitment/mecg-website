import Script from "next/script";

// Cloudflare Turnstile challenge for public write endpoints (signup,
// application submit — SEC-23/EX-61). Renders nothing if no site key is
// configured yet (see NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.example).
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" />
    </>
  );
}
