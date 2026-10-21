import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import SetupForm from "./setup-form";
import { AddApplicantForm } from "./rush-controls";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import PipelineBoard from "./pipeline-board";
import { DECIDED_PIPELINE_STATUSES, PIPELINE_STATUSES, isPipelineStatus } from "@/lib/workflow";
import { formatEasternDateTime } from "@/lib/date-time";
import { applicationStatusLabel, cycleStatusLabel } from "@/lib/labels";
import { isMissingSchemaObject } from "@/lib/schema-availability";

export const metadata: Metadata = { title: "Recruitment" };

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
  const cycleId = await selectWorkspaceCycle(user.memberships, ["RECRUITMENT_OPERATIONS", "HASH_PANEL_ACCESS"]);
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
  if (!cycleId) redirect("/member");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const [cycleResult, roundsResult, appsResult, eventsResult, evaluationAssignmentsResult, eventSlotsResult, referralsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,status").eq("cycle_id", cycleId).order("name"),
    supabase
      .from("applications")
      .select("id,status,submitted_at,resume_storage_path,pnms!inner(id,name,contact,major)")
      .eq("cycle_id", cycleId)
      .not("submitted_at", "is", null)
      .neq("status", "DRAFT"),
    supabase.from("events").select("id,name,starts_at,checkins(count)").eq("cycle_id", cycleId).order("starts_at"),
    supabase.from("evaluation_assignments").select("id,status,rounds!inner(cycle_id)").eq("rounds.cycle_id", cycleId),
    supabase.from("event_slots").select("id,capacity,event_id,slot_rsvps(id),events!inner(cycle_id)").eq("events.cycle_id", cycleId),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId),
  ]);
  // Deliberately separate and deliberately not fatal: this column arrives with a
  // migration, and a dashboard that 500s for everyone until someone runs
  // `supabase db push` is a worse failure than a roster showing initials.
  const headshotResult = await supabase
    .from("applications")
    .select("id,headshot_storage_path")
    .eq("cycle_id", cycleId)
    .not("headshot_storage_path", "is", null);
  if (headshotResult.error && !isMissingSchemaObject(headshotResult.error)) {
    console.error("headshot roster lookup failed", headshotResult.error);
  }
  const headshotIds = new Set((headshotResult.data ?? []).map((row) => row.id));
  for (const result of [cycleResult, roundsResult, appsResult, eventsResult, evaluationAssignmentsResult, eventSlotsResult, referralsResult]) {
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
  const upcomingEvents = events.filter((event) => new Date(event.starts_at).getTime() >= now);
  const pastEvents = events.filter((event) => new Date(event.starts_at).getTime() < now);
  const nextEventSlots = nextEvent ? (eventSlotsResult.data ?? []).filter((slot) => slot.event_id === nextEvent.id) : [];
  const nextEventCapacity = nextEventSlots.reduce((sum, slot) => sum + slot.capacity, 0);
  const nextEventRsvps = nextEventSlots.reduce((sum, slot) => sum + slot.slot_rsvps.length, 0);

  const totalAssignments = evaluationAssignmentsResult.data?.length ?? 0;
  const submittedAssignments = (evaluationAssignmentsResult.data ?? []).filter((assignment) => ["SUBMITTED", "LOCKED"].includes(assignment.status)).length;

  const stages = [
    ...PIPELINE_STATUSES.filter((status) => !DECIDED_PIPELINE_STATUSES.has(status)).map((status) => ({
      key: status,
      label: applicationStatusLabel(status),
      count: applications.filter((application) => application.status === status).length,
      href: `/admin?filter=${status}#applicants`,
    })),
    { key: "DECIDED", label: "Decided", count: decidedCount, href: "/admin?view=PIPELINE&decided=1#applicants" },
  ];

  const attentionItems = [
    missingResumeCount > 0
      ? { count: missingResumeCount, label: "missing resumes", detail: "Follow up before review", filter: "MISSING_RESUME" }
      : null,
    submittedCount > 0
      ? { count: submittedCount, label: "new submissions", detail: "Waiting for eligibility review", filter: "SUBMITTED" }
      : null,
    finalReviewCount > 0
      ? { count: finalReviewCount, label: "in final review", detail: "Review evidence before a decision", filter: "FINAL_REVIEW" }
      : null,
  ].filter((item): item is { count: number; label: string; detail: string; filter: string } => Boolean(item));

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)} · ${activeRounds.length} active ${activeRounds.length === 1 ? "round" : "rounds"}`}
        title="Recruitment"
        description="Review applicants, resolve the next bottleneck, and keep this cycle moving."
        action={canOperate ? <Link href={withWorkspaceCycle("/admin/events/new", cycleId)} className="button-secondary">Schedule event</Link> : undefined}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <nav className="recruitment-stages" aria-label={`${applications.length} applicants by stage`}>
        {stages.map((stage) => <Link data-roster-queue key={stage.key} href={withWorkspaceCycle(stage.href, cycleId)} className="recruitment-stage" data-attention={stage.key === "FINAL_REVIEW" && stage.count > 0 ? "" : undefined} data-empty={stage.count === 0 ? "" : undefined}><strong>{stage.count}</strong><span>{stage.label}</span></Link>)}
      </nav>
      <div className="recruitment-layout">
        <aside className="recruitment-rail lg:col-start-2 lg:row-start-1" aria-label="Cycle priorities">
          <section>
            <h2>Needs your attention</h2>
            {attentionItems.length ? attentionItems.map(item => <Link data-roster-queue key={item.label} href={withWorkspaceCycle(`/admin?filter=${item.filter}#applicants`, cycleId)} className="recruitment-queue"><span>{item.count}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div><span aria-hidden="true">→</span></Link>) : <p className="text-sm text-muted">No missing resumes, new submissions or applicants in final review. Evidence and release checks remain in each applicant file.</p>}
          </section>
          <section>
            <h2>Next on the calendar</h2>
            {upcomingEvents.length ? upcomingEvents.slice(0, 1).map(event => <article key={event.id} className="recruitment-event"><Link href={withWorkspaceCycle(`/admin/events/${event.id}`, cycleId)}>{event.name}</Link><p>{eventDate(event.starts_at)}</p><p>{event.checkins[0]?.count ?? 0} checked in{event.id === nextEvent?.id && nextEventCapacity > 0 && <> · {nextEventRsvps}/{nextEventCapacity} RSVPs</>}</p></article>) : <p className="text-sm text-muted">No upcoming events scheduled.</p>}
            {upcomingEvents.length > 1 && <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Later events · {upcomingEvents.length - 1}</summary>{upcomingEvents.slice(1).map(event => <article key={event.id} className="recruitment-event"><Link href={withWorkspaceCycle(`/admin/events/${event.id}`, cycleId)}>{event.name}</Link><p>{eventDate(event.starts_at)}</p></article>)}</details>}
            {pastEvents.length > 0 && <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Past events · {pastEvents.length}</summary>{pastEvents.slice().reverse().map(event => <article key={event.id} className="recruitment-event"><Link href={withWorkspaceCycle(`/admin/events/${event.id}`, cycleId)}>{event.name}</Link><p>{eventDate(event.starts_at)} · {event.checkins[0]?.count ?? 0} checked in</p></article>)}</details>}
          </section>
          <section>
            <h2>Evaluation progress</h2>
            <p className="text-sm leading-6 text-muted">{submittedAssignments} of {totalAssignments} assigned evaluations submitted.</p>
            {canOperate && <Link href={withWorkspaceCycle("/admin/rounds", cycleId)} className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-mecg-navy">Review interview progress →</Link>}
          </section>
        </aside>
        <div className="recruitment-main lg:col-start-1 lg:row-start-1">
          <PipelineBoard
            applications={applications.map((application) => ({
              id: application.id, status: application.status, name: application.pnms.name,
              contact: application.pnms.contact, major: application.pnms.major ?? "",
              submittedAt: application.submitted_at, submittedLabel: submittedDate(application.submitted_at),
              hasResume: Boolean(application.resume_storage_path),
              hasHeadshot: canOperate && headshotIds.has(application.id),
            }))}
            canOperate={canOperate}
            canAdvance={hasPermission(user.memberships, cycle.id, "MANAGE_CYCLE")}
            cycleId={cycle.id}
            referralCount={referralsResult.count ?? 0}
          />
          {canOperate && <details className="recruitment-manual"><summary>Add an applicant manually</summary><p className="mb-4 text-sm text-muted">Use this when someone cannot submit the standard application.</p><AddApplicantForm cycleId={cycle.id} /></details>}
        </div>

      </div>
    </main>
  );
}
