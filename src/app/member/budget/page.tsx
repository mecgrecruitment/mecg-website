import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { MyBudgetRequests } from "@/components/budget-requests";
import { canRequestBudget } from "@/lib/budget/access";
import { loadMyBudgetRequests } from "@/lib/budget/server";

export const metadata: Metadata = { title: "Budget requests", robots: { index: false, follow: false } };

export default async function BudgetRequestsPage() {
  // Requests are org-wide; the cycle only keeps the workspace navigation in
  // context. The database re-checks membership on every read and write.
  const user = await requireMember();
  const membership = await selectWorkspaceMembership(user);
  if (!membership) return null;
  const eligible = canRequestBudget(user.memberships);
  const list = eligible ? await loadMyBudgetRequests() : null;
  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Club money"
        title="Budget requests"
        description="Ask to be paid back for club spending, or to have a purchase approved first, and follow each request."
      />
      <WorkspaceNav user={user} cycleId={membership.cycleId} current="/member/budget" />
      {eligible ? <MyBudgetRequests list={list} /> : (
        <p className="rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
          Budget requests are for club members. Panel-only access doesn&apos;t include club spending.
        </p>
      )}
    </main>
  );
}
