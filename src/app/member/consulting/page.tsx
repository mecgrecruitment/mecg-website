import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ConsultingWorkbench from "./workbench";
export const metadata: Metadata = { title: "Consulting workbench · MECG", robots: { index: false, follow: false } };
export default async function ConsultingPage() {
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  return <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
    <WorkspaceHeader eyebrow="MECG consulting" title="Consulting workbench" description="Build a traceable scope, inspect the evidence and hand over work someone else can operate." />
    <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/consulting" />
    <Link href={withWorkspaceCycle("/member/tools/lab", membership.cycleId)} className="text-sm font-semibold text-mecg-blue underline">Back to AI lab and project records</Link>
    <ConsultingWorkbench key={`${user.id}:${membership.cycleId}`} userId={user.id} cycleId={membership.cycleId} />
  </main>;
}
