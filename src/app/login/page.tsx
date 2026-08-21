import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { currentDestination } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const destination = await currentDestination();
  if (destination) redirect(destination);

  return (
    <PortalShell
      eyebrow="Account access"
      title="Sign in to MECG."
      description="Applicants, members, Board operators, and Hash panelists use one account. MECG sends you to the workspace assigned to that account."
    >
      <LoginForm />
    </PortalShell>
  );
}
