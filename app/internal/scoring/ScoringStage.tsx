import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";
import { submitCandidateScore } from "./actions";

type Stage = "speed_dating" | "group_case" | "interview";

type Criterion = {
  id: string;
  name: string;
  min_score: number;
  max_score: number;
  display_order: number | null;
};

type ScoreCandidate = { id: string; full_name: string | null; email: string | null; team_label?: string | null };

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/45">{children}</p>;
}

// Shared rubric-driven scoring UI for a single stage. Committee members see only
// candidates assigned to them; board sees everyone currently in the stage.
export async function ScoringStage({
  stage,
  eyebrow,
  heading,
  blurb,
  params,
}: {
  stage: Stage;
  eyebrow: string;
  heading: string;
  blurb: string;
  params?: { success?: string; error?: string };
}) {
  const member = await requireCommittee();
  const supabase = await createClient();
  const isBoard = member.role === "board";

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: rubric } = cycle
    ? await supabase
        .from("rubric_versions")
        .select("id, label, rubric_criteria(id, name, min_score, max_score, display_order)")
        .eq("cycle_id", cycle.id)
        .eq("stage", stage)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  const criteria: Criterion[] = ((rubric?.rubric_criteria as Criterion[] | undefined) ?? [])
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  let candidates: ScoreCandidate[] = [];
  if (cycle && rubric) {
    if (isBoard) {
      const { data } = await supabase
        .from("candidates")
        .select("id, full_name, email")
        .eq("cycle_id", cycle.id)
        .eq("current_stage", stage)
        .is("deleted_at", null)
        .order("full_name", { ascending: true });
      candidates = data ?? [];
    } else {
      const { data } = await supabase
        .from("evaluator_assignments")
        .select("team_label, candidate:candidates(id, full_name, email)")
        .eq("cycle_id", cycle.id)
        .eq("stage", stage)
        .eq("evaluator_id", member.id);
      candidates = (data ?? [])
        .map((a) => {
          const c = Array.isArray(a.candidate) ? a.candidate[0] : a.candidate;
          return c ? { ...c, team_label: a.team_label } : null;
        })
        .filter(Boolean) as ScoreCandidate[];
    }
  }

  const { data: subs } = await supabase
    .from("score_submissions")
    .select("candidate_id")
    .eq("evaluator_id", member.id)
    .eq("stage", stage);
  const scored = new Set((subs ?? []).map((s) => s.candidate_id));

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">{heading}</h2>
        <p className="mt-5 text-white/58">{blurb}</p>
      </section>

      {params?.success ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">{params.success}</p> : null}
      {params?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{params.error}</p> : null}

      {!cycle ? <Empty>No active recruitment cycle.</Empty> : null}
      {cycle && !rubric ? <Empty>No active rubric is configured for this stage yet.</Empty> : null}

      {cycle && rubric ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {candidates.map((candidate) => (
            <article key={candidate.id} className="panel rounded-[2rem] p-6">
              {candidate.team_label ? <p className="eyebrow">Team {candidate.team_label}</p> : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">{candidate.full_name}</h3>
                  <p className="mt-1 text-sm text-white/45">{candidate.email}</p>
                </div>
                {scored.has(candidate.id) ? (
                  <span className="rounded-full border border-green-300/30 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-100">Scored</span>
                ) : null}
              </div>

              <form action={submitCandidateScore} className="mt-6 grid gap-4">
                <input type="hidden" name="stage" value={stage} />
                <input type="hidden" name="candidate_id" value={candidate.id} />
                <input type="hidden" name="rubric_version_id" value={rubric.id} />

                {criteria.map((criterion) => (
                  <label key={criterion.id} className="grid gap-2">
                    <span className="text-sm font-bold">
                      {criterion.name} / {criterion.max_score}
                    </span>
                    <input
                      name={`criterion_${criterion.id}`}
                      type="number"
                      min={criterion.min_score}
                      max={criterion.max_score}
                      required
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]"
                    />
                  </label>
                ))}

                <button className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">
                  {scored.has(candidate.id) ? "Update score" : "Submit score"}
                </button>
              </form>
            </article>
          ))}

          {candidates.length === 0 ? (
            <Empty>{isBoard ? "No candidates are currently in this stage." : "No candidates are assigned to you yet."}</Empty>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
