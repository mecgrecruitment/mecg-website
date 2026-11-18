import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import OfficerHandoffs from "@/components/officer-handoffs";
import { loadHandoffs } from "@/lib/officer-handoff/server";

export const metadata: Metadata = { title: "Officer handoffs" };

export default async function HandoffsPage() {
  // Handoffs are org-wide, like Projects, so this gates on being board rather
  // than on a capability within a cycle. The cycle only keeps the workspace
  // navigation in context; the database re-checks board access.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const board = await loadHandoffs();
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Board"
        title="Officer handoffs"
        description="A checklist for each officer change: accounts, access to reassign and open items, from the outgoing officer to the incoming one."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/handoffs" />
      <OfficerHandoffs board={board} />
    </main>
  );
}
