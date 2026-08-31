import type { NextConfig } from "next";

// Next 16 inlines its runtime bootstrap and React's flight payload as inline
// <script> tags, and nonces would force every page to render dynamically
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// This is the documented no-nonce policy: 'unsafe-inline' for scripts and
// styles, everything else locked to same-origin. It still blocks the thing
// that matters here, an injected <script src> pulling code from an attacker's
// host into /admin, where applicant free text is rendered back.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_MECG_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // The apply form uploads resumes straight to Supabase Storage from the browser.
  `connect-src 'self' ${supabaseOrigin}`,
  // The admin dossier renders resumes in a same-origin iframe.
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/", destination: "/home", permanent: true },
      { source: "/about", destination: "/home#our-history", permanent: true },
      { source: "/socials", destination: "/contact#socials", permanent: true },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/:workspace(admin|member|applicant)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
