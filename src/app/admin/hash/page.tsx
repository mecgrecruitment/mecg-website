import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { applicantCode } from "@/lib/applicant-code";
import { screeningRpc } from "@/lib/screening-rpc";
import { hashOutcome } from "@/lib/hash-tally";
import { createAdminClient } from "@/lib/supabase/admin";
import StatusPill from "@/components/status-pill";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import DecisionForm, { ApprovalButton, PreviewForm, ReleaseAllButton, ReleaseButton } from "../decision-form";
import ApplyResultForm from "./apply-result-form";
import { applicantReadinessIssues, cycleReadinessIssues } from "./decision-readiness";
import { applicationStatusLabel, cycleStatusLabel, decisionOutcomeLabel, decisionStatusLabel, roundStatusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Decisions" };

type HashTallyRow = {
  application_id: string;
  yes_count: number;
  no_count: number;
  unsure_count: number;
  total_votes: number;
  quorum: number;
};

// The counts and the rule that reads them belong together, and both layouts
// show the same cell, so the rule is written once here.
function MemberVote({ tally }: { tally: HashTallyRow | undefined }) {
  if (!tally) return <span className="text-[12px] text-mecg-navy/55">—</span>;
  const outcome = hashOutcome(tally.quorum, tally.yes_count, tally.no_count, tally.total_votes);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-[12px] text-mecg-navy/70">
        <span className="tabular">{tally.yes_count}</span> yes · <span className="tabular">{tally.no_count}</span> no · <span className="tabular">{tally.unsure_count}</span> unsure
      </p>
      <StatusPill tone={outcome === "OFFER" ? "navy" : "neutral"}>{outcome === "OFFER" ? "Offer" : outcome === "REJECT" ? "No offer" : "Not enough votes"}</StatusPill>
      {outcome === "PENDING" && <p className="text-[12px] text-mecg-navy/55"><span className="tabular">{tally.total_votes}/{tally.quorum}</span> votes so far</p>}
    </div>
  );
}

// Notes arrive without an author and in an order that cannot be lined up
// against vote timestamps, so they are rendered exactly as they arrive.
function MemberNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-mecg-navy">What members wrote</h3>
      <p className="mt-0.5 text-[12px] text-mecg-navy/55">Notes are shown without names.</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {notes.slice(0, 10).map((note, index) => (
          <li key={`${index}-${note}`} className="text-[12px] leading-5 text-mecg-navy/70">{note}</li>
        ))}
      </ul>
      {notes.length > 10 && <p className="mt-1.5 text-[12px] text-mecg-navy/55">and {notes.length - 10} more</p>}
    </div>
  );
}

// The vote binds, so applying it is the primary action and the hand-written
// outcome sits behind a disclosure: a waitlist or a procedural review are the
// only outcomes a vote cannot produce.
function PendingDecisionPanel({
  cycleId,
  applicationId,
  tally,
  notes,
  canDecide,
}: {
  cycleId: string;
  applicationId: string;
  tally: HashTallyRow | undefined;
  notes: string[];
  canDecide: boolean;
}) {
  if (!canDecide) return <p className="text-[12px] text-mecg-navy/55">Only decision-panel members can record outcomes.</p>;
  const outcome = tally ? hashOutcome(tally.quorum, tally.yes_count, tally.no_count, tally.total_votes) : "PENDING";
  return (
    <div className="flex flex-col gap-3">
      {outcome !== "PENDING" && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] leading-5 text-mecg-navy/60">The members&apos; vote decides this. Applying it records the outcome and locks it.</p>
          <ApplyResultForm applicationId={applicationId} />
        </div>
      )}
      <MemberNotes notes={notes} />
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
          <span>Record a different outcome</span>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-mecg-navy/60 transition-transform group-open:rotate-180">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </summary>
        <div className="mt-2.5 flex flex-col gap-2 px-1">
          <p className="text-[12px] leading-5 text-mecg-navy/55">For a waitlist or a procedural review, which the vote cannot produce.</p>
          <DecisionForm cycleId={cycleId} applicationId={applicationId} />
        </div>
      </details>
    </div>
  );
}

