import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Michigan Engineering Consulting Group",
    template: "%s | MECG",
  },
  description: "Pro-bono, student-led consulting at the University of Michigan.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${geistMono.variable} ${montserrat.className} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
