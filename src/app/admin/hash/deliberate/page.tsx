import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { applicantCode } from "@/lib/applicant-code";
import DeliberationDeck, { type DeckEntry } from "./deliberation-deck";

export const metadata: Metadata = { title: "Discussion" };

export default async function DeliberationPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  if (!canPanel) redirect("/access-denied");
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  // Blind Hash review: never send a PANEL-only viewer's real name into the deck's
  // client-side props, since deliberation-deck.tsx is a "use client" component.
  const panelOnly = canPanel && !canManageCycle && !canOperate;
  const supabase = await createClient();
  const [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("decisions").select("id,application_id,outcome,status").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
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
  const hashOpen = canPanel && cycle.status === "DECISION_LOCK" && rounds.length >= 2 && rounds.every((round) => ["FROZEN", "FINALIZED"].includes(round.status));
  if (!hashOpen) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Discussion</h1>
        <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">Discussion mode opens once every scored round is closed to edits and the cycle moves into voting and decisions.</p>
        <Link href="/admin/hash" className="button-secondary self-start text-sm">Back to Hash</Link>
      </main>
    );
  }
  const applications = (appsResult.data ?? []).filter((application) => !["DRAFT", "WITHDRAWN"].includes(application.status));
  const decisionByApplication = new Map<string, NonNullable<typeof decisionsResult.data>[number]>();
  for (const decision of decisionsResult.data ?? []) {
    if (!decisionByApplication.has(decision.application_id)) decisionByApplication.set(decision.application_id, decision);
  }
  const impressionGroups = new Map<string, { total: number; count: number; tagCounts: Map<string, number> }>();
  for (const impression of impressionsResult.data ?? []) {
    const group = impressionGroups.get(impression.application_id) ?? { total: 0, count: 0, tagCounts: new Map() };
    group.total += impression.score;
    group.count += 1;
    for (const tag of impression.tags) group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
    impressionGroups.set(impression.application_id, group);
  }
  const entries: DeckEntry[] = applications.map((application) => {
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
    const group = impressionGroups.get(application.id);
    const decision = decisionByApplication.get(application.id);
    return {
      id: application.id,
      name: panelOnly ? applicantCode(application.id) : application.pnms.name,
      status: application.status,
      rounds: byRound.map(({ round, aggregate }) => ({ name: round.name, score: aggregate.score, count: aggregate.count, spread: aggregate.spread, status: aggregate.status })),
      finalScore: combineRoundScores(byRound.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight }))),
      impressions: group
        ? {
            count: group.count,
            avg: group.total / group.count,
            topTags: [...group.tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag),
          }
        : null,
      decision: decision ? { outcome: decision.outcome, status: decision.status } : null,
    };
  }).sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));

  return <DeliberationDeck entries={entries} />;
}
