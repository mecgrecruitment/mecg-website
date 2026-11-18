import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import StaffingPlanView from "@/components/staffing-plan";
import { loadStaffingPlan } from "@/lib/staffing/server";

export const metadata: Metadata = { title: "Staffing" };

export default async function StaffingPage({ searchParams }: { searchParams?: Promise<{ skill?: string }> } = {}) {
  // Availability is per cycle. MANAGE_CYCLE is exactly Board or Owner of the
  // cycle; the database re-checks the same rule.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const params = await searchParams;
  const skill = typeof params?.skill === "string" ? params.skill.trim().slice(0, 40) : "";
  const plan = await loadStaffingPlan(cycleId);
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Client work"
        title="Staffing"
        description="Who has time, what they can do and what they want, next to what they're already on. Read before you staff a project."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/staffing" />
      <StaffingPlanView plan={plan} cycleId={cycleId} skill={skill} />
    </main>
  );
}
