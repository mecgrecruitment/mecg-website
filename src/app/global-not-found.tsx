import type { Metadata } from "next";
import NotFoundContent from "@/components/not-found-content";
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
        <NotFoundContent />
      </body>
    </html>
  );
}
