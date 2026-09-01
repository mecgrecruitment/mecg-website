import type { Metadata } from "next";
import PortalShell from "@/components/portal-shell";
import LogoutButton from "@/components/logout-button";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <PortalShell eyebrow="Account unavailable" title="This account is inactive." description="MECG has disabled access for this account." centered>
      <p className="text-sm leading-6 text-mecg-navy/65">Contact <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you believe this is a mistake.</p>
      <div className="mt-6"><LogoutButton /></div>
    </PortalShell>
  );
}
