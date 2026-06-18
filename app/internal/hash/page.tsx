import React from "react";
import Link from "next/link";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession } from "@/lib/internal-portal/session";
import { submitHashVote } from "../scoring/actions";

const rounds = [
  {
    value: "round_1",
    label: "Round 1",
    memberStatuses: ["submitted", "application_review"],
    boardStatuses: ["submitted", "application_review"],
  },
  {
    value: "round_2",
    label: "Round 2",
    memberStatuses: ["progress_to_round_2"],
    boardStatuses: ["progress_to_round_2"],
  },
  {
    value: "final_approval",
    label: "Final Approval",
    memberStatuses: [],
    boardStatuses: ["progress_to_final_approval"],
  },
];

const memberVotes = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "discuss", label: "Discuss" },
];

const boardDecisionsByRound: Record<string, { value: string; label: string }[]> = {
  round_1: [
    { value: "", label: "No official decision yet" },
    { value: "progress_to_round_2", label: "Progress to Round 2" },
    { value: "rejected", label: "Reject" },
  ],
  round_2: [
    { value: "", label: "No official decision yet" },
    { value: "progress_to_final_approval", label: "Progress to Final Approval" },
    { value: "rejected", label: "Reject" },
  ],
  final_approval: [
    { value: "", label: "No official decision yet" },
    { value: "accepted", label: "Accept" },
    { value: "waitlisted", label: "Waitlist" },
    { value: "rejected", label: "Reject" },
  ],
};

