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

export const metadata: Metadata = { title: "Board dashboard" };

function eventBadge(startsAt: string) {
  const date = new Date(startsAt);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString("en-US", { day: "2-digit" }),
  };
}

function eventDate(startsAt: string) {
  return new Date(startsAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function submittedDate(submittedAt: string) {
  return new Date(submittedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Detroit",
  });
}

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { count: cycleCount, error: countError } = await supabase.from("rush_cycles").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (!cycleCount) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
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
    [String(applications.length - decidedCount), "active in pipeline"],
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
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Board dashboard"
        description={`Signed in as ${user.name}`}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <section>
        <SectionLabel>Recruitment overview</SectionLabel>
        <div className="mt-3.5 overflow-hidden rounded-2xl bg-mecg-navy text-white ring-1 ring-white/12">
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="bg-mecg-navy p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Cycle pulse</p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.025em]">{applications.length - decidedCount} applicants are moving through review</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
                  {cycle.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                {STATS.map(([value, label]) => (
                  <StatTile key={label} value={value} label={label} tone="dark" />
                ))}
              </div>
            </div>
            <div className="bg-white/5 p-4 sm:p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Coming up</p>
              {nextEvent ? (
                <div className="mt-4">
                  <p className="text-lg font-semibold">{nextEvent.name}</p>
                  <p className="mt-1.5 text-sm text-white/55">{eventDate(nextEvent.starts_at)}</p>
                  {nextEventCapacity > 0 && (
                    <p className="mt-1.5 font-mono text-xs text-white/60">{nextEventRsvps}/{nextEventCapacity} RSVPs</p>
                  )}
                  <Link href={`/admin/events/${nextEvent.id}`} className="button-light mt-5 text-xs">
                    Open event
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm leading-6 text-white/55">No upcoming events are scheduled.</p>
                  {canOperate && <Link href="/admin/events/new" className="mt-4 inline-flex text-sm font-semibold text-mecg-orange">Schedule an event →</Link>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-paper p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/65">Needs attention</p>
              <p className="mt-1 text-sm text-mecg-navy/55">The items most likely to slow this cycle down.</p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-mecg-navy/65">{attentionItems.length} queues</span>
          </div>
          {attentionItems.length ? (
            <div className="mt-3 grid gap-px overflow-hidden rounded-xl bg-mecg-navy/10 sm:grid-cols-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  href={`/admin?filter=${item.filter}#applicants`}
                  className="flex items-center gap-3 bg-white p-3 transition-colors duration-[--t-detent] ease-[--ease-detent] hover:bg-mecg-navy/[0.03]"
                >
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-mecg-orange/[0.16] px-2 font-mono text-sm font-bold tabular-nums text-mecg-orange-ink">{item.count}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-mecg-navy">{item.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-mecg-navy/60">{item.detail}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-white p-3.5 text-sm text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">No immediate pipeline issues. Everything is moving.</p>
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
          <div className={`mt-3.5 grid gap-4 ${canHash ? "lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
            {canHash && (
              <div className="rounded-2xl bg-paper p-4 sm:p-5">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/65">Decision funnel</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {decisionFunnel.map(([label, value]) => (
                    <StatTile key={label} value={value} label={label} tone="light" />
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-paper p-4 sm:p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/65">Recent activity</p>
              <div className="mt-3 flex flex-col gap-2">
                {auditEvents.length ? auditEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                    <div>
                      <p className="font-medium text-mecg-navy">{event.action.replaceAll("_", " ")}</p>
                      <p className="text-xs text-mecg-navy/60">{event.actor_id ? (auditActorNameById.get(event.actor_id) ?? "Unknown board member") : "System"}</p>
                    </div>
                    <time className="shrink-0 font-mono text-[11px] text-mecg-navy/60">{new Date(event.created_at).toLocaleString()}</time>
                  </div>
                )) : <p className="text-sm text-mecg-navy/55">No recent activity.</p>}
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
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {events.map((event) => {
            const { month, day } = eventBadge(event.starts_at);
            const isPast = new Date(event.starts_at).getTime() < now;
            return (
              <div key={event.id} className={`flex items-center gap-4 rounded-2xl p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] ${isPast ? "opacity-55" : ""}`}>
                <div className={`flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-xl font-mono text-white ${isPast ? "bg-mecg-navy/50" : "bg-mecg-navy"}`}>
                  <span className="text-[10px] font-semibold tracking-[0.06em]">{month}</span>
                  <span className="text-base font-bold">{day}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-mecg-navy">{event.name}</p>
                    {event.id === nextEventId && (
                      <span className="inline-flex items-center rounded-full bg-mecg-orange/[0.16] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink">Next</span>
                    )}
                  </div>
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
          {!events.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55 sm:col-span-2">
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
