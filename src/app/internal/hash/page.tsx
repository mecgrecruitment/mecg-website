import React from "react";
import { submitHashVote } from "./actions";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function HashPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const saved = params?.saved === "1";

  const supabase = createDemoAdminClient();

  const { data: votes } = await supabase
    .from("demo_hash_votes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Hash</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Decision room.
        </h2>
        <p className="mt-4 text-white/54">
          Record final candidate votes and discussion rationale.
        </p>
      </section>

      {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</p> : null}
      {saved ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">Hash vote saved.</p> : null}

      <form action={submitHashVote} className="panel grid gap-4 rounded-[2rem] p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <input name="candidate_name" placeholder="Candidate name" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          <input name="candidate_email" type="email" placeholder="Candidate email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          <select name="vote" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-4 outline-none focus:border-[var(--orange)]">
            <option value="">Select vote</option>
            <option>Accept</option>
            <option>Waitlist</option>
            <option>Reject</option>
            <option>Discuss More</option>
          </select>
        </div>

        <textarea name="rationale" rows={4} placeholder="Rationale / discussion notes" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />

        <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
          Save hash vote
        </button>
      </form>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Vote history</p>
        <div className="mt-5 grid gap-3">
          {(votes ?? []).map((vote) => (
            <article key={vote.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{vote.candidate_name || vote.candidate_email}</h3>
                  <p className="text-sm text-white/44">{vote.candidate_email}</p>
                </div>
                <p className="text-sm font-bold text-[var(--orange)]">{vote.vote}</p>
              </div>
              <p className="mt-3 text-sm text-white/54">{vote.rationale}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
