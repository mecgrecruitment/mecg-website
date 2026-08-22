import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "../board-nav";
import GroupForms from "./group-forms";

export default async function GroupsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/admin");
  const supabase = await createClient();
  const [{ data: groups }, { data: applications }, { data: members }] = await Promise.all([
    supabase.from("case_groups").select("id,name,prompt").eq("cycle_id", cycleId),
    supabase.from("applications").select("id,pnms!inner(name)").eq("cycle_id", cycleId),
    supabase.from("case_group_members").select("group_id,application_id"),
  ]);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-10">
      <header className="flex justify-between"><h1 className="text-3xl font-semibold">Group Case teams</h1><div className="flex gap-2"><Link href="/admin" className="rounded border px-3 py-2 text-sm">Pipeline</Link><LogoutButton /></div></header>
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
