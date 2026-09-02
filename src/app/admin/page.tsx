import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import SectionLabel from "@/components/section-label";
import StatTile from "@/components/stat-tile";
import SetupForm from "./setup-form";
import { AddApplicantForm } from "./rush-controls";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import PipelineBoard from "./pipeline-board";
import { DECIDED_PIPELINE_STATUSES, isPipelineStatus } from "@/lib/workflow";
import { easternDateBadge, formatEasternDateTime } from "@/lib/date-time";
import { cycleStatusLabel, statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Board dashboard" };

function eventBadge(startsAt: string) {
  return easternDateBadge(startsAt);
}

function eventDate(startsAt: string) {
  return formatEasternDateTime(startsAt);
}

function submittedDate(submittedAt: string) {
  return new Date(submittedAt).toLocaleDateString("en-US", {
    timeZone: "America/Detroit",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { count: cycleCount, error: countError } = await supabase.from("rush_cycles").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (!cycleCount) {
    return (
      <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
        <WorkspaceHeader eyebrow="Setup" title="MECG rush setup" description={`Signed in as ${user.name}`} />
        <SetupForm />
      </main>
    );
  }
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const canHash = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canExport = hasPermission(user.memberships, cycleId, "EXPORT");
  const [cycleResult, roundsResult, appsResult, eventsResult, evaluationAssignmentsResult, decisionsResult, auditResult, eventSlotsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,status").eq("cycle_id", cycleId).order("name"),
    supabase
      .from("applications")
      .select("id,status,submitted_at,resume_storage_path,pnms!inner(id,name,contact)")
      .eq("cycle_id", cycleId)
      .not("submitted_at", "is", null)
      .neq("status", "DRAFT"),
    supabase.from("events").select("id,name,starts_at").eq("cycle_id", cycleId).order("starts_at"),
    supabase.from("evaluation_assignments").select("id,status,rounds!inner(cycle_id)").eq("rounds.cycle_id", cycleId),
    supabase.from("decisions").select("id,status,decision_approvals(id)").eq("cycle_id", cycleId),
    supabase.from("audit_events").select("id,actor_id,action,created_at").eq("cycle_id", cycleId).order("created_at", { ascending: false }).limit(8),
    supabase.from("event_slots").select("id,capacity,event_id,slot_rsvps(id),events!inner(cycle_id)").eq("events.cycle_id", cycleId),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, eventsResult, evaluationAssignmentsResult, decisionsResult, auditResult, eventSlotsResult]) {
    if (result.error) throw result.error;
  }
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const applications = (appsResult.data ?? [])
    .flatMap((application) => {
      if (!application.submitted_at || !isPipelineStatus(application.status)) return [];
      return [{ ...application, status: application.status, submitted_at: application.submitted_at }];
    })
    .sort((a, b) => a.pnms.name.localeCompare(b.pnms.name));
  const events = eventsResult.data ?? [];
  const decidedCount = applications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;
  const resumeCount = applications.filter((application) => application.resume_storage_path).length;
  const missingResumeCount = applications.length - resumeCount;
  const submittedCount = applications.filter((application) => application.status === "SUBMITTED").length;
  const finalReviewCount = applications.filter((application) => application.status === "FINAL_REVIEW").length;
  const activeRounds = (roundsResult.data ?? []).filter((round) => ["PUBLISHED", "ACTIVE"].includes(round.status));
  const now = new Date().getTime();
  const nextEvent = events.find((event) => new Date(event.starts_at).getTime() >= now);
  const nextEventId = nextEvent?.id;
  const nextEventSlots = nextEvent ? (eventSlotsResult.data ?? []).filter((slot) => slot.event_id === nextEvent.id) : [];
  const nextEventCapacity = nextEventSlots.reduce((sum, slot) => sum + slot.capacity, 0);
  const nextEventRsvps = nextEventSlots.reduce((sum, slot) => sum + slot.slot_rsvps.length, 0);

  const totalAssignments = evaluationAssignmentsResult.data?.length ?? 0;
  const submittedAssignments = (evaluationAssignmentsResult.data ?? []).filter((assignment) => ["SUBMITTED", "LOCKED"].includes(assignment.status)).length;

  const decisions = decisionsResult.data ?? [];
  const decisionFunnel = [
    ["pending", decisions.filter((decision) => decision.status === "PENDING" && decision.decision_approvals.length === 0).length],
    ["awaiting 2nd approval", decisions.filter((decision) => decision.status === "PENDING" && decision.decision_approvals.length === 1).length],
    ["approved", decisions.filter((decision) => ["APPROVED", "LOCKED"].includes(decision.status)).length],
    ["released", decisions.filter((decision) => decision.status === "RELEASED").length],
  ] as const;

  const auditEvents = auditResult.data ?? [];
  const auditActorIds = [...new Set(auditEvents.map((event) => event.actor_id).filter((actorId): actorId is string => Boolean(actorId)))];
  const { data: auditActorProfiles, error: auditActorProfilesError } = auditActorIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", auditActorIds)
    : { data: [], error: null };
  if (auditActorProfilesError) console.error("audit actor lookup failed", auditActorProfilesError);
  const auditActorNameById = new Map((auditActorProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

  const STATS = [
    [String(applications.length), "total applicants"],
    [String(applications.length - decidedCount), "still in the running"],
    [String(finalReviewCount), "ready for final review"],
    [String(activeRounds.length), "active rounds"],
    [`${submittedAssignments}/${totalAssignments}`, "evaluations submitted"],
  ] as const;

  const attentionItems = [
    missingResumeCount > 0
      ? { count: missingResumeCount, label: "missing resumes", detail: "Follow up before review", filter: "MISSING_RESUME" }
      : null,
    submittedCount > 0
      ? { count: submittedCount, label: "new submissions", detail: "Waiting for eligibility review", filter: "SUBMITTED" }
      : null,
    finalReviewCount > 0
      ? { count: finalReviewCount, label: "ready for final review", detail: "Move toward a decision", filter: "FINAL_REVIEW" }
      : null,
  ].filter((item): item is { count: number; label: string; detail: string; filter: string } => Boolean(item));

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Board dashboard"
        description={`Signed in as ${user.name}`}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Recruitment overview</SectionLabel>
          <span className="rounded-full bg-mecg-navy/[0.07] px-2.5 py-1 text-xs font-semibold text-mecg-navy/65">
            {cycleStatusLabel(cycle.status)}
          </span>
        </div>
        <div className="mt-3.5 border-y border-mecg-navy/10">
          <div className="grid lg:grid-cols-[1fr_18rem]">
            <div className="py-4 lg:pr-6">
              <p className="text-xs font-semibold text-mecg-navy/55">Cycle pulse</p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-mecg-navy">
                {applications.length - decidedCount > 0
                  ? `${applications.length - decidedCount} applicants are moving through review`
                  : "No applicants are currently in review"}
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                {STATS.map(([value, label]) => (
                  <div key={label}>
                    <dt className="text-xs leading-4 text-mecg-navy/55">{label}</dt>
                    <dd className="tabular text-lg font-semibold text-mecg-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="border-t border-mecg-navy/10 py-4 lg:border-l lg:border-t-0 lg:pl-6">
              <p className="text-xs font-semibold text-mecg-navy/55">Coming up</p>
              {nextEvent ? (
                <div className="mt-2">
                  <p className="font-semibold text-mecg-navy">{nextEvent.name}</p>
                  <p className="mt-1 text-sm text-mecg-navy/55">{eventDate(nextEvent.starts_at)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {nextEventCapacity > 0 && (
                      <p className="tabular text-xs text-mecg-navy/60">{nextEventRsvps}/{nextEventCapacity} RSVPs</p>
                    )}
                    <Link href={`/admin/events/${nextEvent.id}`} className="text-sm font-semibold text-mecg-blue hover:text-mecg-orange-ink">
                      Open event →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-mecg-navy/55">No upcoming events are scheduled.</p>
                  {canOperate && <Link href="/admin/events/new" className="text-sm font-semibold text-mecg-blue hover:text-mecg-orange-ink">Schedule an event →</Link>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-mecg-navy/65">Needs attention</p>
              {attentionItems.length > 0 && <p className="mt-0.5 text-sm text-mecg-navy/55">The items most likely to slow this cycle down.</p>}
            </div>
            <span className="tabular text-xs font-semibold text-mecg-navy/65">{attentionItems.length} queues</span>
          </div>
          {attentionItems.length ? (
            <div className="mt-2.5 grid border-y border-mecg-navy/10 sm:grid-cols-3 sm:divide-x sm:divide-mecg-navy/10">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  href={`/admin?filter=${item.filter}#applicants`}
                  className="flex items-center gap-3 border-b border-mecg-navy/10 py-2.5 transition-colors duration-[--t-detent] ease-[--ease-detent] last:border-b-0 hover:bg-mecg-navy/[0.03] sm:border-b-0 sm:px-3 sm:first:pl-0 sm:last:pr-0"
                >
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-mecg-orange/[0.16] px-2 tabular text-sm font-bold text-mecg-orange-ink">{item.count}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-mecg-navy">{item.label}</p>
                    <p className="mt-0.5 text-xs text-mecg-navy/60">{item.detail}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-mecg-navy/55">No immediate issues. Everything is moving.</p>
          )}
        </div>
      </section>
      <PipelineBoard
        applications={applications.map((application) => ({
          id: application.id,
          status: application.status,
          name: application.pnms.name,
          contact: application.pnms.contact,
          submittedAt: application.submitted_at,
          submittedLabel: submittedDate(application.submitted_at),
          hasResume: Boolean(application.resume_storage_path),
        }))}
        canOperate={canOperate || hasPermission(user.memberships, cycle.id, "RECRUITMENT_OPERATIONS")}
        cycleId={cycle.id}
      />
      {canOperate && (
        <section>
          <SectionLabel>Activity</SectionLabel>
          <div className={`mt-3.5 grid gap-8 ${canHash ? "lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
            {canHash && (
              <div>
                <p className="text-[13px] font-semibold text-mecg-navy/65">Decision funnel</p>
                <div className="mt-2.5 grid grid-cols-2 gap-3 border-y border-mecg-navy/10 py-3 sm:grid-cols-4">
                  {decisionFunnel.map(([label, value]) => (
                    <StatTile key={label} value={value} label={label} tone="light" />
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-mecg-navy/65">Recent activity</p>
              <div className="mt-2.5 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
                {auditEvents.length ? auditEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-mecg-navy">{statusLabel(event.action)}</p>
                      <p className="text-xs text-mecg-navy/60">{event.actor_id ? (auditActorNameById.get(event.actor_id) ?? "Unknown board member") : "System"}</p>
                    </div>
                    <time className="shrink-0 tabular text-xs text-mecg-navy/65">{formatEasternDateTime(event.created_at)}</time>
                  </div>
                )) : <p className="py-3 text-sm text-mecg-navy/55">No recent activity.</p>}
              </div>
            </div>
          </div>
        </section>
      )}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Attendance events</h2>
          <div className="flex items-center gap-3">
            {canExport && (
              <a href={`/api/admin/export?cycleId=${cycle.id}`} className="button-secondary text-sm">Export attendance CSV</a>
            )}
            {canOperate && <Link href="/admin/events/new" className="button-secondary text-sm">+ New event</Link>}
          </div>
        </div>
        <div className="mt-3.5 grid border-t border-mecg-navy/10 sm:grid-cols-2 sm:gap-x-6">
          {events.map((event) => {
            const { month, day } = eventBadge(event.starts_at);
            const isPast = new Date(event.starts_at).getTime() < now;
            return (
              <div key={event.id} className={`flex min-w-0 items-center gap-3 border-b border-mecg-navy/10 py-3 ${isPast ? "opacity-55" : ""}`}>
                <div className={`flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg tabular text-white ${isPast ? "bg-mecg-navy/50" : "bg-mecg-navy"}`}>
                  <span className="text-xs font-semibold leading-none">{month}</span>
                  <span className="text-sm font-bold">{day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-mecg-navy">{event.name}</p>
                    {event.id === nextEventId && (
                      <span className="inline-flex items-center rounded-full bg-mecg-orange/[0.16] px-2 py-0.5 text-xs font-semibold text-mecg-orange-ink">Next</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-mecg-navy/55">{eventDate(event.starts_at)}</p>
                </div>
                <Link href={`/admin/events/${event.id}`} className="shrink-0 text-xs font-semibold text-mecg-blue hover:text-mecg-orange-ink">
                  View →
                  <span className="sr-only"> {event.name}</span>
                </Link>
              </div>
            );
          })}
          {!events.length && (
            <p className="border-b border-mecg-navy/10 py-4 text-sm text-mecg-navy/55 sm:col-span-2">
              No events yet. Add one to start tracking RSVPs and check-ins.
            </p>
          )}
        </div>
      </section>
      {canOperate && (
        <section>
          <SectionLabel number="04">Add an applicant</SectionLabel>
          <div className="mt-3.5">
            <AddApplicantForm cycleId={cycle.id} />
          </div>
        </section>
      )}
    </main>
  );
}
