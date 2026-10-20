import type { Metadata } from "next";
import { PUBLIC_ROBOTS } from "@/lib/seo";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { display } from "../fonts/display";

export const metadata: Metadata = { robots: PUBLIC_ROBOTS };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-marketing className={`${display.variable} flex flex-1 flex-col`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-mecg-navy focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-mecg-navy"
      >
        Skip to main content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
