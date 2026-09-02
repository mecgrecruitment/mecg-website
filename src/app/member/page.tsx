import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EvaluationForm from "./evaluation-form";
import ConflictForm from "./conflict-form";
import PasswordForm from "./password-form";
import ProfileForm from "./profile-form";
import BuddySlotForm from "./buddy-slot-form";
import PillNav from "@/components/pill-nav";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import SectionLabel from "@/components/section-label";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import { formatEasternDateTime } from "@/lib/date-time";

export const metadata: Metadata = { title: "Evaluation Hub" };

function formatDeadline(closesAt: string) {
  return formatEasternDateTime(closesAt);
}

function isSubmitted(assignment: { status: string; evaluations: Array<{ status: string }> }) {
  return ["SUBMITTED", "LOCKED"].includes(assignment.status)
    || assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status));
}

function isReady(assignment: { status: string; evaluations: Array<{ status: string }>; rounds: { status: string } }) {
  return !isSubmitted(assignment)
    && ["ASSIGNED", "IN_PROGRESS"].includes(assignment.status)
    && assignment.rounds.status === "ACTIVE";
}

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const [user, { round: roundFilter }] = await Promise.all([requireMember(), searchParams]);
  const cycleMembership = user.memberships.find((membership) => ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role));
  if (!cycleMembership) return null;

  const supabase = await createClient();
  const [{ data: assignments, error }, screeningReviewer, { data: buddySlots, error: buddySlotsError }, { data: gradingEvents }, { data: profile }, { data: record }] = await Promise.all([
    supabase.from("evaluation_assignments").select("id, status, applications!inner(id, pnms!inner(name)), rounds!inner(id, kind, name, status, closes_at, rubrics(id, version, rubric_criteria(id, name, description, weight, required, position))), evaluations(status)").eq("evaluator_id", user.id).eq("rounds.cycle_id", cycleMembership.cycleId),
    screeningRpc<boolean>(supabase, "is_active_screening_reviewer", { target_cycle_id: cycleMembership.cycleId }),
    supabase.from("buddy_slots").select("id, starts_at, ends_at").eq("cycle_id", cycleMembership.cycleId).eq("member_id", user.id).order("starts_at"),
    supabase.rpc("my_grading_events"),
    supabase.from("profiles").select("display_name,grad_term,major,position_title,bio").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_member_record", { target_cycle_id: cycleMembership.cycleId }),
  ]);
  if (error) throw error;
  if (buddySlotsError) throw buddySlotsError;
  const { data: applications, error: applicantsError } = screeningReviewer.data
    ? { data: [], error: null }
    : await supabase.rpc("member_applicants", { target_cycle_id: cycleMembership.cycleId });
  const screeningQueue = screeningReviewer.data
    ? await screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycleMembership.cycleId })
    : { data: [], error: null };
  if (screeningReviewer.error) throw new Error(screeningReviewer.error.message);
  if (applicantsError) throw applicantsError;
  if (screeningQueue.error) throw new Error(screeningQueue.error.message);
  const activeRoundFilter = roundFilter === "SPEED_DATING" || roundFilter === "GROUP_CASE" ? roundFilter : null;
  const assignmentRows = assignments ?? [];
  const openAssignments = assignmentRows.filter(isReady);
  const submittedCount = assignmentRows.filter(isSubmitted).length;
  const waitingCount = assignmentRows.filter((assignment) =>
    !isSubmitted(assignment)
    && ["ASSIGNED", "IN_PROGRESS"].includes(assignment.status)
    && assignment.rounds.status !== "ACTIVE"
  ).length;
  const nextDeadline = openAssignments
    .filter((assignment) => assignment.rounds.closes_at)
    .sort((a, b) => new Date(a.rounds.closes_at!).getTime() - new Date(b.rounds.closes_at!).getTime())[0];
  const visible = assignmentRows
    .filter((assignment) => !activeRoundFilter || assignment.rounds.kind === activeRoundFilter)
    .sort((a, b) => {
      const rank = (assignment: typeof a) => isReady(assignment) ? 0 : isSubmitted(assignment) ? 2 : ["RECUSED", "MISSED"].includes(assignment.status) ? 3 : 1;
      const stateOrder = rank(a) - rank(b);
      if (stateOrder) return stateOrder;
      const deadlineA = a.rounds.closes_at ? new Date(a.rounds.closes_at).getTime() : Number.POSITIVE_INFINITY;
      const deadlineB = b.rounds.closes_at ? new Date(b.rounds.closes_at).getTime() : Number.POSITIVE_INFINITY;
      return deadlineA - deadlineB || a.applications.pnms.name.localeCompare(b.applications.pnms.name);
    });
  const firstReadyAssignmentId = visible.find(isReady)?.id;
  const gradingEvent = (gradingEvents ?? []).find((row) => row.grading_open) ?? (gradingEvents ?? [])[0];
  const currentWorkspace = activeRoundFilter ? `/member?round=${activeRoundFilter}` : "/member";
  // One list of what this member actually owes, ordered by deadline. Before
  // this, learning whether you were behind meant visiting /member,
  // /member/screening and /member/event and comparing three separate views.
  const tasks: Array<{ href: string; label: string; detail: string; dueAt: number }> = [
    ...openAssignments.map((assignment) => ({
      href: `#assignment-${assignment.id}`,
      label: `Evaluate ${assignment.applications.pnms.name}`,
      detail: assignment.rounds.closes_at ? `${assignment.rounds.name} · closes ${formatDeadline(assignment.rounds.closes_at)}` : assignment.rounds.name,
      dueAt: assignment.rounds.closes_at ? new Date(assignment.rounds.closes_at).getTime() : Number.POSITIVE_INFINITY,
    })),
    ...(screeningQueue.data ?? [])
      .filter((item) => item.assignment_status === "ASSIGNED")
      .map((item) => ({
        href: `/member/screening/${item.assignment_id}`,
        label: `Screen candidate ${item.candidate_code}`,
        detail: "Blind first-pass review",
        dueAt: Number.POSITIVE_INFINITY,
      })),
    ...(gradingEvent?.grading_open
      ? [{
        href: "/member/event",
        label: `Grade at ${gradingEvent.event_name}`,
        detail: "Grading is open now",
        dueAt: 0,
      }]
      : []),
  ].sort((a, b) => a.dueAt - b.dueAt);

  const recordCounts = record && typeof record === "object" && !Array.isArray(record) ? record as Record<string, unknown> : {};
  const memberRecord: Array<readonly [string, number]> = [
    ["evaluations submitted", Number(recordCounts.evaluationsSubmitted ?? 0)],
    ["assignments open", Number(recordCounts.assignmentsOpen ?? 0)],
    ["events attended", Number(recordCounts.eventsAttended ?? 0)],
    ["conflicts declared", Number(recordCounts.conflictsDeclared ?? 0)],
  ];
  const assignmentHeading = activeRoundFilter === "SPEED_DATING"
    ? "Speed Dating"
    : activeRoundFilter === "GROUP_CASE"
      ? "Group Case"
      : "All evaluation work";
  const overviewTitle = openAssignments.length
    ? `${openAssignments.length} evaluation${openAssignments.length === 1 ? " is" : "s are"} ready for you`
    : waitingCount
      ? "You are caught up for now"
      : assignmentRows.length
        ? "Your assigned work is complete"
        : "No evaluations have been assigned yet";

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycleMembership.cycle.name} · ${cycleMembership.cycle.status}`}
        title="Evaluation Hub"
        description={`Signed in as ${user.name}`}
      />
      <WorkspaceNav user={user} cycleId={cycleMembership.cycleId} current={currentWorkspace} />

      <section>
        <SectionLabel number="01">What you owe</SectionLabel>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">
          {tasks.length ? `${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"}` : "Nothing is waiting on you"}
        </h2>
        <div className="mt-3.5 flex flex-col gap-2">
          {tasks.map((task) => (
            <Link
              key={`${task.href}-${task.label}`}
              href={task.href}
              className="task-row flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-mecg-navy">{task.label}</span>
                <span className="mt-0.5 block text-[12px] text-mecg-navy/65">{task.detail}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="task-row-arrow shrink-0 text-mecg-blue" aria-hidden="true">
                <path d="M6 4l6 6-6 6" />
              </svg>
            </Link>
          ))}
          {!tasks.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center text-sm text-mecg-navy/55">
              You are caught up. New work appears here when the Board opens a round or assigns a packet.
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionLabel number="02">Review overview</SectionLabel>
        <div className="mt-3.5 overflow-hidden rounded-2xl bg-mecg-navy text-white ring-1 ring-white/12">
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="bg-mecg-navy p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Your work pulse</p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-balance">{overviewTitle}</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
                  {cycleMembership.role.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
                {[
                  [openAssignments.length, "ready now"],
                  [submittedCount, "submitted"],
                  [waitingCount, "waiting to open"],
                  [assignmentRows.length, "total assigned"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-[28px] font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-[10px] uppercase leading-4 tracking-[0.1em] text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 p-5 sm:p-7">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Next deadline</p>
              {nextDeadline?.rounds.closes_at ? (
                <div className="mt-4">
                  <p className="text-lg font-semibold">{formatDeadline(nextDeadline.rounds.closes_at)}</p>
                  <p className="mt-1.5 text-sm text-white/55">{nextDeadline.rounds.name} · {nextDeadline.applications.pnms.name}</p>
                  <a href={`#assignment-${nextDeadline.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-mecg-navy transition-transform duration-150 ease-out active:scale-[0.96]">
                    Open evaluation <span aria-hidden="true">↓</span>
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-white/55">No open evaluation has a deadline right now.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel number="03">Your assignments</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{assignmentHeading}</h2>
          </div>
        </div>
        <div className="mt-3.5">
          <PillNav
            ariaLabel="Filter assignments by round"
            current={currentWorkspace}
            links={[
              ["/member", "All work"],
              ["/member?round=SPEED_DATING", "Speed Dating"],
              ["/member?round=GROUP_CASE", "Group Case"],
            ]}
          />
        </div>
        <div className="mt-3.5 flex flex-col gap-4">
          {visible.map((assignment) => {
            const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
            const submitted = isSubmitted(assignment);
            const ready = isReady(assignment);
            const criteria = (rubric?.rubric_criteria ?? []).sort((a, b) => a.position - b.position);
            const statusLabel = submitted
              ? "Submitted"
              : ready
                ? "Ready now"
                : ["RECUSED", "MISSED"].includes(assignment.status)
                  ? assignment.status
                  : assignment.rounds.status;
            return (
              <article id={`assignment-${assignment.id}`} key={assignment.id} className="scroll-mt-6 rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-orange-ink">{assignment.rounds.name}</p>
                    <h3 className="mt-1.5 text-lg font-semibold text-mecg-navy">{assignment.applications.pnms.name}</h3>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${ready ? "bg-mecg-orange/[0.16] text-mecg-orange-ink" : "bg-mecg-navy/[0.06] text-mecg-navy/55"}`}>
                    {statusLabel.replaceAll("_", " ")}
                  </span>
                </div>
                {assignment.rounds.closes_at && <p className="mt-2 text-xs text-mecg-navy/60">Closes {formatDeadline(assignment.rounds.closes_at)}</p>}
                {submitted ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">Your evaluation is locked. Contact the Board if you discover an error; submitted work must not be edited directly.</p>
                ) : ready && rubric ? (
                  <details className="mt-3" open={assignment.id === firstReadyAssignmentId}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] marker:content-none">
                      <span>{assignment.id === firstReadyAssignmentId ? "Continue evaluation" : "Open evaluation"}</span>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="disclosure-chevron shrink-0 text-mecg-blue" aria-hidden="true">
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </summary>
                    <div className="disclosure-panel">
                      <EvaluationForm assignmentId={assignment.id} criteria={criteria} />
                    </div>
                  </details>
                ) : ready ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">This round is active, but its rubric is unavailable. Contact the Board before evaluating.</p>
                ) : assignment.status === "RECUSED" ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">You are recused from this applicant. No evaluation is required.</p>
                ) : assignment.status === "MISSED" ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">This assignment is closed and marked missed.</p>
                ) : (
                  <p className="mt-3 text-sm text-mecg-navy/55">This form opens when the Board activates the round.</p>
                )}
              </article>
            );
          })}
          {!visible.length && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center">
              <p className="font-semibold text-mecg-navy">No assignments in this view</p>
              <p className="mt-1 text-sm text-mecg-navy/55">New work will appear here when the Board assigns and opens a round.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionLabel number="04">Your record</SectionLabel>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">What you have done this cycle</h2>
        <dl className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {memberRecord.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-paper p-4">
              <dd className="font-mono text-[26px] font-semibold tabular-nums text-mecg-navy">{value}</dd>
              <dt className="mt-1 text-[11px] uppercase leading-4 tracking-[0.1em] text-mecg-navy/45">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <SectionLabel number="05">Member tools</SectionLabel>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Prepare and manage your work</h2>
        {gradingEvent && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-mecg-navy p-5 text-white ring-1 ring-white/12 sm:p-6">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Live event</p>
              <h3 className="mt-2 text-lg font-semibold">{gradingEvent.event_name}</h3>
              <p className="mt-1 text-sm text-white/55">{gradingEvent.grading_open ? "Grading is open" : "Grading closed"}</p>
            </div>
            <Link href="/member/event" className="button-primary">Grade applicants</Link>
          </div>
        )}
        <div className="mt-3.5 grid gap-4 lg:grid-cols-2">
          <BuddySlotForm cycleId={cycleMembership.cycleId} slots={(buddySlots ?? []).map((slot) => ({ id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at }))} />
          <section className="rounded-2xl bg-paper p-5 sm:p-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/65">Before you score</p>
            <h3 className="mt-2 text-lg font-semibold">Calibration anchors</h3>
            <p className="mt-1 text-sm leading-6 text-mecg-navy/55">Use the same evidence standard in every live evaluation.</p>
            <ol className="mt-4 space-y-2 text-sm text-mecg-navy/70">
              {Object.entries(SCORE_ANCHORS).map(([score, meaning]) => (
                <li key={score} className="flex gap-3">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white font-mono text-[11px] font-bold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">{score}</span>
                  <span className="pt-0.5">{meaning}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {!screeningReviewer.data && <ConflictForm applications={(applications ?? []).map((application) => ({ id: application.id, name: application.name }))} />}
          <ProfileForm
            initial={{
              displayName: profile?.display_name ?? user.name,
              gradTerm: profile?.grad_term ?? "",
              major: profile?.major ?? "",
              position: profile?.position_title ?? "",
              bio: profile?.bio ?? "",
            }}
          />
          <PasswordForm />
        </div>
      </section>
    </main>
  );
}
