import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { currentDestination } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [destination, { error }] = await Promise.all([currentDestination(), searchParams]);
  if (destination) redirect(destination);

  return (
    <PortalShell
      eyebrow="Account access"
      title="Sign in to MECG."
      description="Applicants, members, Board operators, and Hash panelists use one account. MECG sends you to the workspace assigned to that account."
      centered
    >
      <LoginForm callbackError={error} />
    </PortalShell>
  );
}
