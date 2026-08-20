"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { scoreInputSchema, submitCandidateScoreSchema } from "@/lib/internal/schema";

const STAGE_ROUTE: Record<string, string> = {
  speed_dating: "speed-dating",
  group_case: "group-case",
  interview: "final-round",
};

// Rubric-driven score submit: one append-only score_submissions header + one
// scores row per rubric criterion. RLS requires evaluator_id = me + committee+.
export async function submitCandidateScore(formData: FormData) {
  const member = await requireCommittee();
  const parsed = submitCandidateScoreSchema.safeParse({
    stage: formData.get("stage"),
    candidate_id: formData.get("candidate_id"),
    rubric_version_id: formData.get("rubric_version_id"),
  });
  if (!parsed.success) {
    redirect(`/internal/scoring?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();

  const { stage, candidate_id: candidateId, rubric_version_id: rubricVersionId } = parsed.data;
  const route = STAGE_ROUTE[stage];

  if (stage === "interview" && member.role !== "board") {
    redirect(
      `/internal/scoring?error=${encodeURIComponent("Final round scoring is board only.")}`
    );
  }

  // Range/integer enforcement lives here per the criteria table's own comment
  // ("range vs criterion enforced at API layer") — the client <input min/max>
  // is a UX hint only and is trivially bypassed.
  const { data: criteria, error: criteriaError } = await supabase
    .from("rubric_criteria")
    .select("id, min_score, max_score")
    .eq("rubric_version_id", rubricVersionId);
  if (criteriaError || !criteria || criteria.length === 0) {
    redirect(`/internal/scoring/${route}?error=Could not load the rubric for this stage.`);
  }
  const criteriaById = new Map(criteria!.map((c) => [c.id, c]));

  const scores: { criterion_id: string; value: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("criterion_")) continue;
    const score = scoreInputSchema.safeParse({
      criterion_id: key.slice("criterion_".length),
      value: raw,
    });
    if (!score.success) {
      redirect(`/internal/scoring/${route}?error=${encodeURIComponent(firstError(score))}`);
    }

    const criterion = criteriaById.get(score.data.criterion_id);
    if (!criterion) {
      redirect(`/internal/scoring/${route}?error=Unknown rubric criterion.`);
    }
    if (score.data.value < criterion.min_score || score.data.value > criterion.max_score) {
      redirect(
        `/internal/scoring/${route}?error=${encodeURIComponent(
          `Scores must be whole numbers between ${criterion.min_score} and ${criterion.max_score}.`
        )}`
      );
    }
    scores.push(score.data);
  }
  if (scores.length === 0) {
    redirect(`/internal/scoring/${route}?error=Enter at least one score.`);
  }

  // The RPC validates the active cycle, candidate stage, rubric, assignment,
  // complete scorecard, and ranges before committing the scorecard atomically.
  const { error } = await supabase.rpc("submit_candidate_score", {
    p_candidate_id: candidateId,
    p_stage: stage,
    p_rubric_version_id: rubricVersionId,
    p_scores: scores,
  });
  if (error) {
    redirect(`/internal/scoring/${route}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/internal/scoring/${route}?success=Scorecard submitted.`);
}
