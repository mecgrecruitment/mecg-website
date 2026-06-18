import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession } from "@/lib/internal-portal/session";
import { submitCandidateScore } from "../actions";

export default async function SpeedDatingPage({
  searchParams,
}: {
  searchParams?: Promise<{ team?: string; success?: string; error?: string }>;
}) {
  const session = await requireInternalSession();
  const params = await searchParams;
  const team = params?.team || "";
  const supabase = createDemoAdminClient();

  const query = supabase
    .from("demo_scoring_assignments")
    .select("*")
    .eq("stage", "speed_dating")
    .eq("active", true);

  if (team) query.eq("team_number", team);
  if (session.role !== "board") query.eq("reviewer_email", session.email);

  const { data: assignments } = await query.order("candidate_name", { ascending: true });

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Speed Dating</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Score by table.
        </h2>
        <p className="mt-5 text-white/58">
          Enter your team/table number to see the candidates assigned there.
        </p>
      </section>

      {params?.success ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">{params.success}</p> : null}
      {params?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{params.error}</p> : null}

      <form className="panel flex max-w-md gap-3 rounded-[1.5rem] p-4">
        <input name="team" defaultValue={team} placeholder="Team / table number" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
        <button className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Load</button>
      </form>

      <section className="grid gap-4 lg:grid-cols-2">
        {(assignments ?? []).map((assignment) => (
          <article key={assignment.id} className="panel rounded-[2rem] p-6">
            <p className="eyebrow">Team {assignment.team_number || "—"}</p>
            <h3 className="font-display mt-3 text-3xl font-bold uppercase tracking-[-0.05em]">
              {assignment.candidate_name}
            </h3>
            <p className="mt-1 text-sm text-white/45">{assignment.candidate_email}</p>

            <form action={submitCandidateScore} className="mt-6 grid gap-4">
              <input type="hidden" name="stage" value="speed_dating" />
              <input type="hidden" name="candidate_email" value={assignment.candidate_email} />
              <input type="hidden" name="candidate_name" value={assignment.candidate_name} />
              <input type="hidden" name="team_number" value={assignment.team_numb || ""} />

              {["Communication", "Interest", "Presence", "Member Fit"].map((label, index) => (
                <label key={label} className="grid gap-2">
                  <span className="text-sm font-bold">{label} / 5</span>
                  <input name={`score_${index + 1}`} type="number" min="1" max="5" required className="rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]" />
                </label>
              ))}

              <label className="grid gap-2">
                <span className="text-sm font-bold">Recommendation</span>
                <select name="recommendation" className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3 outline-none focus:border-[var(--orange)]">
                  <option value="strong_yes">Strong yes</option>
                  <option value="yes">Yes</option>
                  <option value="maybe">Maybe</option>
                  <option value="no">No</option>
                </select>
              </label>

              <textarea name="notes" rows={4} placeholder="Notes" className="rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]" />

              <button className="rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">
                Submit score
              </button>
            </form>
          </article>
        ))}
      </section>

      {(assignments ?? []).length === 0 ? <p className="text-white/45">No assignments found.</p> : null}
    </div>
  );
}
