import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireRole } from "@/lib/internal-portal/session";
import { submitCandidateScore } from "../actions";

export default async function FinalRoundPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  await requireRole(["board"]);
  const params = await searchParams;
  const supabase = createDemoAdminClient();

  const { data: candidates } = await supabase
    .from("demo_applications")
    .select("email,full_name,year,major")
    .order("full_name", { ascending: true });

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Board Only</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Final round scoring.
        </h2>
      </section>

      {params?.success ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">{params.success}</p> : null}
      {params?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{params.error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {(candidates ?? []).map((candidate) => (
          <article key={candidate.email} className="panel rounded-[2rem] p-6">
            <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">
              {candidate.full_name}
            </h3>
            <p className="mt-1 text-sm text-white/45">{candidate.email}</p>

            <form action={submitCandidateScore} className="mt-6 grid gap-4">
              <input type="hidden" name="stage" value="final_round" />
              <input type="hidden" name="candidate_email" value={candidate.email} />
              <input type="hidden" name="candidate_name" value={candidate.full_name} />

              {["Case Thinking", "Motivation", "Experience", "Board Fit"].map((label, index) => (
                <label key={label} className="grid gap-2">
                  <span className="text-sm font-bold">{label} / 5</span>
                  <input name={`score_${index + 1}`} type="number" min="1" max="5" required className="rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]" />
                </label>
              ))}

              <select name="recommendation" className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3 outline-none focus:border-[var(--orange)]">
                <option value="accept">Accept</option>
                <option value="waitlist">Waitlist</option>
                <option value="reject">Reject</option>
                <option value="discuss">Discuss</option>
              </select>

              <textarea name="notes" rows={5} placeholder="Board-only notes" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]" />

              <button className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">
                Submit final score
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
