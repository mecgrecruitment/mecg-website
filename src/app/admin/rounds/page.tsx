import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import StatusPill from "@/components/status-pill";
import { formatEasternDateTime } from "@/lib/date-time";
import { cycleStatusLabel, roundStatusLabel, statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Interviews" };

function roundKindLabel(kind: string) {
  if (kind === "SPEED_DATING") return "Quick chats";
  if (kind === "GROUP_CASE") return "Group interview";
  if (kind === "APPLICATION_SCREEN") return "Application review";
  return statusLabel(kind);
}

export default async function RoundsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");
  const canExport = hasPermission(user.memberships, cycleId, "EXPORT");
  const supabase = await createClient();
  const [cycleResult, roundsResult, appsResult, assignmentsResult, eventsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status").eq("cycle_id", cycleId).neq("status", "DRAFT"),
    supabase
      .from("evaluation_assignments")
      .select("id,round_id,application_id,status,rounds!inner(cycle_id)")
      .eq("rounds.cycle_id", cycleId),
    supabase.from("events").select("id,name,status,starts_at,location,event_slots(capacity,slot_rsvps(id))").eq("cycle_id", cycleId).order("starts_at"),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, assignmentsResult, eventsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");

  const activeApplications = (appsResult.data ?? []).filter((application) =>
    !["WITHDRAWN", "REJECTED", "WAITLISTED", "OFFERED"].includes(application.status));
  const activeApplicationIds = new Set(activeApplications.map((application) => application.id));

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Interviews"
        description="See every round's readiness, then open one workspace to manage its scoring guide, groups, assignments, and results."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/rounds" />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-mecg-navy">Interview rounds</h2>
            <p className="mt-1 text-sm text-mecg-navy/55">Open a round to resolve coverage gaps and manage its evaluation workflow.</p>
          </div>
          <p className="tabular text-xs font-semibold text-mecg-navy/55">{activeApplications.length} active applicants</p>
        </div>

        <div className="mt-4 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
          {(roundsResult.data ?? []).map((round) => {
            const assignments = (assignmentsResult.data ?? []).filter((assignment) =>
              assignment.round_id === round.id && activeApplicationIds.has(assignment.application_id));
            const submitted = assignments.filter((assignment) => ["SUBMITTED", "LOCKED"].includes(assignment.status)).length;
            const assignmentCounts = new Map<string, number>();
            for (const assignment of assignments) {
              assignmentCounts.set(assignment.application_id, (assignmentCounts.get(assignment.application_id) ?? 0) + 1);
            }
            const covered = activeApplications.filter((application) => (assignmentCounts.get(application.id) ?? 0) >= 2).length;
            return (
              <Link
                key={round.id}
                href={round.kind === "APPLICATION_SCREEN" ? "/admin/screening" : `/admin/rounds/${round.id}`}
                className="group grid gap-3 py-4 transition-colors hover:bg-mecg-navy/[0.025] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-semibold text-mecg-navy group-hover:text-mecg-blue">{round.name}</h3>
                    <StatusPill tone={round.status === "ACTIVE" ? "navy" : "neutral"}>{roundStatusLabel(round.status)}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-mecg-navy/55">{roundKindLabel(round.kind)} · weight {round.weight}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 text-xs sm:text-right">
                  <div>
                    <dt className="text-mecg-navy/50">Coverage</dt>
                    <dd className="mt-0.5 tabular font-semibold text-mecg-navy">{covered}/{activeApplications.length} twice</dd>
                  </div>
                  <div>
                    <dt className="text-mecg-navy/50">Forms</dt>
                    <dd className="mt-0.5 tabular font-semibold text-mecg-navy">{submitted}/{assignments.length} submitted</dd>
                  </div>
                </dl>
                <span className="text-sm font-semibold text-mecg-blue">Open →</span>
              </Link>
            );
          })}
          {!roundsResult.data?.length && (
            <p className="py-5 text-sm text-mecg-navy/55">No interview rounds are configured for this cycle.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-mecg-navy">Interview events</h2>
            <p className="mt-1 text-sm text-mecg-navy/55">Scheduling, capacity, attendance, and live operations now live with interviews.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExport && <a href={`/api/admin/export?cycleId=${cycleId}`} className="button-secondary text-sm">Export attendance</a>}
            <Link href="/admin/events/new" className="button-primary text-sm">New event</Link>
          </div>
        </div>
        <div className="mt-4 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
          {(eventsResult.data ?? []).map((event) => {
            const capacity = event.event_slots.reduce((sum, slot) => sum + slot.capacity, 0);
            const reservations = event.event_slots.reduce((sum, slot) => sum + slot.slot_rsvps.length, 0);
            return (
              <Link key={event.id} href={`/admin/events/${event.id}`} className="group grid gap-2 py-4 hover:bg-mecg-navy/[0.025] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-mecg-navy group-hover:text-mecg-blue">{event.name}</h3>
                    <StatusPill tone={event.status === "PUBLISHED" ? "navy" : "neutral"}>{statusLabel(event.status)}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-mecg-navy/55">{formatEasternDateTime(event.starts_at)}{event.location ? ` · ${event.location}` : ""}</p>
                </div>
                <p className="tabular text-xs font-semibold text-mecg-navy/60">{capacity ? `${reservations}/${capacity} booked` : "No slots"}</p>
                <span className="text-sm font-semibold text-mecg-blue">Open →</span>
              </Link>
            );
          })}
          {!eventsResult.data?.length && <p className="py-5 text-sm text-mecg-navy/55">No interview events are scheduled.</p>}
        </div>
      </section>
    </main>
  );
}
