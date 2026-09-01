import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import SectionLabel from "@/components/section-label";
import SetupForm from "./setup-form";
import RushControls from "./rush-controls";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import PipelineBoard from "./pipeline-board";
import { DECIDED_PIPELINE_STATUSES, isPipelineStatus } from "@/lib/workflow";
import type { Database } from "@/lib/supabase/database.types";

type MemberRole = Database["rush"]["Enums"]["member_role"];

const ROLE_PRIORITY: readonly MemberRole[] = ["OWNER", "PANEL", "BOARD", "RECRUITMENT_COMMITTEE", "MEMBER"];

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
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canManageMemberships = hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS");
  const [cycleResult, roundsResult, appsResult, membersResult, eventsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,status").eq("cycle_id", cycleId).order("name"),
    supabase
      .from("applications")
      .select("id,status,submitted_at,resume_storage_path,pnms!inner(id,name,contact)")
      .eq("cycle_id", cycleId)
      .not("submitted_at", "is", null)
      .neq("status", "DRAFT"),
    supabase.from("memberships").select("id,user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    supabase.from("events").select("id,name,starts_at").eq("cycle_id", cycleId).order("starts_at"),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, membersResult, eventsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const applications = (appsResult.data ?? [])
    .flatMap((application) => {
      if (!application.submitted_at || !isPipelineStatus(application.status)) return [];
      return [{ ...application, status: application.status, submitted_at: application.submitted_at }];
    })
    .sort((a, b) => a.pnms.name.localeCompare(b.pnms.name));
  const events = eventsResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberAccounts = Array.from(
    members.reduce((accounts, membership) => {
      const account = accounts.get(membership.user_id);
      if (account) account.roles.push(membership.role);
      else accounts.set(membership.user_id, {
        id: membership.user_id,
        name: membership.profiles.display_name,
        roles: [membership.role],
      });
      return accounts;
    }, new Map<string, { id: string; name: string; roles: MemberRole[] }>()),
  ).map(([, account]) => ({
    ...account,
    role: ROLE_PRIORITY.find((role) => account.roles.includes(role)) ?? "MEMBER",
  })).sort((a, b) => a.name.localeCompare(b.name));
  const decidedCount = applications.filter((application) => DECIDED_PIPELINE_STATUSES.has(application.status)).length;
  const resumeCount = applications.filter((application) => application.resume_storage_path).length;
  const missingResumeCount = applications.length - resumeCount;
  const submittedCount = applications.filter((application) => application.status === "SUBMITTED").length;
  const finalReviewCount = applications.filter((application) => application.status === "FINAL_REVIEW").length;
  const activeRounds = (roundsResult.data ?? []).filter((round) => ["PUBLISHED", "ACTIVE"].includes(round.status));
  const now = new Date().getTime();
  const nextEvent = events.find((event) => new Date(event.starts_at).getTime() >= now);
  const nextEventId = nextEvent?.id;

  const STATS = [
    [String(applications.length), "total applicants"],
    [String(applications.length - decidedCount), "active in pipeline"],
    [String(finalReviewCount), "ready for final review"],
    [String(activeRounds.length), "active rounds"],
  ] as const;

  const attentionItems = [
    missingResumeCount > 0
      ? { count: missingResumeCount, label: "missing resumes", detail: "Follow up before review" }
      : null,
    submittedCount > 0
      ? { count: submittedCount, label: "new submissions", detail: "Waiting for eligibility review" }
      : null,
    finalReviewCount > 0
      ? { count: finalReviewCount, label: "ready for final review", detail: "Move toward a decision" }
      : null,
  ].filter((item): item is { count: number; label: string; detail: string } => Boolean(item));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Board dashboard"
        description={`Signed in as ${user.name}`}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <section>
        <SectionLabel number="01">Recruitment overview</SectionLabel>
        <div className="mt-3.5 overflow-hidden rounded-[22px] bg-mecg-navy text-white shadow-[0_18px_50px_rgba(7,13,31,0.16)]">
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="bg-mecg-navy p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Cycle pulse</p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.025em]">{applications.length - decidedCount} applicants are moving through review</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
                  {cycle.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
                {STATS.map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-[28px] font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-[10px] uppercase leading-4 tracking-[0.1em] text-white/45">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#111a32] p-5 sm:p-7">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Coming up</p>
              {nextEvent ? (
                <div className="mt-4">
                  <p className="text-lg font-semibold">{nextEvent.name}</p>
                  <p className="mt-1.5 text-sm text-white/55">{eventDate(nextEvent.starts_at)}</p>
                  <Link href={`/admin/events/${nextEvent.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-mecg-navy transition-transform active:scale-[0.96]">
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

        <div className="mt-4 rounded-2xl bg-paper p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/50">Needs attention</p>
              <p className="mt-1 text-sm text-mecg-navy/55">The items most likely to slow this cycle down.</p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-mecg-navy/45">{attentionItems.length} queues</span>
          </div>
          {attentionItems.length ? (
            <div className="mt-4 grid gap-2.5 md:grid-cols-3">
              {attentionItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-mecg-orange/[0.16] px-2 font-mono text-sm font-bold tabular-nums text-mecg-orange-ink">{item.count}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-mecg-navy">{item.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-mecg-navy/45">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-white p-4 text-sm text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">No immediate pipeline issues. Everything is moving.</p>
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
        nonTerminalOnly={false}
      />
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <SectionLabel number="03">Attendance events</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Attendance events</h2>
          </div>
          {canOperate && <Link href="/admin/events/new" className="button-secondary text-sm">+ New event</Link>}
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
          <SectionLabel number="04">Administration</SectionLabel>
          <details className="group mt-3.5 rounded-2xl bg-mecg-navy/[0.025] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 marker:content-none">
              <span>
                <span className="block text-sm font-semibold text-mecg-navy">Quick actions and cycle settings</span>
                <span className="mt-0.5 block text-xs text-mecg-navy/45">Add people, create assignments, or change workflow status.</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/45 transition-transform group-open:rotate-180" aria-hidden="true">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </summary>
            <div className="border-t border-mecg-navy/10 p-5">
              <RushControls
                cycleId={cycle.id}
                cycleStatus={cycle.status}
                canOperate={canOperate}
                canManageCycle={canManageCycle}
                canManageMemberships={canManageMemberships}
                currentUserId={user.id}
                rounds={(roundsResult.data ?? []).map((round) => ({ id: round.id, label: round.name, status: round.status }))}
                memberAccounts={memberAccounts}
                applications={applications.map((application) => ({ id: application.id, label: application.pnms.name }))}
              />
            </div>
          </details>
        </section>
      )}
    </main>
  );
}
