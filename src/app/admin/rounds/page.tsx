import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import { roundStaffingSummary } from "./coverage";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import StatusPill from "@/components/status-pill";
import { formatEasternDateTime } from "@/lib/date-time";
import { cycleStatusLabel, roundStatusLabel, statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Interviews" };

function roundKindLabel(kind: string) {
  if (kind === "SPEED_DATING") return "Speed Dating";
  if (kind === "GROUP_CASE") return "Group interview";
  if (kind === "APPLICATION_SCREEN") return "Application review";
  return statusLabel(kind);
}

export default async function RoundsPage() {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, "RECRUITMENT_OPERATIONS");
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

  return (
    <main className="workspace-stack mx-auto flex max-w-6xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Interviews"
        description="See each round's staffing and submitted forms, then open its workspace to manage its scoring guide, groups, assignments, and results."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/rounds" />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-mecg-navy">Interview rounds</h2>
            <p className="mt-1 text-sm text-muted">Staffing counts usable assignments within each round’s cohort. Submitted forms may contain partial observations; open the round to check qualifying evidence.</p>
          </div>
          <p className="tabular text-xs font-semibold text-muted">{activeApplications.length} active applicants</p>
        </div>

        <div className="mt-4 divide-y divide-line border-y border-line">
          {(roundsResult.data ?? []).map((round) => {
            const staffing = roundStaffingSummary({
              roundKind: round.kind,
              applications: appsResult.data ?? [],
              assignments: (assignmentsResult.data ?? []).filter((assignment) => assignment.round_id === round.id),
            });
            return (
              <Link
                key={round.id}
                href={withWorkspaceCycle(round.kind === "APPLICATION_SCREEN" ? "/admin/screening" : `/admin/rounds/${round.id}`, cycleId)}
                className="group grid gap-3 py-4 transition-colors hover:bg-wash sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-semibold text-mecg-navy group-hover:text-mecg-blue">{round.name}</h3>
                    <StatusPill tone={round.status === "ACTIVE" ? "navy" : "neutral"}>{roundStatusLabel(round.status)}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted">{roundKindLabel(round.kind)} · weight {round.weight}</p>
                </div>
                {round.kind === "APPLICATION_SCREEN" ? (
                  <p className="max-w-xs text-xs leading-5 text-muted">Screening assignments and progress are in the application review workspace.</p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-6 text-xs sm:text-right">
                    <div>
                      <dt className="text-muted">Staffing</dt>
                      <dd className="mt-0.5 tabular font-semibold text-mecg-navy">{staffing.staffedTwice}/{staffing.cohortSize} with 2+ assigned</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Submitted forms</dt>
                      <dd className="mt-0.5 tabular font-semibold text-mecg-navy">{staffing.submittedForms}/{staffing.assignedForms}</dd>
                    </div>
                  </dl>
                )}
                <span className="text-sm font-semibold text-mecg-blue">Open →</span>
              </Link>
            );
          })}
          {!roundsResult.data?.length && (
            <p className="py-5 text-sm text-muted">No interview rounds are configured for this cycle.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-mecg-navy">Interview events</h2>
            <p className="mt-1 text-sm text-muted">Scheduling, capacity, attendance, and live operations now live with interviews.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExport && <a href={`/api/admin/export?cycleId=${cycleId}`} className="button-secondary text-sm">Export attendance</a>}
            <Link href={withWorkspaceCycle("/admin/events/new", cycleId)} className="button-primary text-sm">New event</Link>
          </div>
        </div>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {(eventsResult.data ?? []).map((event) => {
            const capacity = event.event_slots.reduce((sum, slot) => sum + slot.capacity, 0);
            const reservations = event.event_slots.reduce((sum, slot) => sum + slot.slot_rsvps.length, 0);
            return (
              <Link key={event.id} href={withWorkspaceCycle(`/admin/events/${event.id}`, cycleId)} className="group grid gap-2 py-4 hover:bg-wash sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-mecg-navy group-hover:text-mecg-blue">{event.name}</h3>
                    <StatusPill tone={event.status === "PUBLISHED" ? "navy" : "neutral"}>{statusLabel(event.status)}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatEasternDateTime(event.starts_at)}{event.location ? ` · ${event.location}` : ""}</p>
                </div>
                <p className="tabular text-xs font-semibold text-muted">{capacity ? `${reservations}/${capacity} booked` : "No slots"}</p>
                <span className="text-sm font-semibold text-mecg-blue">Open →</span>
              </Link>
            );
          })}
          {!eventsResult.data?.length && <p className="py-5 text-sm text-muted">No interview events are scheduled.</p>}
        </div>
      </section>
    </main>
  );
}
