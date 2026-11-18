import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { BudgetRequestLog } from "@/components/budget-requests";
import { loadBudgetRequestLog } from "@/lib/budget/server";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  // The budget log is org-wide, like Projects, so this gates on being board
  // rather than on a capability within a cycle. The cycle only keeps the
  // workspace navigation in context; the database re-checks board access.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const list = await loadBudgetRequestLog();
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Board"
        title="Budget"
        description="Members' purchase and reimbursement requests: approve or deny them, then record when each is paid."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/budget" />
      <BudgetRequestLog list={list} />
    </main>
  );
}
