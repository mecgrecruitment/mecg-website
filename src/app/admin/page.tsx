import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import SetupForm from "./setup-form";
import RushControls from "./rush-controls";
import BoardNav from "./board-nav";
import PipelineStatusForm from "./pipeline-status-form";
import { PIPELINE_STATUSES } from "@/lib/workflow";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { count: cycleCount, error: countError } = await supabase.from("rush_cycles").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (!cycleCount) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">MECG rush setup</h1>
            <p className="text-gray-600">Signed in as {user.name}</p>
          </div>
          <LogoutButton />
        </header>
        <SetupForm />
      </main>
    );
  }
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canManageUsers = user.memberships.some((membership) => membership.cycleId === cycleId && membership.role === "OWNER");
  const [cycleResult, roundsResult, appsResult, membersResult, eventsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,status").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,resume_storage_path,pnms!inner(id,name,contact)").eq("cycle_id", cycleId),
    supabase.from("memberships").select("id,user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    supabase.from("events").select("id,name,starts_at").eq("cycle_id", cycleId).order("starts_at"),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, membersResult, eventsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const applications = (appsResult.data ?? []).sort((a, b) => a.pnms.name.localeCompare(b.pnms.name));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-700">{cycle.name} · {cycle.status}</p>
          <h1 className="text-3xl font-semibold">Board dashboard</h1>
          <p className="mt-1 text-gray-600">Signed in as {user.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/member" className="rounded border px-3 py-2 text-sm">Evaluation Hub</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current="/admin" />
      {canManage && (
        <RushControls
          cycleId={cycle.id}
          cycleStatus={cycle.status}
          canManageUsers={canManageUsers}
          rounds={(roundsResult.data ?? []).map((round) => ({ id: round.id, label: round.name, status: round.status }))}
          members={(membersResult.data ?? []).map((membership) => ({ id: membership.user_id, label: `${membership.profiles.display_name} · ${membership.role}` }))}
          applications={applications.map((application) => ({ id: application.id, label: application.pnms.name }))}
        />
      )}
      <section>
        <h2 className="text-xl font-semibold">Applicant pipeline</h2>
        <div className="mt-4 grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
          {PIPELINE_STATUSES.map((status) => {
            const column = applications.filter((application) => application.status === status);
            return (
              <article key={status} className="min-w-56 rounded-xl border p-3">
                <h3 className="text-sm font-semibold">{status.replaceAll("_", " ")} <span className="text-gray-500">{column.length}</span></h3>
                <ul className="mt-3 space-y-2">
                  {column.map((application) => (
                    <li key={application.id} className="rounded-lg bg-gray-50 p-3">
                      <Link href={`/admin/applications/${application.id}`} className="font-medium underline">{application.pnms.name}</Link>
                      <p className="text-xs text-gray-500">{application.resume_storage_path ? "Resume on file" : "No resume"}</p>
                      {canManage && <PipelineStatusForm applicationId={application.id} cycleId={cycle.id} status={application.status} />}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Attendance events</h2>
          <Link href="/admin/events/new" className="rounded border px-3 py-2 text-sm">New event</Link>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(eventsResult.data ?? []).map((event) => (
            <li key={event.id} className="rounded-lg border p-3">
              <Link href={`/admin/events/${event.id}`} className="font-medium underline">{event.name}</Link>
              <p className="text-sm text-gray-500">{new Date(event.starts_at).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
