import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ReadinessPanel from "./readiness-panel";

export const metadata: Metadata = { title: "Operations readiness" };

export default async function OperationsPage() {
  const user = await requireAdmin();
  if (!user.memberships.some((membership) => membership.active && membership.role === "OWNER")) {
    redirect("/access-denied");
  }
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/admin");

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Owner tools"
        title="Operations readiness"
        description="Check required configuration and the live database without exposing secret values."
        action={<Link href={withWorkspaceCycle("/admin", cycleId)} className="button-secondary">Recruitment</Link>}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/operations" />
      <ReadinessPanel />
    </main>
  );
}
