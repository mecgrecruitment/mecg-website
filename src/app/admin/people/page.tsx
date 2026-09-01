import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { PeopleControls } from "../rush-controls";
import { memberAccountsFor } from "../member-accounts";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_MEMBERSHIPS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS")) redirect("/admin");
  const supabase = await createClient();
  const [cycleResult, membersResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("memberships").select("id,user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (membersResult.error) throw membersResult.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="People"
        description="Who has access to this cycle, and what they are allowed to do."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/people" />
      <PeopleControls
        cycleId={cycleId}
        currentUserId={user.id}
        memberAccounts={memberAccountsFor(membersResult.data ?? [])}
      />
    </main>
  );
}
