import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import OperationNotice from "@/components/operation-notice";
import { currentDestination } from "@/lib/auth";
import { hasClerkRuntimeConfiguration } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const clerkConfigured = hasClerkRuntimeConfiguration();
  if (!clerkConfigured) {
    return (
      <PortalShell
        eyebrow="Account access"
        title="Sign-in is temporarily unavailable."
        description="The authentication service is not configured on this deployment."
        centered
      >
        <OperationNotice kind="error">
          No credentials were accepted or transmitted. Contact <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you need immediate access.
        </OperationNotice>
      </PortalShell>
    );
  }

  const destination = await currentDestination();
  if (destination) redirect(destination);

  return (
    <PortalShell
      eyebrow="Account access"
      title="Sign in to MECG."
      description="Applicants, members, Board operators, and Hash panelists use one account. MECG sends you to the workspace assigned to that account."
      centered
    >
      <SignIn routing="hash" signUpUrl="/apply" fallbackRedirectUrl="/apply" />
    </PortalShell>
  );
}
