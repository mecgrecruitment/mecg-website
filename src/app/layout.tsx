import { MemberLoginFloat } from "@/components/portal/MemberLoginFloat";
import type { Metadata } from "next";
import { Manrope, Space_Grotesk, Space_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "MECG",
  description: "Michigan Engineering Consulting Group",
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
        
        <MemberLoginFloat />
        {children}
      </body>
    </html>
  );
}
