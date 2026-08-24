import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import SectionLabel from "@/components/section-label";
import SetupForm from "./setup-form";
import RushControls from "./rush-controls";
import BoardNav from "./board-nav";
import PipelineStatusForm from "./pipeline-status-form";
import { PIPELINE_STATUSES } from "@/lib/workflow";

const MUTED_PIPELINE_STATUSES = new Set(["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"]);

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function eventBadge(startsAt: string) {
  const date = new Date(startsAt);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString("en-US", { day: "2-digit" }),
  };
}

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
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">{cycle.name} · {cycle.status}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Board dashboard</h1>
          <p className="mt-1.5 text-[15px] text-mecg-navy/55">Signed in as {user.name}</p>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/member" className="button-secondary text-sm">Evaluation Hub</Link>
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
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <SectionLabel number="02">Applicant pipeline</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Applicant pipeline</h2>
          </div>
          <p className="text-sm text-mecg-navy/50">{applications.length} applicants in this cycle</p>
        </div>
        <div className="mt-3.5 grid grid-flow-col auto-cols-[248px] gap-3 overflow-x-auto pb-2">
          {PIPELINE_STATUSES.map((status) => {
            const column = applications.filter((application) => application.status === status);
            const muted = MUTED_PIPELINE_STATUSES.has(status);
            return (
              <article key={status} className="flex flex-col gap-1.5 rounded-[18px] bg-mecg-navy/[0.025] p-2.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/55">{status.replaceAll("_", " ")}</p>
                  <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold ${muted ? "bg-mecg-navy/[0.06] text-mecg-navy/40" : "bg-mecg-orange/[0.18] text-mecg-orange-ink"}`}>
                    {column.length}
                  </span>
                </div>
                {column.length === 0 ? (
                  <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-3 text-center">
                    <p className="text-[11.5px] text-mecg-navy/40">No applicants yet</p>
                  </div>
                ) : (
                  column.map((application) => (
                    <div key={application.id} className={`flex flex-col gap-1.5 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(7,13,31,0.06)] ${muted ? "opacity-60" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-white ${muted ? "bg-mecg-navy/40" : "bg-mecg-navy"}`}>
                          {initials(application.pnms.name)}
                        </span>
                        <Link href={`/admin/applications/${application.id}`} className="text-[13px] font-semibold text-mecg-navy hover:underline">
                          {application.pnms.name}
                        </Link>
                      </div>
                      <p className="flex items-center gap-1 text-[11.5px] text-mecg-navy/45">
                        {application.resume_storage_path ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="flex-shrink-0 text-mecg-navy/55">
                              <path d="M4 10.5l4 4 8-9" />
                            </svg>
                            <span className="text-mecg-navy/55">Resume on file</span>
                          </>
                        ) : (
                          "No resume"
                        )}
                      </p>
                      {canManage && <PipelineStatusForm applicationId={application.id} cycleId={cycle.id} status={application.status} />}
                    </div>
                  ))
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <SectionLabel number="03">Attendance events</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Attendance events</h2>
          </div>
          <Link href="/admin/events/new" className="button-secondary text-sm">+ New event</Link>
        </div>
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {(eventsResult.data ?? []).map((event) => {
            const { month, day } = eventBadge(event.starts_at);
            return (
              <div key={event.id} className="flex items-center gap-4 rounded-2xl p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-xl bg-mecg-navy font-mono text-white">
                  <span className="text-[10px] font-semibold tracking-[0.06em]">{month}</span>
                  <span className="text-base font-bold">{day}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-mecg-navy">{event.name}</p>
                  <Link href={`/admin/events/${event.id}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-mecg-blue hover:text-mecg-orange-ink">
                    View details
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 4l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
