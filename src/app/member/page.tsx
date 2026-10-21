import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { selectWorkspaceMembership, requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
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
import { loadWorkspaceContext } from "@/lib/workspace-context";
import { formatEasternDateTime } from "@/lib/date-time";
import { loadCalibrationStates } from "./calibration/load";
import { GROUP_CASE_VISIBLE_STATUSES, groupCaseWorkspaceState } from "./group-case/workspace-state";
import { evaluationTaskHref, selectedEvaluationAssignment } from "./assignment-navigation";
import { canVoteInStage, currentHashStage } from "@/lib/hash-tally";
import { parseScreeningProgress, screeningDeadlineLabel } from "./screening/screening-draft";
import type { SpeedDatingRoster } from "@/lib/speed-dating-roster";
import { TallySegments, type TallyItem } from "@/components/tally-strip";
import { orderedWorkTasks, roundWorkOpen, taskDeadline, type MemberWorkTask } from "./work-tasks";
import { gradTermBaseYear } from "@/lib/grad-term";

export const metadata: Metadata = { title: "My work" };

function formatDeadline(closesAt: string) {
  return formatEasternDateTime(closesAt);
}

function isSubmitted(assignment: { status: string; evaluations: Array<{ status: string }> }) {
  return ["SUBMITTED", "LOCKED"].includes(assignment.status)
    || assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status));
}

