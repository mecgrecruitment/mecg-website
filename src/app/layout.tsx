import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import SessionKeepalive from "@/components/session-keepalive";
import { ROOT_METADATA, ORGANIZATION_JSON_LD } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/json-ld";
import { hasClerkFrontendConfiguration } from "@/lib/env";
import "./globals.css";
import "./studio.css";

export const metadata: Metadata = ROOT_METADATA;

export default function RootLayout({ children }: { children: ReactNode }) {
  const clerkConfigured = hasClerkFrontendConfiguration();
  const content = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ORGANIZATION_JSON_LD) }} />
      {children}
    </>
  );

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full scroll-smooth antialiased"
    >
      <body className="min-h-full flex flex-col">
        {clerkConfigured ? <ClerkProvider><SessionKeepalive />{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}
