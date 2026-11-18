import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import DecisionLog from "@/components/decision-log";
import { loadDecisionLog } from "@/lib/decisions/server";

export const metadata: Metadata = { title: "Board decisions" };

export default async function DecisionsPage() {
  // The decision log is org-wide, like Projects, so this gates on being board
  // rather than on a capability within a cycle. The cycle only keeps the
  // workspace navigation in context; the database re-checks board access.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const log = await loadDecisionLog();
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Board"
        title="Board decisions"
        description="What the board decided, when, how the vote went and where the minutes are."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/decisions" />
      <DecisionLog log={log} />
    </main>
  );
}
