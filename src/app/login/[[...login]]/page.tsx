import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import OperationNotice from "@/components/operation-notice";
import { currentDestination } from "@/lib/auth";
import { hasClerkRuntimeConfiguration } from "@/lib/env";
import { validatedRedirect } from "./redirect";
import ClerkLoadingFallback from "./clerk-loading-fallback";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const clerkConfigured = hasClerkRuntimeConfiguration();
  if (!clerkConfigured) {
    return (
      <PortalShell
        eyebrow="Account access"
        title="Sign-in is temporarily unavailable."
        description="The authentication service is not configured on this deployment."
        centered
        compact
      >
        <OperationNotice kind="error">
          No credentials were accepted or transmitted. Contact <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you need immediate access.
        </OperationNotice>
      </PortalShell>
    );
  }

  const destination = await currentDestination();
  if (destination) redirect(destination);
  const { redirect_url: requestedRedirect } = await searchParams;
  const returnTo = validatedRedirect(requestedRedirect);

  return (
    <PortalShell
      eyebrow="Account access"
      title="Sign in to MECG."
      description="Use the email attached to your application or member account. We’ll send you to the right workspace."
      centered
      compact
    >
      <SignIn
        path="/login"
        routing="path"
        signUpUrl={returnTo ? `/apply?redirect_url=${encodeURIComponent(returnTo)}` : "/apply"}
        forceRedirectUrl={returnTo}
        fallbackRedirectUrl="/apply"
        // PortalShell already draws the heading and the page draws the Clerk credit, so the
        // widget ships chromeless. Values are style objects, not class names: Clerk merges
        // them into its own generated class, while a Tailwind class sits in a cascade layer
        // that Clerk's unlayered styles outrank (that is why `header: "hidden"` looked ignored).
        appearance={{
          variables: {
            colorPrimary: "#fe904d",
            colorPrimaryForeground: "#070d1f",
            borderRadius: "2px",
            fontFamily: "inherit",
          },
          options: { logoPlacement: "none" },
          elements: {
            rootBox: { width: "100%" },
            cardBox: { width: "100%", maxWidth: "none", border: "none", boxShadow: "none", background: "transparent" },
            // 2px of inline padding, not 0: at full card width the clip boundary
            // shaved the "E" off the "Email address" label on the live widget.
            card: { width: "100%", border: "none", boxShadow: "none", background: "transparent", padding: "0 2px" },
            // Without these the form keeps Clerk's own ~400px column and sits in
            // the left half of the shell card with dead space beside it.
            main: { width: "100%" },
            form: { width: "100%" },
            header: { display: "none" },
            footer: { background: "none", boxShadow: "none", padding: "1.25rem 0 0" },
            footerItem: { display: "none" },
            footerAction: { justifyContent: "center" },
            footerActionLink: { display: "inline-flex", minHeight: "44px", alignItems: "center" },
            formFieldInput: { minHeight: "44px", fontSize: "1rem" },
            formButtonPrimary: { minHeight: "44px", fontWeight: 600, textTransform: "none", letterSpacing: "normal" },
          },
        }}
        fallback={<ClerkLoadingFallback />}
      />
      <p className="mt-5 text-center text-xs text-mecg-navy/60">Secure authentication powered by Clerk.</p>
    </PortalShell>
  );
}
