"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";

type Stage = "speed_dating" | "group_case" | "interview";

const STAGE_ROUTE: Record<string, string> = {
  speed_dating: "speed-dating",
  group_case: "group-case",
  interview: "final-round",
};

// Rubric-driven score submit: one append-only score_submissions header + one
// scores row per rubric criterion. RLS requires evaluator_id = me + committee+.
export async function submitCandidateScore(formData: FormData) {
  const member = await requireCommittee();
  const supabase = await createClient();

  const stage = String(formData.get("stage") || "") as Stage;
  const candidateId = String(formData.get("candidate_id") || "");
  const rubricVersionId = String(formData.get("rubric_version_id") || "");
  const route = STAGE_ROUTE[stage] || "";

  if (!["speed_dating", "group_case", "interview"].includes(stage) || !candidateId || !rubricVersionId) {
    redirect("/internal/scoring?error=Missing candidate or rubric.");
  }
  if (stage === "interview" && member.role !== "board") {
    redirect("/internal?error=Final round scoring is board only.");
  }

  const rows: {
    candidate_id: string;
    rubric_criterion_id: string;
    rubric_version_id: string;
    evaluator_id: string;
    stage: Stage;
    value: number;
  }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("criterion_")) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    rows.push({
      candidate_id: candidateId,
      rubric_criterion_id: key.slice("criterion_".length),
      rubric_version_id: rubricVersionId,
      evaluator_id: member.id,
      stage,
      value,
    });
  }
  if (rows.length === 0) {
    redirect(`/internal/scoring/${route}?error=Enter at least one score.`);
  }

  // Header is append-only (trigger blocks UPDATE/DELETE) → insert-or-ignore.
  const { error: headerError } = await supabase.from("score_submissions").upsert(
    { candidate_id: candidateId, evaluator_id: member.id, stage, rubric_version_id: rubricVersionId },
    { onConflict: "candidate_id,evaluator_id,stage", ignoreDuplicates: true }
  );
  if (headerError) {
    redirect(`/internal/scoring/${route}?error=${encodeURIComponent(headerError.message)}`);
  }

  // Criterion values are editable until the stage locks.
  const { error: scoresError } = await supabase
    .from("scores")
    .upsert(rows, { onConflict: "candidate_id,rubric_criterion_id,evaluator_id" });
  if (scoresError) {
    redirect(`/internal/scoring/${route}?error=${encodeURIComponent(scoresError.message)}`);
  }

  redirect(`/internal/scoring/${route}?success=Score saved.`);
}
