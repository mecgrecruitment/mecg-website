import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const isLocalHttpE2E = process.env.E2E_LOCAL_HTTP === "1";

// ponytail: no nonce/strict-dynamic — that requires forcing every page to
// render dynamically (kills static generation for this marketing site).
// 'unsafe-inline' on script-src is required for Next's RSC streaming
// bootstrap scripts; upgrade path is proxy.ts nonce injection + `connection()`
// in layouts if this ever needs a stricter policy.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-src 'self' https://challenges.cloudflare.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isLocalHttpE2E ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Old public aliases → one canonical URL each (308). Soft page redirects
  // were temporary and left competing bookmarks / SEO signals.
  async redirects() {
    return [
      { source: "/team", destination: "/our-team", permanent: true },
      { source: "/services", destination: "/client-services", permanent: true },
      {
        source: "/recruitment",
        destination: "/prospective-members",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
