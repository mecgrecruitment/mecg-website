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
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/apply"
        fallbackRedirectUrl="/apply"
        appearance={{
          options: { logoPlacement: "none" },
          elements: {
            rootBox: "w-full",
            cardBox: "w-full max-w-none rounded-none border-none bg-transparent shadow-none",
            card: "w-full gap-6 rounded-none border-none bg-transparent p-0 shadow-none",
            header: "hidden",
            footer: "rounded-none bg-transparent bg-none p-0 shadow-none [&>*:not(.cl-footerAction)]:hidden",
            footerAction: "justify-center",
            formButtonPrimary:
              "button-primary rounded-[2px] bg-mecg-orange text-mecg-navy shadow-none hover:bg-mecg-orange",
          },
        }}
        fallback={<p role="status" className="py-8 text-center text-sm text-mecg-navy/60">Loading secure sign-in…</p>}
      />
      <p className="mt-5 text-center text-xs text-mecg-navy/60">Secure authentication powered by Clerk.</p>
    </PortalShell>
  );
}
