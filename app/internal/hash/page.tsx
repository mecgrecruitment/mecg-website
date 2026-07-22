import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";
import { recordDecision, startHashSession, submitHashVote } from "./actions";
import { SubmitButton } from "../../apply/SubmitButton";

function pretty(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const VOTE_OPTIONS = [
  { value: "advance", label: "Advance" },
  { value: "cut", label: "Cut" },
  { value: "discuss", label: "Discuss" },
];

const DECISION_OPTIONS = [
  { value: "accepted", label: "Accept" },
  { value: "waitlisted", label: "Waitlist" },
  { value: "rejected", label: "Reject" },
];

export default async function HashPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const member = await requireCommittee();
  const isBoard = member.role === "board";
  const params = await searchParams;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("hash_sessions")
    .select("id, name, stage, started_at")
    .eq("is_active", true)
    .maybeSingle();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: candidates } = session && cycle
    ? await supabase
        .from("candidates")
        .select("id, full_name, email, year, major, current_stage, status")
        .eq("cycle_id", cycle.id)
        .in("current_stage", ["interview", "hash"])
        .eq("status", "active")
        .is("deleted_at", null)
        .order("full_name", { ascending: true })
    : { data: [] };

  const { data: votes } = session
    ? await supabase
        .from("votes")
        .select("candidate_id, voter_id, value, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: decisions } = session
    ? await supabase
        .from("decisions")
        .select("candidate_id, value, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // latest vote per (candidate, voter) → per-candidate tally
  function tallyFor(candidateId: string) {
    const seen = new Set<string>();
    const counts = { advance: 0, cut: 0, discuss: 0 };
    for (const v of votes ?? []) {
      if (v.candidate_id !== candidateId) continue;
      if (seen.has(v.voter_id)) continue;
      seen.add(v.voter_id);
      if (v.value === "advance") counts.advance++;
      else if (v.value === "cut") counts.cut++;
      else if (v.value === "discuss") counts.discuss++;
    }
    return counts;
  }
  function decisionFor(candidateId: string) {
    return (decisions ?? []).find((d) => d.candidate_id === candidateId)?.value ?? null;
  }

  return (
    <div className="grid gap-8">
      {params?.success ? <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">{params.success}</p> : null}
      {params?.error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{params.error}</p> : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">{isBoard ? "Board Hash Room" : "Member Hash Voting"}</p>
        <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">Hash decisions.</h2>
            <p className="mt-5 max-w-2xl text-white/58">
              Committee votes advance / cut / discuss. Board records the final decision, which sets each candidate&apos;s status.
            </p>
          </div>

          {isBoard ? (
            <div className="flex flex-wrap gap-3">
              <Link href="/internal/emails" className="rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
                Email Center
              </Link>
              <a href="/internal/hash/export" className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--orange-soft)]">
                Export Spreadsheet
              </a>
            </div>
          ) : null}
        </div>
      </section>

      {!session ? (
        <section className="panel rounded-[2rem] p-6">
          <p className="text-white/55">No active hash session.</p>
          {isBoard ? (
            <form action={startHashSession} className="mt-4">
              <SubmitButton pendingText="Starting...">Start hash session</SubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-sm text-white/40">Voting opens when the board starts the session.</p>
          )}
        </section>
      ) : (
        <>
          <section className="panel rounded-[2rem] p-5">
            <p className="eyebrow">{session.name}</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              {(candidates ?? []).length} candidate{(candidates ?? []).length === 1 ? "" : "s"} awaiting a decision
            </h3>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {(candidates ?? []).map((candidate) => {
              const counts = tallyFor(candidate.id);
              const decided = decisionFor(candidate.id);
              return (
                <article key={candidate.id} className="panel rounded-[2rem] p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">{candidate.full_name}</h3>
                      <p className="mt-1 text-sm text-white/45">{candidate.email}</p>
                      <p className="mt-1 text-sm text-white/45">{candidate.year || "—"} · {candidate.major || "—"}</p>
                    </div>
                    <span className="rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/10 px-3 py-1 text-xs font-bold text-[var(--orange-soft)]">
                      {pretty(candidate.current_stage)}
                    </span>
                  </div>

                  {isBoard ? (
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-green-300/20 bg-green-400/10 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-green-100/70">Advance</p>
                        <p className="mt-2 text-2xl font-black">{counts.advance}</p>
                      </div>
                      <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-red-100/70">Cut</p>
                        <p className="mt-2 text-2xl font-black">{counts.cut}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">Discuss</p>
                        <p className="mt-2 text-2xl font-black">{counts.discuss}</p>
                      </div>
                    </div>
                  ) : null}

                  {decided ? (
                    <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                      Recorded decision: <span className="font-bold text-[var(--orange-soft)]">{pretty(decided)}</span>
                    </p>
                  ) : null}

                  <form action={submitHashVote} className="mt-6 rounded-[1.5rem] border border-[var(--orange)]/25 bg-[var(--orange)]/10 p-5">
                    <input type="hidden" name="session_id" value={session.id} />
                    <input type="hidden" name="candidate_id" value={candidate.id} />
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--orange-soft)]">Your vote</p>
                    <label className="mt-4 grid gap-2">
                      <select name="vote" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                        {VOTE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-4">
                      <SubmitButton pendingText="Submitting...">Submit vote</SubmitButton>
                    </div>
                  </form>

                  {isBoard ? (
                    <form action={recordDecision} className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                      <input type="hidden" name="session_id" value={session.id} />
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Official decision</p>
                      <label className="mt-4 grid gap-2">
                        <select name="decision" required className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
                          {DECISION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>
                      <textarea name="rationale" rows={2} placeholder="Optional rationale" className="focus-ring mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]" />
                      <span className="mt-2 block text-xs text-white/40">Sets the candidate&apos;s status and moves them to decided.</span>
                      <div className="mt-4">
                        <SubmitButton pendingText="Recording...">Record decision</SubmitButton>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}

            {(candidates ?? []).length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/45">
                No candidates are currently awaiting a hash decision.
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
