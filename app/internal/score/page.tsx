import React from "react";
import { submitDemoScore } from "./actions";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function InternalScorePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const saved = params?.saved === "1";

  const supabase = createDemoAdminClient();

  const { data: applications } = await supabase
    .from("demo_applications")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: scores } = await supabase
    .from("demo_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Scoring</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Interview scoring.
        </h2>
        <p className="mt-4 text-white/54">
          Enter behavioral and technical scores from the interview rubric.
        </p>
      </section>

      {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</p> : null}
      {saved ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">Score saved.</p> : null}

      <form action={submitDemoScore} className="panel grid gap-4 rounded-[2rem] p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Candidate name</span>
            <input name="candidate_name" list="candidate-names" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Candidate email</span>
            <input name="candidate_email" type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Stage</span>
            <select name="stage" className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-4 outline-none focus:border-[var(--orange)]">
              <option>Application Review</option>
              <option>Speed Dating</option>
              <option>Group Case</option>
              <option>Final Interview</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Decision</span>
            <select name="decision" className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-4 outline-none focus:border-[var(--orange)]">
              <option>Strong Yes</option>
              <option>Leaning Yes</option>
              <option>Discuss</option>
              <option>Leaning No</option>
              <option>Strong No</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Behavioral score / 21</span>
            <input name="behavioral_score" type="number" min="0" max="21" defaultValue="0" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Technical score / 25</span>
            <input name="technical_score" type="number" min="0" max="25" defaultValue="0" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Interview notes</span>
          <textarea name="notes" rows={5} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
        </label>

        <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
          Save score
        </button>
      </form>

      <datalist id="candidate-names">
        {(applications ?? []).map((app) => (
          <option key={app.id} value={app.full_name} />
        ))}
      </datalist>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Recent scores</p>
        <div className="mt-5 grid gap-3">
          {(scores ?? []).map((score) => (
            <article key={score.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{score.candidate_name || score.candidate_email}</h3>
                  <p className="text-sm text-white/44">{score.stage}</p>
                </div>
                <p className="text-sm font-bold text-[var(--orange)]">
                  Total {(score.behavioral_score || 0) + (score.technical_score || 0)} / 46 · {score.decision}
                </p>
              </div>
              <p className="mt-3 text-sm text-white/54">{score.notes}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
