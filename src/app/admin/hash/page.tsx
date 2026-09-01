import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { applicantCode } from "@/lib/applicant-code";
import LogoutButton from "@/components/logout-button";
import StatTile from "@/components/stat-tile";
import StatusPill from "@/components/status-pill";
import BoardNav from "../board-nav";
import DecisionForm, { ApprovalButton, PreviewForm, ReleaseButton } from "../decision-form";

export const metadata: Metadata = { title: "Hash" };

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
  const [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("decisions").select("id,application_id,outcome,status,reason,communication_preview,decision_approvals(id)").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
    supabase.from("event_impressions").select("application_id, score, tags, events!inner(cycle_id)").eq("events.cycle_id", cycleId),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const rounds = (roundsResult.data ?? []).flatMap((round) =>
    ["SPEED_DATING", "GROUP_CASE"].includes(round.kind)
      ? [{ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }]
      : [],
  );
  const applications = (appsResult.data ?? [])
    .filter((application) => !["DRAFT", "WITHDRAWN"].includes(application.status))
    .map((application) => ({ ...application, displayName: panelOnly ? applicantCode(application.id) : application.pnms.name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const allDecisions = decisionsResult.data ?? [];
  const decisionByApplication = new Map<string, (typeof allDecisions)[number]>();
  for (const decision of allDecisions) {
    if (!decisionByApplication.has(decision.application_id)) decisionByApplication.set(decision.application_id, decision);
  }
  const hashOpen = canPanel && cycle.status === "DECISION_LOCK" && rounds.length >= 2 && rounds.every((round) => ["FROZEN", "FINALIZED"].includes(round.status));
  const impressionGroups = new Map<string, { total: number; count: number; tagCounts: Map<string, number> }>();
  for (const impression of impressionsResult.data ?? []) {
    const group = impressionGroups.get(impression.application_id) ?? { total: 0, count: 0, tagCounts: new Map() };
    group.total += impression.score;
    group.count += 1;
    for (const tag of impression.tags) group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
    impressionGroups.set(impression.application_id, group);
  }
  const impressionsByApplication = new Map<string, { count: number; avg: number; topTags: string[] }>();
  for (const [applicationId, group] of impressionGroups) {
    impressionsByApplication.set(applicationId, {
      count: group.count,
      avg: group.total / group.count,
      topTags: [...group.tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag),
    });
  }
  const rankings = applications.map((application) => {
    const byRound = rounds.map((round) => {
      const criteria = round.rubric?.rubric_criteria ?? [];
      const scored: ReturnType<typeof scoreEvaluation>[] = [];
      for (const assignment of application.evaluation_assignments) {
        if (assignment.round_id !== round.id) continue;
        for (const evaluation of assignment.evaluations) {
          if (!["SUBMITTED", "LOCKED"].includes(evaluation.status)) continue;
          scored.push(scoreEvaluation(criteria, evaluation.criterion_ratings.map((rating) => ({ criterionId: rating.criterion_id, score: rating.score }))));
        }
      }
      return { round, aggregate: aggregateRound(scored) };
    });
    return { application, rounds: byRound, finalScore: combineRoundScores(byRound.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight }))) };
  }).sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
  const roundReadiness = rounds.map((round) => {
    const assignments = applications.flatMap((application) => application.evaluation_assignments.filter((assignment) => assignment.round_id === round.id));
    const submitted = assignments.filter((assignment) => assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status))).length;
    const covered = applications.filter((application) => application.evaluation_assignments.filter((assignment) => assignment.round_id === round.id && assignment.evaluations.some((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status))).length >= 2).length;
    return { ...round, assignmentCount: assignments.length, submitted, covered };
  });
  const decisions = [...decisionByApplication.values()];
  const decisionStats = [
    [String(applications.length), "applicants"],
    [String(applications.filter((application) => decisionByApplication.has(application.id)).length), "decisions drafted"],
    [String(decisions.filter((decision) => decision.status === "LOCKED").length), "locked"],
    [String(decisions.filter((decision) => decision.status === "RELEASED").length), "released"],
  ] as const;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">{cycle.name} · {cycle.status}</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">Hash</h1>
        </div>
        <div className="flex items-center gap-5">
          {hashOpen && <Link href="/admin/hash/deliberate" className="button-secondary text-sm">Deliberation mode</Link>}
          <Link href="/member" className="button-secondary text-sm">Evaluation Hub</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current="/admin/hash" recruitmentOperations={false} hashPanel={canPanel} />
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mecg-navy/55">Aggregates appear only after every evaluated round is frozen. Hash does not add a numeric score.</p>
          <StatusPill tone={hashOpen ? "navy" : "neutral"}>{hashOpen ? "Open" : "Locked"}</StatusPill>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {roundReadiness.map((round) => (
            <div key={round.id} className="rounded-2xl bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-mecg-navy">{round.name}</h2>
                <StatusPill tone="neutral">{round.status}</StatusPill>
              </div>
              <p className="mt-2 text-sm text-mecg-navy/55">{round.submitted}/{round.assignmentCount} forms submitted</p>
              <p className="mt-1 text-xs text-mecg-navy/60">{round.covered}/{applications.length} applicants have two submitted evaluations</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mecg-navy/10">
                <div className="h-full rounded-full bg-mecg-orange" style={{ width: `${applications.length ? Math.min(100, (round.covered / applications.length) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        {hashOpen ? (
          <div className="mt-5 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {decisionStats.map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3">
                  <StatTile value={value} label={label} tone="dark" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {rankings.map(({ application, rounds: results, finalScore }) => {
                const decision = decisionByApplication.get(application.id);
                const impressions = impressionsByApplication.get(application.id);
                return (
                  <article key={application.id} className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/admin/applications/${application.id}`} className="inline-flex min-h-10 items-center font-semibold text-mecg-navy underline decoration-mecg-navy/30 underline-offset-2">{application.displayName}</Link>
                        <p className="text-xs text-mecg-navy/60">{application.status}</p>
                      </div>
                      <p className="font-mono text-xl font-bold tabular-nums">{finalScore === null ? "Pending" : finalScore.toFixed(1)}</p>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      {results.map(({ round, aggregate }) => (
                        <div key={round.id}>
                          <dt className="font-mono uppercase tracking-[0.08em] text-mecg-navy/60">{round.name}</dt>
                          <dd className="mt-1 text-mecg-navy/70">{aggregate.score === null ? "Pending" : aggregate.score.toFixed(1)} · {aggregate.count} ratings</dd>
                        </div>
                      ))}
                      <div>
                        <dt className="font-mono uppercase tracking-[0.08em] text-mecg-navy/60">Impressions</dt>
                        <dd className="mt-1 text-mecg-navy/70">{impressions ? `${impressions.avg.toFixed(1)} · ${impressions.count}` : "—"}</dd>
                      </div>
                    </dl>
                    <details className="group mt-4">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                        <span>{decision ? `${decision.outcome} · ${decision.status}` : "Create decision"}</span>
                        <span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        {decision ? (
                          <>
                            <p className="text-sm text-mecg-navy/60">{decision.reason}</p>
                            {!["LOCKED", "RELEASED"].includes(decision.status) && canDecide && <ApprovalButton decisionId={decision.id} />}
                            {decision.status === "LOCKED" && canRelease && <ReleaseButton decisionId={decision.id} />}
                            {canDecide && <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />}
                          </>
                        ) : canDecide ? <DecisionForm cycleId={cycle.id} applicationId={application.id} /> : <p className="text-sm text-mecg-navy/55">Only decision-panel members can record outcomes.</p>}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
            <div className="scroll-cue hidden overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] md:block" tabIndex={0} role="region" aria-label="Hash decision table">
              <table className="w-full text-left text-sm">
              <thead className="bg-mecg-navy/[0.03]">
                <tr>
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/60">Applicant</th>
                  {rounds.map((round) => (
                    <th key={round.id} className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/60">{round.name}</th>
                  ))}
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/60">Impressions</th>
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/60">Combined</th>
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/60">Decision</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map(({ application, rounds: results, finalScore }) => {
                  const decision = decisionByApplication.get(application.id);
                  const impressions = impressionsByApplication.get(application.id);
                  return (
                    <tr key={application.id} className="border-t border-mecg-navy/[0.08] align-top">
                      <td className="p-3 font-medium">
                        <Link href={`/admin/applications/${application.id}`} className="text-mecg-navy underline decoration-mecg-navy/30 underline-offset-2 hover:decoration-mecg-navy">{application.displayName}</Link>
                        <span className="block text-xs font-normal text-mecg-navy/60">{application.status}</span>
                      </td>
                      {results.map(({ round, aggregate }) => (
                        <td key={round.id} className="p-3 text-xs text-mecg-navy/55">
                          {aggregate.score === null ? (aggregate.status === "PENDING" ? "Pending" : "—") : aggregate.score.toFixed(1)}
                          <span className="block text-[11px] text-mecg-navy/60">{aggregate.count} ratings{aggregate.spread != null ? ` · spread ${aggregate.spread.toFixed(0)}` : ""}{aggregate.status === "REVIEW" ? " · review" : ""}</span>
                        </td>
                      ))}
                      <td className="p-3 text-xs text-mecg-navy/55">
                        {impressions ? (
                          <>
                            <span className="font-mono text-base font-semibold tabular-nums text-mecg-navy">{impressions.avg.toFixed(1)}</span>
                            <span className="block text-[11px] text-mecg-navy/60">{impressions.count} impressions{impressions.topTags.length > 0 ? ` · ${impressions.topTags.join(", ")}` : ""}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 font-mono text-lg font-bold tabular-nums text-mecg-navy">
                        {finalScore === null ? <span className="text-sm font-normal text-mecg-navy/60">Pending</span> : finalScore.toFixed(1)}
                      </td>
                      <td className="min-w-72 p-3">
                        {decision ? (
                          <details className="group rounded-xl">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                              <span>
                                <span className="text-xs font-semibold text-mecg-navy">{decision.outcome} · {decision.status}</span>
                                <span className="block text-[11px] text-mecg-navy/60">{decision.decision_approvals.length}/2 approvals</span>
                              </span>
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/60 transition-transform group-open:rotate-180">
                                <path d="M5 8l5 5 5-5" />
                              </svg>
                            </summary>
                            <div className="mt-2.5 flex flex-col gap-2.5 px-1">
                              <p className="text-xs text-mecg-navy/55">{decision.reason}</p>
                              {!["LOCKED", "RELEASED"].includes(decision.status) && canDecide && <ApprovalButton decisionId={decision.id} />}
                              {decision.status === "LOCKED" && canRelease && <ReleaseButton decisionId={decision.id} />}
                              {canDecide && <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />}
                            </div>
                          </details>
                        ) : (
                          <details className="group rounded-xl">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                              No decision yet
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/60 transition-transform group-open:rotate-180">
                                <path d="M5 8l5 5 5-5" />
                              </svg>
                            </summary>
                            <div className="mt-2.5 px-1">
                              {canDecide ? <DecisionForm cycleId={cycle.id} applicationId={application.id} /> : <p className="text-xs text-mecg-navy/55">Only decision-panel members can record outcomes.</p>}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">Freeze Speed Dating and Group Case, then enter decision lock to reveal scores and open decisions.</p>
        )}
      </section>
    </main>
  );
}