function isReady(assignment: { status: string; evaluations: Array<{ status: string }>; rounds: { status: string; closes_at: string | null } }) {
  return !isSubmitted(assignment)
    && ["ASSIGNED", "IN_PROGRESS"].includes(assignment.status)
    && roundWorkOpen(assignment.rounds);
}

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ round?: string; assignment?: string }> }) {
  const [user, { round: roundFilter, assignment: requestedAssignmentId }] = await Promise.all([requireMember(), searchParams]);
  // Group Case grading moved to its own page; old links and bookmarks still land there.
  if (roundFilter === "GROUP_CASE") redirect(withWorkspaceCycle("/member/group-case", await requestedWorkspaceCycleId()));
  const cycleMembership = await selectWorkspaceMembership(user, ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"]);
  const cycleId = cycleMembership?.cycleId ?? await requestedWorkspaceCycleId();
  if (!cycleMembership) return null;

  const supabase = await createClient();
  const [{ data: assignments, error }, workspaceContext, { data: gradingEvents }, calibrationStates, { data: buddySlots, error: buddySlotsError }, { data: profile }, { data: groupCaseRound, error: groupCaseRoundError }, { data: cycleEvents, error: cycleEventsError }, { data: speedDatingRound, error: speedDatingRoundError }] = await Promise.all([
    supabase.from("evaluation_assignments").select("id, status, updated_at, applications!inner(id, pnms!inner(name)), rounds!inner(id, kind, name, status, closes_at, rubrics!rubrics_round_id_fkey(id, version, minimum_observed_criteria, rubric_criteria(id, name, description, weight, required, position))), evaluations(status)").eq("evaluator_id", user.id).eq("rounds.cycle_id", cycleMembership.cycleId),
    loadWorkspaceContext(cycleMembership.cycleId),
    supabase.rpc("my_grading_events"),
    loadCalibrationStates(supabase, cycleMembership.cycleId),
    supabase.from("buddy_slots").select("id, starts_at, ends_at").eq("cycle_id", cycleMembership.cycleId).eq("member_id", user.id).order("starts_at"),
    supabase.from("profiles").select("display_name,grad_term,major,position_title,bio").eq("id", user.id).maybeSingle(),
    supabase.from("rounds").select("id, status, closes_at").eq("cycle_id", cycleMembership.cycleId).eq("kind", "GROUP_CASE").in("status", [...GROUP_CASE_VISIBLE_STATUSES]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("events").select("id").eq("cycle_id", cycleMembership.cycleId),
    supabase.from("rounds").select("id, kind, status, closes_at").eq("cycle_id", cycleMembership.cycleId).eq("kind", "SPEED_DATING").in("status", ["PUBLISHED", "ACTIVE"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw error;
  if (groupCaseRoundError) throw groupCaseRoundError;
  if (speedDatingRoundError) throw speedDatingRoundError;
  if (cycleEventsError) throw cycleEventsError;
  if (buddySlotsError) throw buddySlotsError;
  if (workspaceContext.error) throw new Error(workspaceContext.error.message);
  const isScreeningReviewer = workspaceContext.data?.isScreeningReviewer ?? false;
  const canGradeRoundWork = !isScreeningReviewer && user.memberships.some((membership) => membership.active && membership.cycleId === cycleId && ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(membership.role));
  const { data: applications, error: applicantsError } = isScreeningReviewer
    ? { data: [], error: null }
    : await supabase.rpc("member_applicants", { target_cycle_id: cycleMembership.cycleId });
  const screeningQueue = isScreeningReviewer
    ? await screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycleMembership.cycleId })
    : { data: [], error: null };
  if (applicantsError) throw applicantsError;
  if (screeningQueue.error) throw new Error(screeningQueue.error.message);
  const screeningContext = isScreeningReviewer
    ? await screeningRpc<unknown>(supabase, "screening_reviewer_context", { target_cycle_id: cycleMembership.cycleId })
    : { data: null, error: null };
  if (screeningContext.error) throw new Error(screeningContext.error.message);
  const screeningProgress = parseScreeningProgress(screeningContext.data);
  const hashStage = currentHashStage(cycleMembership.cycle);
  const canVote = hashStage !== null && user.memberships.some((membership) => membership.active && membership.cycleId === cycleId && canVoteInStage(membership.role, hashStage));
  const speedDating = speedDatingRound?.kind === "SPEED_DATING" ? speedDatingRound : null;
  const speedDatingOpen = speedDating && roundWorkOpen(speedDating);
  const activeRoundFilter = roundFilter === "SPEED_DATING" ? roundFilter : null;
  const [ballot, ownVotes, speedRoster] = await Promise.all([
    canVote ? supabase.rpc("hash_ballot", { target_cycle_id: cycleMembership.cycleId }) : null,
    canVote ? supabase.from("hash_votes").select("application_id,vote").eq("cycle_id", cycleMembership.cycleId).eq("voter_id", user.id).eq("stage", hashStage) : null,
    speedDatingOpen && canGradeRoundWork ? screeningRpc<SpeedDatingRoster>(supabase, "my_speed_dating_roster", { target_round_id: speedDating.id }) : null,
  ]);
  if (ballot?.error) throw ballot.error;
  if (ownVotes?.error) throw ownVotes.error;
  // Same order as the ballot page, so the strip reads like the list it summarises.
  const voteByApplicant = new Map((ownVotes?.data ?? []).map((row) => [row.application_id, row.vote]));
  const ballotProgress: TallyItem[] = [...(ballot?.data ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id }) => {
      const vote = voteByApplicant.get(id);
      return { id, state: vote === "YES" || vote === "UNSURE" || vote === "NO" ? vote : "empty" };
    });
  const ballotVoted = ballotProgress.filter((item) => item.state !== "empty").length;
  // The roster only feeds the progress strip; if it fails, the task shows without counts.
  const speedApplicants = speedRoster?.error ? [] : speedRoster?.data?.applicants ?? [];
  const speedProgress: TallyItem[] = speedApplicants.map((applicant) => ({ id: applicant.applicationId, state: applicant.score === null ? "empty" : "done" }));
  const speedRated = speedProgress.filter((item) => item.state === "done").length;
  // Speed Dating assignments are created in groups and must only be submitted
  // through the atomic group workspace. Never expose a member to this legacy
  // one-applicant evaluation form.
  // Inline Group Case observations use SUBMITTED as a persistence state, not
  // immutable completion. Their own workspace owns quality and editability.
  const assignmentRows = (assignments ?? []).filter((assignment) => !["SPEED_DATING", "GROUP_CASE"].includes(assignment.rounds.kind));
  const groupCaseState = groupCaseRound ? groupCaseWorkspaceState(groupCaseRound) : null;
  const openAssignments = assignmentRows.filter(isReady);
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
  const eligibleAssignmentIds = visible.flatMap((assignment) => {
    if (!isReady(assignment)) return [];
    const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
    return rubric && acknowledgedRubrics.has(rubric.id) ? [assignment.id] : [];
  });
  const selectedAssignmentId = selectedEvaluationAssignment(eligibleAssignmentIds, requestedAssignmentId);
  const cycleEventIds = new Set((cycleEvents ?? []).map((event) => event.id));
  const selectedCycleGradingEvents = (gradingEvents ?? []).filter((event) => cycleEventIds.has(event.event_id));
  const gradingEvent = selectedCycleGradingEvents.find((row) => row.grading_open) ?? selectedCycleGradingEvents[0];
  const currentWorkspace = withWorkspaceCycle(activeRoundFilter ? `/member?round=${activeRoundFilter}` : "/member", cycleId);
  const calibrationTasks = Array.from(new Map(openAssignments.flatMap((assignment) => {
    const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
    return rubric && !acknowledgedRubrics.has(rubric.id)
      ? [[assignment.rounds.id, {
        href: `/member/calibration/${assignment.rounds.id}?return=${encodeURIComponent(currentWorkspace)}`,
        label: `Calibrate for ${assignment.rounds.name}`,
        detail: `Review rubric version ${rubric.version} before evaluating applicants`,
        dueAt: assignment.rounds.closes_at ? taskDeadline(assignment.rounds.closes_at) - 1 : Number.POSITIVE_INFINITY,
      }] as const]
      : [];
  })).values());
  // One list of what this member actually owes, ordered by deadline. Before
  // this, learning whether you were behind meant visiting /member,
  // /member/screening and /member/event and comparing three separate views.
  const tasks = orderedWorkTasks([
    ...calibrationTasks,
    ...openAssignments.filter((assignment) => assignment.rounds.kind !== "GROUP_CASE").flatMap((assignment) => {
      const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
      if (!rubric || !acknowledgedRubrics.has(rubric.id)) return [];
      return [{
        href: evaluationTaskHref(assignment.id),
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
        detail: screeningProgress ? screeningDeadlineLabel(screeningProgress.deadline) : "First read",
        dueAt: taskDeadline(screeningProgress?.deadline),
      })),
    ...(gradingEvent?.grading_open
      ? [{
        href: `/member/event?event=${encodeURIComponent(gradingEvent.event_id)}`,
        label: `Add observations from ${gradingEvent.event_name}`,
        detail: "Qualitative observations are open now",
        dueAt: Number.POSITIVE_INFINITY,
      }]
      : []),
    ...(speedDatingOpen && canGradeRoundWork
      ? [{
          href: "/member/speed-dating",
          label: "Grade Speed Dating",
          detail: [
            speedProgress.length ? `${speedRated} of ${speedProgress.length} rated` : null,
            speedDating.closes_at ? `Closes ${formatDeadline(speedDating.closes_at)} · each rating saves separately` : "Search the applicants in front of you. Each rating saves separately.",
          ].filter(Boolean).join(" · "),
          dueAt: taskDeadline(speedDating.closes_at),
          progress: speedProgress.length ? speedProgress : undefined,
        }]
      : []),
    ...(groupCaseState?.kind === "active" && canGradeRoundWork
      ? [{
          href: withWorkspaceCycle("/member/group-case", cycleId),
          label: "Continue Group Case observations",
          detail: groupCaseState.detail,
          dueAt: taskDeadline(groupCaseRound?.closes_at),
        }]
      : []),
  ]);
  // Eligibility does not reveal whether the member has finished their ballot.
  // Keep voting discoverable without counting it as an unfinished assignment.
  const availableWork: MemberWorkTask[] = canVote
    ? [{
        href: "/member/hash",
        label: "Review your Hash ballot",
        detail: !ballotProgress.length
          ? "Voting is open. Your choices are private; each vote saves separately."
          : ballotVoted === ballotProgress.length
            ? `Ballot complete · ${ballotVoted} of ${ballotVoted} voted. You can change a vote until the board applies the result.`
            : `Voted ${ballotVoted} of ${ballotProgress.length}. Your choices are private; each vote saves separately.`,
        dueAt: Number.POSITIVE_INFINITY,
        action: "Open ballot",
        progress: ballotProgress.length ? ballotProgress : undefined,
      }]
    : [];
  const preparation: MemberWorkTask[] = speedDating?.status === "PUBLISHED" && canGradeRoundWork
    ? [{ href: "/member/speed-dating", label: "Prepare for Speed Dating", detail: "The round is published. Ratings open when the Board starts it.", dueAt: Number.POSITIVE_INFINITY }]
    : [];
  const recentCompletions = assignmentRows
    .filter(isSubmitted)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);
  const assignmentHeading = "Assigned evaluations";
  const unfinishedAssignments = visible.filter((assignment) => !isSubmitted(assignment));
  return (
    <main className="workspace-private workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycleMembership.cycle.name} · ${cycleStatusLabel(cycleMembership.cycle.status)}`}
        title="My work"
        description="Your assigned reviews and the next thing to finish."
      />
      <WorkspaceNav user={user} cycleId={cycleMembership.cycleId} current={currentWorkspace} />

      <div className="member-work-layout">
        <div className="member-work-primary">
          <section aria-labelledby="member-next-task">
            <div className="flex items-center justify-between gap-4">
              <h2 id="member-next-task" className="member-work-title">{tasks.length ? "Needs you" : "You're up to date"}</h2>
              <span className="text-xs text-muted">{tasks.length} open {tasks.length === 1 ? "task" : "tasks"}</span>
            </div>
            <div className="member-task-list">
              {tasks.map((task, index) => <Link key={`${task.href}-${task.label}`} href={withWorkspaceCycle(task.href, cycleId)} className="member-task">
                <span className="member-task-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="member-task-copy"><strong>{task.label}</strong><p>{task.detail}</p>{task.progress && <TallySegments items={task.progress} />}</div>
                <span className="member-task-action">{task.action ?? "Open"}<span aria-hidden="true">→</span></span>
              </Link>)}
              {!tasks.length && <p className="py-6 text-sm leading-6 text-muted">No assigned reviews are waiting. Available voting and preparation appear below when they open.</p>}
            </div>
          </section>
          {availableWork.length > 0 && <section className="mt-6 border-t border-line pt-5" aria-labelledby="member-available"><h2 id="member-available" className="member-work-title">Voting open</h2><div className="member-task-list">{availableWork.map((task) => <Link key={task.href} href={withWorkspaceCycle(task.href, cycleId)} className="member-task" data-kind="ballot">
                <span className="member-task-index" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h12v8H4zM7 9V4h6v5M8.5 6.5l1.2 1.2L12 5.4" /></svg></span>
                <div className="member-task-copy"><strong>{task.label}</strong><p>{task.detail}</p>{task.progress && <TallySegments items={task.progress} />}</div>
                <span className="member-task-action">{task.action ?? "Open"}<span aria-hidden="true">→</span></span>
              </Link>)}</div></section>}
          {preparation.length > 0 && <section className="mt-6 border-t border-line pt-5" aria-labelledby="member-prepare"><h2 id="member-prepare" className="member-work-title">Prepare</h2>{preparation.map((task) => <div key={task.href} className="py-3"><Link href={withWorkspaceCycle(task.href, cycleId)} className="inline-flex min-h-11 items-center text-sm font-semibold">{task.label} →</Link><p className="text-sm text-muted">{task.detail}</p></div>)}</section>}
          {groupCaseState && groupCaseState.kind !== "active" && canGradeRoundWork && <section className="mt-6 border-t border-line pt-5"><h2 className="text-sm font-semibold">Group Case · {groupCaseState.label}</h2><p className="mt-2 text-xs leading-6 text-muted">{groupCaseState.detail}</p><Link href={withWorkspaceCycle("/member/group-case", cycleId)} className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold">{groupCaseState.action} →</Link></section>}
      {unfinishedAssignments.length > 0 && <section className="mt-8">
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
              [withWorkspaceCycle("/member", cycleId), "All work"],
              [withWorkspaceCycle("/member/speed-dating", cycleId), "Speed Dating"],
              [withWorkspaceCycle("/member/group-case", cycleId), "Group Case"],
            ]}
          />
        </div>
        <div className="mt-3.5 flex flex-col gap-4">
          {unfinishedAssignments.map((assignment) => {
            const rubric = [...assignment.rounds.rubrics].sort((a, b) => b.version - a.version)[0];
            const submitted = isSubmitted(assignment);
            const ready = isReady(assignment);
            const calibrated = Boolean(rubric && acknowledgedRubrics.has(rubric.id));
            const selected = assignment.id === selectedAssignmentId;
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
              <article
                id={`assignment-${assignment.id}`}
                key={assignment.id}
                tabIndex={selected ? -1 : undefined}
                aria-labelledby={`assignment-heading-${assignment.id}`}
                className="scroll-mt-24 rounded-xl p-5 inset-ring inset-ring-line focus:outline-2 focus:outline-offset-3 focus:outline-mecg-navy sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-mecg-orange-ink">{assignment.rounds.name}</p>
                    <h3 id={`assignment-heading-${assignment.id}`} className="mt-1.5 text-lg font-semibold text-mecg-navy">{assignment.applications.pnms.name}</h3>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${ready ? "bg-mecg-orange/15 text-mecg-orange-ink" : "bg-wash text-muted"}`}>
                    {statusLabel}
                  </span>
                </div>
                {assignment.rounds.closes_at && <p className="mt-2 text-xs text-muted">Closes {formatDeadline(assignment.rounds.closes_at)}</p>}
                {ready && roundPosition > 0 && (
                  <p className="mt-2 text-xs font-semibold text-muted">Applicant {roundPosition} of {readyInRound.length} in this round</p>
                )}
                {submitted ? (
                  <p className="mt-3 text-sm text-muted">Your evaluation is locked. Contact the Board if you discover an error; submitted work must not be edited directly.</p>
                ) : ready && rubric && calibrated && selected ? (
                  <details className="mt-3" open={selected}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-wash px-4 py-2.5 font-semibold text-mecg-navy inset-ring inset-ring-line marker:content-none">
                      <span>{selected ? "Continue evaluation" : "Open evaluation"}</span>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="disclosure-chevron shrink-0 text-mecg-blue" aria-hidden="true">
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </summary>
                    <div className="disclosure-panel">
                      <EvaluationForm key={assignment.id} assignmentId={assignment.id} criteria={criteria} minimumObservedCriteria={rubric.minimum_observed_criteria} />
                      <p className="mt-3 text-xs leading-5 text-muted">Saving keeps your draft. Review and lock this evaluation when it is complete; the next ready applicant then moves to the top of My Work.</p>
                    </div>
                  </details>
                ) : ready && rubric && calibrated ? (
                  <Link
                    href={withWorkspaceCycle(evaluationTaskHref(assignment.id, activeRoundFilter ?? undefined), cycleId)}
                    className="button-secondary mt-3 inline-flex min-h-11 items-center justify-center text-sm"
                  >
                    Grade this applicant
                  </Link>
                ) : ready && rubric ? (
                  <div className="mt-3 rounded-xl bg-mecg-orange/15 p-4">
                    <p className="text-sm font-semibold text-mecg-navy">Calibration required before evaluation</p>
                    <p className="mt-1 text-xs leading-5 text-muted">Review the active rubric anchors once for this round. Calibration is advisory and never adjusts your score.</p>
                    <Link href={withWorkspaceCycle(`/member/calibration/${assignment.rounds.id}?return=${encodeURIComponent(currentWorkspace)}`, cycleId)} className="button-primary mt-3 inline-flex text-sm">Review calibration</Link>
                  </div>
                ) : ready ? (
                  <p className="mt-3 text-sm text-muted">This round is active, but its scoring guide is unavailable. Contact the Board before evaluating.</p>
                ) : assignment.status === "RECUSED" ? (
                  <p className="mt-3 text-sm text-muted">You are recused from this applicant. No evaluation is required.</p>
                ) : assignment.status === "MISSED" ? (
                  <p className="mt-3 text-sm text-muted">This assignment is closed and marked missed.</p>
                ) : assignment.rounds.status === "ACTIVE" && !roundWorkOpen(assignment.rounds) ? (
                  <p className="mt-3 text-sm text-muted">The grading deadline has passed or is unavailable. This evaluation cannot be edited.</p>
                ) : (
                  <p className="mt-3 text-sm text-muted">This form opens when the Board activates the round.</p>
                )}
              </article>
            );
          })}
          {!visible.length && (
            <div className="rounded-xl border-[1.5px] border-dashed border-line p-7 text-center">
              <p className="font-semibold text-mecg-navy">No assignments in this view</p>
              <p className="mt-1 text-sm text-muted">New work will appear here when the Board assigns and opens a round.</p>
            </div>
          )}
        </div>
      </section>}
        </div>
      <aside className="member-work-secondary" aria-label="Activity and account">
        <h2>Submitted and locked</h2>
        {recentCompletions.length > 0 && <p className="mt-2 text-xs leading-5 text-muted">Your evaluation is locked. Contact the Board if you discover an error; submitted work must not be edited directly.</p>}
        <div className="mt-3.5 flex flex-col gap-2">
          {recentCompletions.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-mecg-navy">{assignment.applications.pnms.name}</p>
                <p className="mt-0.5 text-xs text-muted">{assignment.rounds.name}</p>
              </div>
              <span className="text-xs font-semibold text-success">Submitted</span>
            </div>
          ))}
          {!recentCompletions.length && <p className="text-xs leading-6 text-muted">Your submitted evaluations will appear here.</p>}
        </div>
        {!isScreeningReviewer && (
          <details className="mt-6 border-t border-line pt-4">
            <summary className="min-h-11 cursor-pointer text-xs font-semibold text-mecg-navy">Report a conflict</summary>
            <div className="mt-4">
              <ConflictForm applications={(applications ?? []).map((application) => ({ id: application.id, name: application.name }))} />
            </div>
          </details>
        )}
        <details className="mt-4 border-t border-line pt-4">
          <summary className="min-h-11 cursor-pointer text-xs font-semibold text-mecg-navy">Profile and availability</summary>
          <p className="mt-2 text-sm text-muted">Update your profile or add available times for buddy meetings.</p>
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
              gradBaseYear={gradTermBaseYear(new Date())}
            />
          </div>
        </details>
        <figure className="member-community">
          <div className="member-community-image"><Image src="/mecg/chapter-presentation-2026.jpeg" alt="MECG members together at a chapter presentation" fill sizes="(min-width: 1024px) 216px, 360px" /></div>
          <figcaption>MECG members at a chapter presentation.</figcaption>
          <Link href="/team">Meet the chapter <span className="ml-2" aria-hidden="true">→</span></Link>
        </figure>
      </aside>
      </div>
    </main>
  );
}
