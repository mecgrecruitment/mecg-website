import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EvaluationForm from "./evaluation-form";
import ConflictForm from "./conflict-form";
import ProfileForm from "./profile-form";
import BuddySlotForm from "./buddy-slot-form";
import PillNav from "@/components/pill-nav";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import SectionLabel from "@/components/section-label";
import { assignmentStatusLabel, cycleStatusLabel, roundStatusLabel } from "@/lib/labels";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import { formatEasternDateTime } from "@/lib/date-time";
import type { CalibrationState } from "./calibration/types";

export const metadata: Metadata = { title: "My work" };

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
  const [{ data: assignments, error }, screeningReviewer, { data: gradingEvents }, calibrationResult, { data: buddySlots, error: buddySlotsError }, { data: profile }] = await Promise.all([
    supabase.from("evaluation_assignments").select("id, status, updated_at, applications!inner(id, pnms!inner(name)), rounds!inner(id, kind, name, status, closes_at, rubrics(id, version, rubric_criteria(id, name, description, weight, required, position))), evaluations(status)").eq("evaluator_id", user.id).eq("rounds.cycle_id", cycleMembership.cycleId),
    screeningRpc<boolean>(supabase, "is_active_screening_reviewer", { target_cycle_id: cycleMembership.cycleId }),
    supabase.rpc("my_grading_events"),
    screeningRpc<CalibrationState[]>(supabase, "my_round_calibrations", { target_cycle_id: cycleMembership.cycleId }),
    supabase.from("buddy_slots").select("id, starts_at, ends_at").eq("cycle_id", cycleMembership.cycleId).eq("member_id", user.id).order("starts_at"),
    supabase.from("profiles").select("display_name,grad_term,major,position_title,bio").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (calibrationResult.error) throw new Error(calibrationResult.error.message);
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
  const calibrationStates = calibrationResult.data ?? [];
  const acknowledgedRubrics = new Set(calibrationStates.filter((state) => state.acknowledgedAt).map((state) => state.rubricId));
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
  const firstReadyAssignmentId = visible.find((assignment) => {
    if (!isReady(assignment)) return false;
    const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
    return Boolean(rubric && acknowledgedRubrics.has(rubric.id));
  })?.id;
  const gradingEvent = (gradingEvents ?? []).find((row) => row.grading_open) ?? (gradingEvents ?? [])[0];
  const currentWorkspace = activeRoundFilter ? `/member?round=${activeRoundFilter}` : "/member";
  const calibrationTasks = Array.from(new Map(openAssignments.flatMap((assignment) => {
    const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
    return rubric && !acknowledgedRubrics.has(rubric.id)
      ? [[assignment.rounds.id, {
        href: `/member/calibration/${assignment.rounds.id}?return=${encodeURIComponent(currentWorkspace)}`,
        label: `Calibrate for ${assignment.rounds.name}`,
        detail: `Review rubric version ${rubric.version} before evaluating applicants`,
        dueAt: assignment.rounds.closes_at ? new Date(assignment.rounds.closes_at).getTime() - 1 : -1,
      }] as const]
      : [];
  })).values());
  // One list of what this member actually owes, ordered by deadline. Before
  // this, learning whether you were behind meant visiting /member,
  // /member/screening and /member/event and comparing three separate views.
  const tasks: Array<{ href: string; label: string; detail: string; dueAt: number }> = [
    ...calibrationTasks,
    ...openAssignments.flatMap((assignment) => {
      const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
      if (!rubric || !acknowledgedRubrics.has(rubric.id)) return [];
      return [{
        href: `#assignment-${assignment.id}`,
        label: `Evaluate ${assignment.applications.pnms.name}`,
        detail: assignment.rounds.closes_at ? `${assignment.rounds.name} · closes ${formatDeadline(assignment.rounds.closes_at)}` : assignment.rounds.name,
        dueAt: assignment.rounds.closes_at ? new Date(assignment.rounds.closes_at).getTime() : Number.POSITIVE_INFINITY,
      }];
    }),
    ...(screeningQueue.data ?? [])
      .filter((item) => item.assignment_status === "ASSIGNED")
      .map((item) => ({
        href: `/member/screening/${item.assignment_id}`,
        label: `Screen candidate ${item.candidate_code}`,
        detail: "First read",
        dueAt: Number.POSITIVE_INFINITY,
      })),
    ...(gradingEvent?.grading_open
      ? [{
        href: "/member/event",
        label: `Add observations from ${gradingEvent.event_name}`,
        detail: "Qualitative observations are open now",
        dueAt: 0,
      }]
      : []),
  ].sort((a, b) => a.dueAt - b.dueAt);
  const recentCompletions = assignmentRows
    .filter(isSubmitted)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);
  const assignmentHeading = activeRoundFilter === "SPEED_DATING"
    ? "Quick chats"
    : activeRoundFilter === "GROUP_CASE"
      ? "Group interview"
      : "All evaluation work";
  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycleMembership.cycle.name} · ${cycleStatusLabel(cycleMembership.cycle.status)}`}
        title="My work"
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
              You are caught up. New work appears here when the Board opens a round or assigns an application.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel number="02">Your assignments</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{assignmentHeading}</h2>
          </div>
        </div>
        <div className="mt-3.5">
          <PillNav
            ariaLabel="Filter assignments by round"
            current={currentWorkspace}
            links={[
              ["/member", "All work"],
              ["/member?round=SPEED_DATING", "Quick chats"],
              ["/member?round=GROUP_CASE", "Group interview"],
            ]}
          />
        </div>
        <div className="mt-3.5 flex flex-col gap-4">
          {visible.map((assignment) => {
            const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
            const submitted = isSubmitted(assignment);
            const ready = isReady(assignment);
            const calibrated = Boolean(rubric && acknowledgedRubrics.has(rubric.id));
            const criteria = (rubric?.rubric_criteria ?? []).sort((a, b) => a.position - b.position);
            const readyInRound = visible.filter((candidate) => isReady(candidate) && candidate.rounds.id === assignment.rounds.id);
            const roundPosition = readyInRound.findIndex((candidate) => candidate.id === assignment.id) + 1;
            const statusLabel = submitted
              ? "Submitted"
              : ready
                ? "Ready now"
                : ["RECUSED", "MISSED"].includes(assignment.status)
                  ? assignmentStatusLabel(assignment.status)
                  : roundStatusLabel(assignment.rounds.status);
            return (
              <article id={`assignment-${assignment.id}`} key={assignment.id} className="scroll-mt-6 rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-mecg-orange-ink">{assignment.rounds.name}</p>
                    <h3 className="mt-1.5 text-lg font-semibold text-mecg-navy">{assignment.applications.pnms.name}</h3>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${ready ? "bg-mecg-orange/[0.16] text-mecg-orange-ink" : "bg-mecg-navy/[0.06] text-mecg-navy/55"}`}>
                    {statusLabel}
                  </span>
                </div>
                {assignment.rounds.closes_at && <p className="mt-2 text-xs text-mecg-navy/60">Closes {formatDeadline(assignment.rounds.closes_at)}</p>}
                {ready && roundPosition > 0 && (
                  <p className="mt-2 text-xs font-semibold text-mecg-navy/55">Applicant {roundPosition} of {readyInRound.length} in this round</p>
                )}
                {submitted ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">Your evaluation is locked. Contact the Board if you discover an error; submitted work must not be edited directly.</p>
                ) : ready && rubric && calibrated ? (
                  <details className="mt-3" open={assignment.id === firstReadyAssignmentId}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] marker:content-none">
                      <span>{assignment.id === firstReadyAssignmentId ? "Continue evaluation" : "Open evaluation"}</span>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="disclosure-chevron shrink-0 text-mecg-blue" aria-hidden="true">
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </summary>
                    <div className="disclosure-panel">
                      <EvaluationForm assignmentId={assignment.id} criteria={criteria} />
                      <p className="mt-3 text-xs leading-5 text-mecg-navy/50">Saving keeps your draft. Review and lock this evaluation when it is complete; the next ready applicant then moves to the top of My Work.</p>
                    </div>
                  </details>
                ) : ready && rubric ? (
                  <div className="mt-3 rounded-xl bg-mecg-orange/[0.1] p-4">
                    <p className="text-sm font-semibold text-mecg-navy">Calibration required before evaluation</p>
                    <p className="mt-1 text-xs leading-5 text-mecg-navy/60">Review the active rubric anchors once for this round. Calibration is advisory and never adjusts your score.</p>
                    <Link href={`/member/calibration/${assignment.rounds.id}?return=${encodeURIComponent(currentWorkspace)}`} className="button-primary mt-3 inline-flex text-sm">Review calibration</Link>
                  </div>
                ) : ready ? (
                  <p className="mt-3 text-sm text-mecg-navy/55">This round is active, but its scoring guide is unavailable. Contact the Board before evaluating.</p>
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
        <SectionLabel number="03">Recent completions</SectionLabel>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Finished evaluation work</h2>
        <div className="mt-3.5 flex flex-col gap-2">
          {recentCompletions.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-mecg-navy">{assignment.applications.pnms.name}</p>
                <p className="mt-0.5 text-xs text-mecg-navy/55">{assignment.rounds.name}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-800">Submitted</span>
            </div>
          ))}
          {!recentCompletions.length && <p className="text-sm text-mecg-navy/55">Completed evaluations will appear here.</p>}
        </div>
        {!screeningReviewer.data && (
          <details className="mt-5 rounded-2xl bg-paper p-5">
            <summary className="cursor-pointer font-semibold text-mecg-navy">Need to report a conflict?</summary>
            <div className="mt-4">
              <ConflictForm applications={(applications ?? []).map((application) => ({ id: application.id, name: application.name }))} />
            </div>
          </details>
        )}
        <details className="mt-3 rounded-2xl bg-paper p-5">
          <summary className="cursor-pointer font-semibold text-mecg-navy">Profile and availability</summary>
          <p className="mt-2 text-sm text-mecg-navy/55">Optional account details and buddy availability live here so they do not compete with assigned work.</p>
          <div className="mt-4 flex flex-col gap-4">
            <BuddySlotForm cycleId={cycleMembership.cycleId} slots={(buddySlots ?? []).map((slot) => ({ id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at }))} />
            <ProfileForm
              initial={{
                displayName: profile?.display_name ?? user.name,
                gradTerm: profile?.grad_term ?? "",
                major: profile?.major ?? "",
                position: profile?.position_title ?? "",
                bio: profile?.bio ?? "",
              }}
            />
          </div>
        </details>
      </section>
    </main>
  );
}
