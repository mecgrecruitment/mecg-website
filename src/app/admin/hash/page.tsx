import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import LogoutButton from "@/components/logout-button";
import BoardNav from "../board-nav";
import DecisionForm, { ApprovalButton, PreviewForm, ReleaseButton } from "../decision-form";

export const metadata: Metadata = { title: "Hash" };

export default async function HashBoard() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  if (!canPanel) redirect("/access-denied");
  const supabase = await createClient();
  const [cycleResult, roundsResult, appsResult, decisionsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("decisions").select("id,application_id,outcome,status,reason,communication_preview,decision_approvals(id)").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, decisionsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const rounds = (roundsResult.data ?? []).flatMap((round) =>
    ["SPEED_DATING", "GROUP_CASE"].includes(round.kind)
      ? [{ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }]
      : [],
  );
  const applications = (appsResult.data ?? [])
    .filter((application) => !["DRAFT", "WITHDRAWN"].includes(application.status))
    .sort((a, b) => a.pnms.name.localeCompare(b.pnms.name));
  const allDecisions = decisionsResult.data ?? [];
  const decisionByApplication = new Map<string, (typeof allDecisions)[number]>();
  for (const decision of allDecisions) {
    if (!decisionByApplication.has(decision.application_id)) decisionByApplication.set(decision.application_id, decision);
  }
  const hashOpen = canPanel && cycle.status === "DECISION_LOCK" && rounds.length >= 2 && rounds.every((round) => ["FROZEN", "FINALIZED"].includes(round.status));
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
          <Link href="/member" className="button-secondary text-sm">Evaluation Hub</Link>
          <LogoutButton />
        </div>
      </header>
      <BoardNav current="/admin/hash" recruitmentOperations={false} hashPanel={canPanel} />
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mecg-navy/55">Aggregates appear only after every evaluated round is frozen. Hash does not add a numeric score.</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${hashOpen ? "bg-mecg-navy text-white" : "text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.15)]"}`}>
            {hashOpen ? "Open" : "Locked"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {roundReadiness.map((round) => (
            <div key={round.id} className="rounded-2xl bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-mecg-navy">{round.name}</h2>
                <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">{round.status}</span>
              </div>
              <p className="mt-2 text-sm text-mecg-navy/55">{round.submitted}/{round.assignmentCount} forms submitted</p>
              <p className="mt-1 text-xs text-mecg-navy/45">{round.covered}/{applications.length} applicants have two submitted evaluations</p>
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
                <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3 text-white">
                  <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-white/50">{label}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <table className="w-full text-left text-sm">
              <thead className="bg-mecg-navy/[0.03]">
                <tr>
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/50">Applicant</th>
                  {rounds.map((round) => (
                    <th key={round.id} className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/50">{round.name}</th>
                  ))}
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/50">Combined</th>
                  <th className="p-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/50">Decision</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map(({ application, rounds: results, finalScore }) => {
                  const decision = decisionByApplication.get(application.id);
                  return (
                    <tr key={application.id} className="border-t border-mecg-navy/[0.08] align-top">
                      <td className="p-3 font-medium">
                        <Link href={`/admin/applications/${application.id}`} className="text-mecg-navy underline decoration-mecg-navy/30 underline-offset-2 hover:decoration-mecg-navy">{application.pnms.name}</Link>
                        <span className="block text-xs font-normal text-mecg-navy/45">{application.status}</span>
                      </td>
                      {results.map(({ round, aggregate }) => (
                        <td key={round.id} className="p-3 text-xs text-mecg-navy/55">
                          {aggregate.score === null ? (aggregate.status === "PENDING" ? "Pending" : "—") : aggregate.score.toFixed(1)}
                          <span className="block text-[11px] text-mecg-navy/40">{aggregate.count} ratings{aggregate.spread != null ? ` · spread ${aggregate.spread.toFixed(0)}` : ""}{aggregate.status === "REVIEW" ? " · review" : ""}</span>
                        </td>
                      ))}
                      <td className="p-3 font-mono text-lg font-bold tabular-nums text-mecg-navy">
                        {finalScore === null ? <span className="text-sm font-normal text-mecg-navy/50">Pending</span> : finalScore.toFixed(1)}
                      </td>
                      <td className="min-w-72 p-3">
                        {decision ? (
                          <details className="group rounded-xl">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                              <span>
                                <span className="text-xs font-semibold text-mecg-navy">{decision.outcome} · {decision.status}</span>
                                <span className="block text-[11px] text-mecg-navy/45">{decision.decision_approvals.length}/2 approvals</span>
                              </span>
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/40 transition-transform group-open:rotate-180">
                                <path d="M5 8l5 5 5-5" />
                              </svg>
                            </summary>
                            <div className="mt-2.5 flex flex-col gap-2.5 px-1">
                              <p className="text-xs text-mecg-navy/55">{decision.reason}</p>
                              {!["LOCKED", "RELEASED"].includes(decision.status) && <ApprovalButton decisionId={decision.id} />}
                              {decision.status === "LOCKED" && <ReleaseButton decisionId={decision.id} />}
                              <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />
                            </div>
                          </details>
                        ) : (
                          <details className="group rounded-xl">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                              No decision yet
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/40 transition-transform group-open:rotate-180">
                                <path d="M5 8l5 5 5-5" />
                              </svg>
                            </summary>
                            <div className="mt-2.5 px-1">
                              <DecisionForm cycleId={cycle.id} applicationId={application.id} />
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