export default async function HashBoard() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canDecide = hasPermission(user.memberships, cycleId, "DECIDE");
  const canRelease = hasPermission(user.memberships, cycleId, "RELEASE");
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  if (!canPanel) redirect("/access-denied");
  // Blind Hash review: a PANEL-only viewer (no MANAGE_CYCLE/RECRUITMENT_OPERATIONS) sees an
  // applicant code instead of a real name, matching blind screening's candidate_code.
  const panelOnly = canPanel && !canManageCycle && !canOperate;
  const supabase = await createClient();
  const [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult, tallyResult, notesResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("decisions").select("id,application_id,outcome,status,reason,communication_preview,decision_approvals(id)").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
    supabase.from("event_impressions").select("application_id,tags,note,events!inner(cycle_id)").eq("events.cycle_id", cycleId),
    screeningRpc<HashTallyRow[]>(supabase, "hash_tally", { target_cycle_id: cycleId }),
    supabase.rpc("hash_notes", { target_cycle_id: cycleId }),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult, notesResult]) if (result.error) throw result.error;
  if (tallyResult.error) throw new Error(tallyResult.error.message);
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const rounds = (roundsResult.data ?? [])
    .filter((round) => round.weight > 0)
    .map((round) => ({ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }));
  const applications = (appsResult.data ?? [])
    .filter((application) => !["DRAFT", "WITHDRAWN"].includes(application.status))
    .map((application) => ({ ...application, displayName: panelOnly ? applicantCode(application.id) : application.pnms.name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  // Readiness is deliberately checked through the service-only database
  // function after the normal page authorization gate. The function returns
  // one boolean and cannot expose evaluation or applicant identity data.
  const admin = createAdminClient();
  const canonicalReadinessEntries = await Promise.all(applications.map(async (application) => {
    const result = await screeningRpc<boolean>(admin, "is_decision_ready", { target_application_id: application.id });
    return [application.id, result.error || typeof result.data !== "boolean" ? undefined : result.data] as const;
  }));
  const canonicalReadinessByApplication = new Map(canonicalReadinessEntries);
  // Managers can see that a recusal exists, but never who declared it or why.
  // PANEL-only reviewers keep the same blind boundary as the applicant query.
  const conflictCountsByApplication = new Map<string, number>();
  if (!panelOnly && applications.length) {
    const { data: conflicts, error: conflictsError } = await admin
      .from("conflict_declarations")
      .select("application_id")
      .in("application_id", applications.map((application) => application.id));
    if (conflictsError) throw conflictsError;
    for (const conflict of conflicts ?? []) {
      conflictCountsByApplication.set(conflict.application_id, (conflictCountsByApplication.get(conflict.application_id) ?? 0) + 1);
    }
  }
  const allDecisions = decisionsResult.data ?? [];
  const decisionByApplication = new Map<string, (typeof allDecisions)[number]>();
  for (const decision of allDecisions) {
    if (!decisionByApplication.has(decision.application_id)) decisionByApplication.set(decision.application_id, decision);
  }
  const tallyByApplication = new Map((tallyResult.data ?? []).map((row) => [row.application_id, row]));
  const quorum = tallyResult.data?.[0]?.quorum ?? 0;
  // Blind review and free text do not mix. A note saying "Sarah interviewed
  // really well" undoes the applicant code two lines above it, and the members
  // writing these notes saw the real name, so nothing stops them. A PANEL-only
  // viewer gets the counts and no prose; whoever can already see names reads
  // the notes.
  const notesByApplication = new Map<string, string[]>();
  if (!panelOnly) {
    for (const row of notesResult.data ?? []) notesByApplication.set(row.application_id, [...(notesByApplication.get(row.application_id) ?? []), row.note]);
  }
  const cycleIssues = cycleReadinessIssues(cycle.status, rounds.map((round) => ({
    id: round.id,
    name: round.name,
    status: round.status,
    weight: round.weight,
    lockedEvaluations: 0,
  })));
  const hashOpen = canPanel && cycleIssues.length === 0;
  const impressionGroups = new Map<string, { count: number; tagCounts: Map<string, number>; notes: string[] }>();
  for (const impression of impressionsResult.data ?? []) {
    const group = impressionGroups.get(impression.application_id) ?? { count: 0, tagCounts: new Map<string, number>(), notes: [] as string[] };
    group.count += 1;
    for (const tag of impression.tags) group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
    if (!panelOnly && impression.note.trim()) group.notes.push(impression.note.trim());
    impressionGroups.set(impression.application_id, group);
  }
  const impressionsByApplication = new Map<string, { count: number; topTags: string[]; notes: string[] }>();
  for (const [applicationId, group] of impressionGroups) {
    impressionsByApplication.set(applicationId, {
      count: group.count,
      topTags: [...group.tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag),
      notes: group.notes,
    });
  }
  const rankings = applications.map((application) => {
    const byRound = rounds.map((round) => {
      const criteria = round.rubric?.rubric_criteria ?? [];
      const scored: ReturnType<typeof scoreEvaluation>[] = [];
      let lockedEvaluations = 0;
      for (const assignment of application.evaluation_assignments) {
        if (assignment.round_id !== round.id) continue;
        if (assignment.evaluations.some((evaluation) => evaluation.status === "LOCKED")) lockedEvaluations += 1;
        for (const evaluation of assignment.evaluations) {
          if (!["SUBMITTED", "LOCKED"].includes(evaluation.status)) continue;
          scored.push(scoreEvaluation(criteria, evaluation.criterion_ratings.map((rating) => ({ criterionId: rating.criterion_id, score: rating.score }))));
        }
      }
      return { round, aggregate: aggregateRound(scored), lockedEvaluations };
    });
    const readiness = applicantReadinessIssues(byRound.map(({ round, aggregate, lockedEvaluations }) => ({
      id: round.id,
      name: round.name,
      status: round.status,
      weight: round.weight,
      lockedEvaluations,
      aggregateStatus: aggregate.status,
      spread: aggregate.spread,
    })), canonicalReadinessByApplication.get(application.id));
    return {
      application,
      rounds: byRound,
      readiness,
      finalScore: combineRoundScores(byRound.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight }))),
    };
  }).sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
  const roundReadiness = rounds.map((round) => {
    const assignments = applications.flatMap((application) => application.evaluation_assignments.filter((assignment) => assignment.round_id === round.id));
    const locked = assignments.filter((assignment) => assignment.evaluations.some((evaluation) => evaluation.status === "LOCKED")).length;
    const covered = applications.filter((application) => application.evaluation_assignments.filter((assignment) => assignment.round_id === round.id && assignment.evaluations.some((evaluation) => evaluation.status === "LOCKED")).length >= 2).length;
    return { ...round, assignmentCount: assignments.length, locked, covered };
  });
  const decisions = [...decisionByApplication.values()];
  const lockedDecisionCount = decisions.filter((decision) => decision.status === "LOCKED").length;
  const exceptionRows = rankings.flatMap(({ application, readiness }) => {
    const decision = decisionByApplication.get(application.id);
    const tally = tallyByApplication.get(application.id);
    const voteOutcome = tally ? hashOutcome(tally.quorum, tally.yes_count, tally.no_count, tally.total_votes) : "PENDING";
    const labels = readiness.issues.map((issue) => issue.label);
    const conflictCount = conflictCountsByApplication.get(application.id) ?? 0;
    if (conflictCount) labels.push(`${conflictCount} active recusal${conflictCount === 1 ? "" : "s"}; approver names remain private.`);
    if (readiness.ready && voteOutcome === "PENDING" && !decision) labels.push("Member vote has not reached quorum.");
    if (readiness.ready && voteOutcome !== "PENDING" && !decision) labels.push("Vote decided; apply the result.");
    if (decision && !["LOCKED", "RELEASED"].includes(decision.status)) labels.push(`${decision.decision_approvals.length}/2 approvals recorded.`);
    if (decision?.status === "LOCKED") labels.push("Outcome is approved and ready to release.");
    return labels.length ? [{ application, labels, blocked: !readiness.ready }] : [];
  });

  return (
    <main className="workspace-stack mx-auto flex max-w-7xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Decisions"
        description="Resolve evidence exceptions, apply the members' vote, approve outcomes, and release them."
        action={hashOpen ? <Link href="/admin/hash/deliberate" className="button-secondary text-sm">Discussion mode</Link> : null}
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/hash" />
      <section aria-labelledby="readiness-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="readiness-heading" className="text-xl font-semibold text-mecg-navy">Decision readiness</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/55">Every weighted round must be frozen and every applicant needs two locked evaluations in each round.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={hashOpen ? "navy" : "neutral"}>{hashOpen ? "Queue open" : `${cycleIssues.length} blocker${cycleIssues.length === 1 ? "" : "s"}`}</StatusPill>
            {canRelease && <ReleaseAllButton cycleId={cycleId} readyCount={lockedDecisionCount} />}
          </div>
        </div>
        {cycleIssues.length > 0 && (
          <ul className="mt-4 border-l-2 border-mecg-orange pl-4 text-sm text-mecg-navy/70">
            {cycleIssues.map((issue) => <li key={issue.key}>{issue.label}</li>)}
          </ul>
        )}
        <div className="mt-4 divide-y divide-mecg-navy/[0.08] border-y border-mecg-navy/[0.1]">
          {roundReadiness.map((round) => (
            <div key={round.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-mecg-navy">{round.name}</h3>
                <StatusPill tone="neutral">{roundStatusLabel(round.status)}</StatusPill>
              </div>
              <p className="text-sm text-mecg-navy/55"><span className="tabular font-semibold text-mecg-navy">{round.locked}/{round.assignmentCount}</span> forms locked</p>
              <p className="text-sm text-mecg-navy/55"><span className="tabular font-semibold text-mecg-navy">{round.covered}/{applications.length}</span> applicants decision-ready</p>
            </div>
          ))}
        </div>
      </section>

      {hashOpen ? (
        <>
          <section aria-labelledby="exceptions-heading">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="exceptions-heading" className="text-xl font-semibold text-mecg-navy">Exception inbox</h2>
                <p className="mt-1 text-sm text-mecg-navy/55">Only evidence gaps, vote holds, recusal signals, and decisions needing action.</p>
              </div>
              <span className="tabular text-sm font-semibold text-mecg-navy/60">{exceptionRows.length} open</span>
            </div>
            {exceptionRows.length ? (
              <ul className="mt-4 divide-y divide-mecg-navy/[0.08] border-y border-mecg-navy/[0.1]">
                {exceptionRows.map(({ application, labels, blocked }) => (
                  <li key={application.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.35fr)_1fr_auto] sm:items-start sm:gap-4">
                    <Link href={`/admin/applications/${application.id}`} className="font-semibold text-mecg-navy underline decoration-mecg-navy/25 underline-offset-2">{application.displayName}</Link>
                    <p className="text-sm leading-6 text-mecg-navy/60">{labels.join(" ")}</p>
                    <StatusPill tone={blocked ? "neutral" : "navy"}>{blocked ? "Blocked" : "Action"}</StatusPill>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-mecg-navy/55">No exceptions. Every outcome has been released.</p>}
          </section>

          <section aria-labelledby="queue-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="queue-heading" className="text-xl font-semibold text-mecg-navy">Ranked decision queue</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/55">The vote binds: {quorum ? `${quorum} votes` : "quorum"} and more Yes than No produces an offer. Expand one applicant to inspect the evidence and act.</p>
              </div>
              <p className="text-sm text-mecg-navy/55"><span className="tabular font-semibold text-mecg-navy">{decisions.length}</span> decisions · <span className="tabular font-semibold text-mecg-navy">{lockedDecisionCount}</span> ready to release</p>
            </div>
            <div className="mt-4 divide-y divide-mecg-navy/[0.1] border-y border-mecg-navy/[0.12]">
              {rankings.map(({ application, rounds: results, finalScore, readiness }, index) => {
                const decision = decisionByApplication.get(application.id);
                const impressions = impressionsByApplication.get(application.id);
                const tally = tallyByApplication.get(application.id);
                const notes = notesByApplication.get(application.id) ?? [];
                const voteDecided = tally ? hashOutcome(tally.quorum, tally.yes_count, tally.no_count, tally.total_votes) !== "PENDING" : false;
                return (
                  <article key={application.id} className="py-4">
                    <div className="grid gap-3 md:grid-cols-[2rem_minmax(10rem,1.2fr)_minmax(10rem,1fr)_7rem_minmax(10rem,0.8fr)] md:items-start">
                      <span className="tabular text-sm font-semibold text-mecg-navy/45">{index + 1}</span>
                      <div>
                        <Link href={`/admin/applications/${application.id}`} className="font-semibold text-mecg-navy underline decoration-mecg-navy/25 underline-offset-2">{application.displayName}</Link>
                        <p className="mt-0.5 text-xs text-mecg-navy/55">{applicationStatusLabel(application.status)}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {results.map(({ round, aggregate }) => (
                          <p key={round.id} className="text-xs text-mecg-navy/55"><span className="font-medium text-mecg-navy">{round.name}</span> {aggregate.score == null ? "Pending" : aggregate.score.toFixed(1)}</p>
                        ))}
                      </div>
                      <p className="tabular text-lg font-bold text-mecg-navy">{finalScore == null ? <span className="text-sm font-normal text-mecg-navy/55">Pending</span> : finalScore.toFixed(1)}</p>
                      <div>
                        {decision
                          ? <StatusPill tone={decision.status === "RELEASED" ? "navy" : "neutral"}>{decisionOutcomeLabel(decision.outcome)} · {decisionStatusLabel(decision.status)}</StatusPill>
                          : <StatusPill tone={voteDecided && readiness.ready ? "navy" : "neutral"}>{voteDecided ? "Vote decided" : "Vote pending"}</StatusPill>}
                      </div>
                    </div>
                    <details className="group mt-3">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-mecg-navy marker:content-none">
                        <span>Evidence and decision</span>
                        <span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="grid gap-5 border-l-2 border-mecg-navy/[0.1] pl-4 lg:grid-cols-[1fr_minmax(17rem,0.65fr)]">
                        <div>
                          <dl className="grid gap-3 sm:grid-cols-2">
                            {results.map(({ round, aggregate, lockedEvaluations }) => (
                              <div key={round.id}>
                                <dt className="text-xs font-semibold text-mecg-navy">{round.name}</dt>
                                <dd className="mt-1 text-xs leading-5 text-mecg-navy/60">{aggregate.score == null ? "Pending" : `${aggregate.score.toFixed(1)} score`} · {aggregate.count} ratings · {lockedEvaluations} locked{aggregate.spread == null ? "" : ` · spread ${aggregate.spread.toFixed(0)}`}</dd>
                              </div>
                            ))}
                            <div>
                              <dt className="text-xs font-semibold text-mecg-navy">Event observations</dt>
                              <dd className="mt-1 text-xs leading-5 text-mecg-navy/60">{impressions ? `${impressions.count} observation${impressions.count === 1 ? "" : "s"}${impressions.topTags.length ? ` · ${impressions.topTags.join(", ")}` : ""}` : "No observations"}</dd>
                              {impressions?.notes.length ? (
                                <ul className="mt-2 flex flex-col gap-1 text-xs leading-5 text-mecg-navy/60">
                                  {impressions.notes.slice(0, 5).map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>{note}</li>)}
                                </ul>
                              ) : null}
                            </div>
                            <div>
                              <dt className="text-xs font-semibold text-mecg-navy">Member vote</dt>
                              <dd className="mt-1"><MemberVote tally={tally} /></dd>
                            </div>
                          </dl>
                          {readiness.issues.length > 0 && (
                            <ul className="mt-4 flex flex-col gap-1 text-xs text-mecg-orange-ink">
                              {readiness.issues.map((issue) => <li key={issue.key}>{issue.label}</li>)}
                            </ul>
                          )}
                        </div>
                        <div className="flex flex-col gap-3">
                          {decision ? (
                            <>
                              <div>
                                <p className="text-sm font-semibold text-mecg-navy">{decisionOutcomeLabel(decision.outcome)} · {decisionStatusLabel(decision.status)}</p>
                                <p className="mt-1 text-xs leading-5 text-mecg-navy/60">{decision.reason}</p>
                                <p className="mt-1 text-xs text-mecg-navy/55">{decision.decision_approvals.length}/2 approvals</p>
                              </div>
                              {readiness.ready && !["LOCKED", "RELEASED"].includes(decision.status) && canDecide && <ApprovalButton decisionId={decision.id} />}
                              {readiness.ready && decision.status === "LOCKED" && canRelease && <ReleaseButton decisionId={decision.id} />}
                              {canDecide && <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />}
                              <MemberNotes notes={notes} />
                            </>
                          ) : readiness.ready ? (
                            <PendingDecisionPanel cycleId={cycle.id} applicationId={application.id} tally={tally} notes={notes} canDecide={canDecide} />
                          ) : (
                            <>
                              <p className="text-sm text-mecg-navy/55">Decision controls unlock when the blockers above are cleared.</p>
                              <MemberNotes notes={notes} />
                            </>
                          )}
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <p className="border-l-2 border-mecg-navy/[0.14] pl-4 text-sm leading-6 text-mecg-navy/55">Scores and decision controls stay hidden until the cycle-level blockers above are cleared.</p>
      )}
    </main>
  );
}
