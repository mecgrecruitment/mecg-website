import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { CycleExportPanel, RetentionPanel } from "@/components/cycle-records";
import { loadCycleRecordsOverview, loadRetentionReport } from "@/lib/cycle-records/server";

export const metadata: Metadata = { title: "Cycle records" };

export default async function CycleRecordsPage() {
  // Owners only, like Operations. Export and archive are for the selected
  // cycle's Owner; retention is organisation-wide for any Owner. The database
  // re-checks both on every call.
  const user = await requireAdmin();
  if (!user.memberships.some((membership) => membership.active && membership.role === "OWNER")) redirect("/access-denied");
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/admin");
  const ownsCycle = user.memberships.some((membership) => membership.active && membership.role === "OWNER" && membership.cycleId === cycleId);
  const [overview, retention] = await Promise.all([ownsCycle ? loadCycleRecordsOverview(cycleId) : Promise.resolve(null), loadRetentionReport()]);
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Owner tools"
        title="Cycle records"
        description="Export a cycle’s records, archive it once it has closed, and see what a retention period would cover before anyone agrees to one."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/records" />
      <CycleExportPanel overview={overview} ownsCycle={ownsCycle} />
      <RetentionPanel report={retention} />
    </main>
  );
}
