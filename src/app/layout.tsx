import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { serializeJsonLd } from "@/lib/json-ld";
import { hasClerkFrontendConfiguration } from "@/lib/env";
import "./globals.css";

const productionClerkProxyUrl = "https://mecgmichigan.com/__clerk";

export const metadata: Metadata = {
  metadataBase: new URL("https://mecgmichigan.com"),
  title: {
    default: "Michigan Engineering Consulting Group",
    template: "%s | MECG",
  },
  description: "Pro-bono, student-led consulting at the University of Michigan.",
  applicationName: "MECG",
  openGraph: {
    type: "website",
    siteName: "Michigan Engineering Consulting Group",
    title: "Michigan Engineering Consulting Group",
    description: "Pro-bono, student-led consulting at the University of Michigan.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Michigan Engineering Consulting Group",
    description: "Pro-bono, student-led consulting at the University of Michigan.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Michigan Engineering Consulting Group",
  url: "https://mecgmichigan.com",
  logo: "https://mecgmichigan.com/logos/mecg-color.svg",
  sameAs: [
    "https://www.instagram.com/mecgmichigan",
    "https://www.linkedin.com/company/michigan-engineering-consulting-group",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const clerkConfigured = hasClerkFrontendConfiguration();
  const clerkProxyUrl = process.env.VERCEL_ENV === "production"
    ? productionClerkProxyUrl
    : undefined;
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
        {clerkConfigured ? <ClerkProvider proxyUrl={clerkProxyUrl}>{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}
