import React from "react";
import type { Metadata } from "next";
import { Manrope, Space_Grotesk, Space_Mono } from "next/font/google";
import { siteUrl } from "./site";
import "./globals.css";

// §7.2 font contract: next/font only (self-hosted, preloaded, fallback-adjusted);
// weights limited to what the design actually uses.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const grotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const mono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const description =
  "MECG is a pro-bono, student-led consulting group at the University of Michigan. Open to every major. Strategy, operations, analytics, product, and marketing for real clients.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MECG | Michigan Engineering Consulting Group",
    template: "%s | MECG",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "MECG",
    title: "MECG | Michigan Engineering Consulting Group",
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "MECG | Michigan Engineering Consulting Group",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${grotesk.variable} ${mono.variable}`}
    >
      <body className="min-h-full bg-surface font-sans text-on-surface">
        {children}
      </body>
    </html>
  );
}