function pretty(value: string | null | undefined) {
  if (!value) return "Submitted";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function voteCounts(votes: any[], round: string) {
  const roundVotes = votes.filter((vote) => vote.candidate_stage === round);

  return {
    yes: roundVotes.filter((vote) => vote.vote === "yes").length,
    no: roundVotes.filter((vote) => vote.vote === "no").length,
    discuss: roundVotes.filter((vote) => vote.vote === "discuss").length,
  };
}

export default async function HashPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string; round?: string }>;
}) {
  const session = await requireInternalSession();
  const isBoard = session.role === "board";

  const params = await searchParams;
  const activeRoundValue =
    params?.round && rounds.some((round) => round.value === params.round)
      ? params.round
      : "round_1";

  const activeRound =
    rounds.find((round) => round.value === activeRoundValue) || rounds[0];

  const allowedStatuses = isBoard
    ? activeRound.boardStatuses
    : activeRound.memberStatuses;

  const supabase = createDemoAdminClient();

  const { data: candidates } = await supabase
    .from("demo_applications")
    .select("email,full_name,year,major,recruitment_status,status")
    .order("full_name", { ascending: true });

  const { data: scores } = await supabase
    .from("demo_candidate_scores")
    .select("*")
    .order("submitted_at", { ascending: false });

  const { data: hashVotes } = await supabase
    .from("demo_hash_votes")
    .select("*")
    .order("created_at", { ascending: false });

  const candidateList = (candidates ?? []).filter((candidate) => {
    const currentStatus =
      candidate.recruitment_status || candidate.status || "submitted";
    return allowedStatuses.includes(currentStatus);
  });

  return (
    <div className="grid gap-8">
      {params?.success ? (
        <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm text-[var(--orange-soft)]">
          {params.success}
        </p>
      ) : null}

      {params?.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {params.error}
        </p>
      ) : null}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">{isBoard ? "Board Hash Room" : "Member Hash Voting"}</p>

        <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
              Hash decisions.
            </h2>
            <p className="mt-5 max-w-2xl text-white/58">
              Candidates move between rounds when board records an official decision.
            </p>
          </div>

          {isBoard ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/internal/emails"
                className="rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white"
              >
                Email Center
              </Link>

              <Link
                href="/internal/hash/export"
                className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--orange-soft)]"
              >
                Export Google Sheet
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {rounds
          .filter((round) => isBoard || round.value !== "final_approval")
          .map((round) => (
            <Link
              key={round.value}
              href={`/internal/hash?round=${round.value}`}
              className={`rounded-full border px-5 py-3 text-xs font-black uppercase tracking-[0.14em] transition ${
                activeRoundValue === round.value
                  ? "border-[var(--orange)] bg-[var(--orange)] text-white"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:border-[var(--orange)] hover:text-white"
              }`}
            >
              {round.label}
            </Link>
          ))}
      </section>

      <section className="panel rounded-[2rem] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">{activeRound.label}</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              {candidateList.length} candidate{candidateList.length === 1 ? "" : "s"} currently in this round
            </h3>
          </div>

          <p className="max-w-xl text-sm leading-6 text-white/45">
            Once board chooses an official decision, the candidate is moved out of this list automatically.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {candidateList.map((candidate) => {
          const candidateScores = (scores ?? []).filter(
            (score) => score.candidate_email === candidate.email
          );

          const candidateVotes = (hashVotes ?? []).filter(
            (vote) => vote.candidate_email === candidate.email
          );

          const counts = voteCounts(candidateVotes, activeRound.value);
          const currentStatus =
            candidate.recruitment_status || candidate.status || "submitted";

          return (
            <article key={candidate.email} className="panel rounded-[2rem] p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">
                    {candidate.full_name}
                  </h3>
                  <p className="mt-1 text-sm text-white/45">{candidate.email}</p>
                  <p className="mt-1 text-sm text-white/45">
                    {candidate.year || "—"} · {candidate.major || "—"}
                  </p>
                </div>

                <span className="rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/10 px-3 py-1 text-xs font-bold text-[var(--orange-soft)]">
                  {pretty(currentStatus)}
                </span>
         </div>

              {isBoard ? (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-green-300/20 bg-green-400/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-green-100/70">
                      Yes
                    </p>
                    <p className="mt-2 text-2xl font-black">{counts.yes}</p>
                  </div>
                  <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-red-100/70">
                      No
                    </p>
                    <p className="mt-2 text-2xl font-black">{counts.no}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                      Discuss
                    </p>
                    <p className="mt-2 text-2xl font-black">{counts.discuss}</p>
                  </div>
                </div>
              ) : null}

              <form
                action={submitHashVote}
                className="mt-6 rounded-[1.5rem] border border-[var(--orange)]/25 bg-[var(--orange)]/10 p-5"
              >
                <input type="hidden" name="candidate_email" value={candidate.email} />
                <input type="hidden" name="candidate_name" value={candidate.full_name} />
                <input type="hidden" name="candidate_stage" value={activeRound.value} />

                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--orange-soft)]">
                  Vote for {activeRound.label}
                </p>

                <label className="mt-4 grid gap-2">
                  <span className="text-sm font-bold">Your vote</span>
                  <select
                    name="vote"
                    required
                    className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3"
                  >
                    {memberVotes.map((vote) => (
                      <option key={vote.value} value={vote.value}>
                        {vote.label}
                      </option>
                    ))}
                  </select>
                </label>

                {isBoard ? (
                  <label className="mt-3 grid gap-2">
                    <span className="text-sm font-bold">Official board decision</span>
                    <select
                      name="official_decision"
                      className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3"
                    >
                      {boardDecisionsByRound[activeRound.value].map((decision) => (
                        <option key={decision.value} value={decision.value}>
                          {decision.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-white/45">
                      This moves the candidate into the next round or removes them from active hash.
                    </span>
                  </label>
                ) : null}

                <textarea
                  name="rationale"
                  rows={3}
                  placeholder="Optional notes"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 outline-none focus:border-[var(--orange)]"
                />

                <button className="mt-4 rounded-full bg-[var(--orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">
                  Submit vote
                </button>
              </form>

              {isBoard ? (
                <div className="mt-5 grid gap-2 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                    Board score summary
                  </p>

                  {candidateScores.slice(0, 4).map((score) => (
                    <div
                      key={score.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <p className="font-bold">
                        {pretty(score.stage)} · {score.reviewer_name || score.reviewer_email}
                      </p>
                      <p className="text-white/55">
                        Scores: {score.score_1}, {score.score_2}, {score.score_3}, {score.score_4} · {pretty(score.recommendation)}
                      </p>
                    </div>
                  ))}

                  {candidateScores.length === 0 ? (
                    <p className="text-white/40">No scores yet.</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {candidateList.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/45">
          No caidates are currently in {activeRound.label}.
        </p>
      ) : null}
    </div>
  );
}
