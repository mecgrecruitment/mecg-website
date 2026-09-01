import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import GroupForms from "./group-forms";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/admin");
  const supabase = await createClient();
  const [groupsResult, applicationsResult, membersResult] = await Promise.all([
    supabase.from("case_groups").select("id,name,prompt").eq("cycle_id", cycleId),
    supabase.from("applications").select("id,pnms!inner(name)").eq("cycle_id", cycleId),
    supabase.from("case_group_members").select("group_id,application_id,case_groups!inner(cycle_id)").eq("case_groups.cycle_id", cycleId),
  ]);
  for (const result of [groupsResult, applicationsResult, membersResult]) if (result.error) throw result.error;
  const groups = groupsResult.data;
  const applications = applicationsResult.data;
  const members = membersResult.data;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-10">
      <WorkspaceHeader eyebrow="Case teams" title="Group case teams" />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/groups" />
      <GroupForms
        cycleId={cycleId}
        groups={groups ?? []}
        applications={(applications ?? []).map((application) => ({
          id: application.id,
          name: Array.isArray(application.pnms) ? application.pnms[0]?.name ?? "Applicant" : application.pnms.name,
        }))}
        members={members ?? []}
      />
    </main>
  );
}
