import type { NextConfig } from "next";

// Next 16 inlines its runtime bootstrap and React's flight payload as inline
// <script> tags, and nonces would force every page to render dynamically
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// This is the documented no-nonce policy: 'unsafe-inline' for scripts and
// styles. External sources remain limited to the exact services the browser
// uses, so an injected script cannot load code from an arbitrary host into
// /admin, where applicant free text is rendered back.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_MECG_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

const clerkOrigin = (() => {
  const issuer = process.env.CLERK_ISSUER;
  try {
    return issuer ? new URL(issuer).origin : null;
  } catch {
    return null;
  }
})();

const clerkScriptSources = clerkOrigin
  ? ` ${clerkOrigin} https://challenges.cloudflare.com https://*.protect.clerk.com`
  : "";
const clerkConnectSources = clerkOrigin
  ? ` ${clerkOrigin} https://*.protect.clerk.com:*`
  : "";
const clerkFrameSources = clerkOrigin
  ? " https://challenges.cloudflare.com https://*.protect.clerk.com"
  : "";
const clerkImageSources = clerkOrigin ? " https://img.clerk.com" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${clerkScriptSources}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data:${clerkImageSources}`,
  "font-src 'self'",
  // The apply form uploads resumes straight to Supabase Storage from the browser.
  `connect-src 'self' ${supabaseOrigin}${clerkConnectSources}`,
  `worker-src 'self' blob:`,
  // The admin dossier renders resumes in a same-origin iframe.
  `frame-src 'self'${clerkFrameSources}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Browsers otherwise rewrite the local http:// dev server to https://,
  // which breaks assets and makes browser smoke tests report false failures.
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    // Next 16 routes unmatched URLs outside the normal layout tree. A global
    // boundary guarantees the branded, accessible 404 is used there too.
    globalNotFound: true,
  },
  allowedDevOrigins: ["127.0.0.1"],
  // pdfjs-dist loads its worker as a real file at runtime. Bundled into a server
  // chunk that file does not exist, so every resume upload died with
  // "Setting up fake worker failed: Cannot find module .../pdf.worker.mjs",
  // surfaced to applicants as "The uploaded file is not a valid PDF."
  // Keeping it external makes Node resolve it from node_modules as it expects.
  serverExternalPackages: ["pdfjs-dist"],
  // pdf.mjs loads its worker through a runtime import that output-file tracing
  // cannot discover. Include it in the one serverless route that parses PDFs;
  // otherwise deployments contain pdf.mjs but omit pdf.worker.mjs.
  outputFileTracingIncludes: {
    "/api/apply/resume/finalize": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
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
