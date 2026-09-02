import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { currentDestination } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
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
