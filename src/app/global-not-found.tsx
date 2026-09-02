import type { Metadata } from "next";
import Link from "next/link";
import PortalShell from "@/components/portal-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mecgmichigan.com"),
  title: "Page not found",
  description: "The requested MECG page does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <PortalShell
          eyebrow="404 / Route unavailable"
          title="This page does not exist."
          description="The link may be old, or the page may have moved. Choose a route below to continue."
          centered
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/home" className="button-primary">
              Return to public site
            </Link>
            <Link href="/login" className="button-secondary">
              Account access
            </Link>
          </div>
        </PortalShell>
      </body>
    </html>
  );
}
