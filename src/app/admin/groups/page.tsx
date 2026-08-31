import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "../board-nav";
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
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Case teams</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Group case teams</h1>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/admin" className="button-secondary text-sm">Pipeline</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current="/admin/groups" />
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
