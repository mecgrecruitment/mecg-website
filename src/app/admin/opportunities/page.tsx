import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import PipelineRollup from "@/components/pipeline-rollup";
import { loadPipelineRollup } from "@/lib/opportunities/server";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  // Member pipeline records belong to a cycle. MANAGE_CYCLE is exactly Board or
  // Owner of the cycle; the database re-checks the same rule and decides
  // separately whether the viewer may see any record titles.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const rollup = await loadPipelineRollup(cycleId);
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Clients & sponsors"
        title="Opportunities"
        description="How many client and sponsor opportunities members are working, by stage, and how many next actions are past due."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/opportunities" />
      <PipelineRollup rollup={rollup} cycleId={cycleId} />
    </main>
  );
}
