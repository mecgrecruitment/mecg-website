import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { applicantCode } from "@/lib/applicant-code";
import { canonicalMajor } from "@/lib/major";
import { screeningRpc } from "@/lib/screening-rpc";
import { currentHashStage, HASH_STAGE_RULES } from "@/lib/hash-tally";
import { GROUP_CASE_SCORE_BANDS } from "@/lib/rubrics";
import type { GroupCaseResults } from "../../group-case-results";
import type { SpeedDatingResults } from "../../speed-dating-results";
import DeliberationDeck, { type DeckEntry } from "./deliberation-deck";

export const metadata: Metadata = { title: "Discussion" };

export default async function DeliberationPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  if (!canPanel && !canManageCycle) redirect("/access-denied");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  // Blind Hash review: never send a PANEL-only viewer's real name into the deck's
  // client-side props, since deliberation-deck.tsx is a "use client" component.
  const panelOnly = canPanel && !canManageCycle && !canOperate;
  const supabase = await createClient();
  const [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status,hash_stage,hash_quorum,hash_presenting_application_id").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics!rubrics_round_id_fkey(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name,major,class_year),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("decisions").select("id,application_id,outcome,status").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
    supabase.from("event_impressions").select("application_id,tags,note,events!inner(cycle_id)").eq("events.cycle_id", cycleId),
  ]);
  for (const result of [cycleResult, roundsResult, appsResult, decisionsResult, impressionsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const stage = currentHashStage(cycle);
  if (stage === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Discussion</h1>
        <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-mecg-navy/55">Discussion mode opens when the board opens a stage vote or moves the cycle into voting and decisions.</p>
        <Link href="/admin/hash" className="button-secondary self-start text-sm">Back to Hash</Link>
      </main>
    );
  }
  const rounds = (roundsResult.data ?? []).flatMap((round) =>
    ["SPEED_DATING", "GROUP_CASE"].includes(round.kind)
      ? [{ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }]
      : [],
  );
  const speedDatingRound = rounds.find((round) => round.kind === "SPEED_DATING");
  const groupCaseRound = rounds.find((round) => round.kind === "GROUP_CASE");
  const [speedDatingResult, groupCaseResult] = await Promise.all([
    speedDatingRound ? screeningRpc<SpeedDatingResults>(supabase, "speed_dating_results", { target_round_id: speedDatingRound.id }) : null,
    groupCaseRound ? screeningRpc<GroupCaseResults>(supabase, "group_case_results", { target_round_id: groupCaseRound.id }) : null,
  ]);
  if (speedDatingResult?.error) console.error("speed_dating_results failed", speedDatingResult.error);
  if (groupCaseResult?.error) console.error("group_case_results failed", groupCaseResult.error);
  const speedDatingByApplication = new Map((speedDatingResult?.data?.applicants ?? []).map((applicant) => [applicant.applicationId, applicant]));
  const groupCaseByApplication = new Map((groupCaseResult?.data?.applicants ?? []).map((applicant) => [applicant.applicationId, applicant]));
  const groupCaseCriteria = [...(groupCaseResult?.data?.criteria ?? [])].sort((a, b) => a.position - b.position);
  const cleanNotes = (notes: string[]) => panelOnly ? [] : notes.map((note) => note.trim()).filter(Boolean);

  const applications = (appsResult.data ?? []).filter((application) =>
    stage === "FINAL" ? !["DRAFT", "WITHDRAWN"].includes(application.status) : HASH_STAGE_RULES[stage].ballot.includes(application.status));
  const decisionByApplication = new Map<string, NonNullable<typeof decisionsResult.data>[number]>();
  for (const decision of decisionsResult.data ?? []) {
    if (!decisionByApplication.has(decision.application_id)) decisionByApplication.set(decision.application_id, decision);
  }
  const impressionGroups = new Map<string, { count: number; tagCounts: Map<string, number>; notes: string[] }>();
  for (const impression of impressionsResult.data ?? []) {
    const group = impressionGroups.get(impression.application_id) ?? { count: 0, tagCounts: new Map<string, number>(), notes: [] as string[] };
    group.count += 1;
    for (const tag of impression.tags) group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
    if (!panelOnly && impression.note.trim()) group.notes.push(impression.note.trim());
    impressionGroups.set(impression.application_id, group);
  }
  const entries: DeckEntry[] = applications.map((application) => {
    // The weighted final score only means something for the final vote; a stage
    // hash shows the raw round results instead.
    const byRound = stage === "FINAL" ? rounds.map((round) => {
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
    }) : [];
    const group = impressionGroups.get(application.id);
    const decision = decisionByApplication.get(application.id);
    const groupCase = groupCaseByApplication.get(application.id);
    const speedDating = speedDatingByApplication.get(application.id);
    const rounded = groupCase?.mean == null ? null : Math.round(groupCase.mean);
    return {
      id: application.id,
      name: panelOnly ? applicantCode(application.id) : application.pnms.name,
      // Major plus year identifies someone in a small cohort, so a blind viewer gets neither.
      major: panelOnly ? null : canonicalMajor(application.pnms.major ?? "") || null,
      classYear: panelOnly ? null : application.pnms.class_year,
      status: application.status,
      groupName: groupCase?.groupName ?? null,
      groupCase: groupCase
        ? {
            mean: groupCase.mean,
            band: rounded === null ? null : GROUP_CASE_SCORE_BANDS.find((band) => rounded >= band.min && rounded <= band.max)?.label ?? null,
            count: groupCase.count,
            criteria: groupCaseCriteria.map((criterion) => ({ name: criterion.name, mean: groupCase.criterionMeans[criterion.id] ?? null })),
            notes: cleanNotes(groupCase.evaluations.map((evaluation) => evaluation.note)),
          }
        : null,
      speedDating: speedDating
        ? { adjusted: speedDating.adjusted, mean: speedDating.mean, count: speedDating.count, notes: cleanNotes(speedDating.scores.map((score) => score.note)) }
        : null,
      rounds: byRound.map(({ round, aggregate }) => ({ name: round.name, score: aggregate.score, count: aggregate.count, spread: aggregate.spread, status: aggregate.status })),
      finalScore: stage === "FINAL" ? combineRoundScores(byRound.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight }))) : null,
      impressions: group
        ? {
            count: group.count,
            topTags: [...group.tagCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag),
            notes: group.notes,
          }
        : null,
      decision: decision ? { outcome: decision.outcome, status: decision.status } : null,
    };
  }).sort((a, b) => (b.finalScore ?? b.groupCase?.mean ?? -1) - (a.finalScore ?? a.groupCase?.mean ?? -1) || a.name.localeCompare(b.name));

  return <DeliberationDeck entries={entries} cycleId={cycleId} stage={stage} quorum={cycle.hash_quorum} canOperate={canManageCycle} initialPresentingId={cycle.hash_presenting_application_id} />;
}
