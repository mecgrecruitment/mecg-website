import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import MemberStanding from "@/components/member-standing";
import { loadStanding } from "@/lib/standing/server";

export const metadata: Metadata = { title: "Member standing" };

export default async function StandingPage() {
  // Standing is per cycle: attendance counts that cycle's events and the
  // thresholds belong to it. MANAGE_CYCLE is exactly Board or Owner of the
  // cycle; the database re-checks the same rule.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const standing = await loadStanding(cycleId);
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Members"
        title="Member standing"
        description="Who is showing up, staffed and onboarded this cycle. Read-only; counts come from check-ins, project staffing and onboarding."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/standing" />
      <MemberStanding standing={standing} cycleId={cycleId} />
    </main>
  );
}
