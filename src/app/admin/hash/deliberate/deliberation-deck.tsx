"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type DeckEntry = {
  id: string;
  name: string;
  status: string;
  rounds: { name: string; score: number | null; count: number; spread: number | null; status: string }[];
  finalScore: number | null;
  impressions: { count: number; avg: number; topTags: string[] } | null;
  decision: { outcome: string; status: string } | null;
};

export default function DeliberationDeck({ entries }: { entries: DeckEntry[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, entries.length - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries.length]);
  const entry = entries[Math.min(Math.max(index, 0), entries.length - 1)];

  if (!entry) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mecg-navy p-6 text-white/60">
        <p>No applicants to deliberate on yet.</p>
        <Link href="/admin/hash" className="text-sm text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">Back to Hash</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-mecg-navy p-6 text-white sm:p-10">
      <header className="flex items-center justify-between">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Deliberation</p>
        <Link href="/admin/hash" className="text-sm text-white/50 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white">Exit</Link>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-3xl bg-white/[0.04] p-10 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] sm:p-14">
          <div>
            <h1 className="text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{entry.name}</h1>
            <p className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">{entry.status}</p>
          </div>
          <p className="font-mono text-7xl font-bold tabular-nums sm:text-8xl">
            {entry.finalScore === null ? <span className="text-3xl font-normal text-white/40">Pending</span> : entry.finalScore.toFixed(1)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {entry.rounds.map((round) => (
              <span key={round.name} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                <span className="text-white/50">{round.name}</span>{" "}
                <span className="font-mono font-semibold tabular-nums">{round.score === null ? (round.status === "PENDING" ? "Pending" : "—") : round.score.toFixed(1)}</span>
                <span className="ml-2 text-xs text-white/40">{round.count} ratings{round.spread != null ? ` · spread ${round.spread.toFixed(0)}` : ""}{round.status === "REVIEW" ? " · review" : ""}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">Event impressions</p>
            {entry.impressions ? (
              <>
                <p className="text-sm text-white/70">
                  <span className="font-mono text-xl font-semibold tabular-nums text-white">{entry.impressions.avg.toFixed(1)}</span>
                  <span className="ml-2 text-white/45">{entry.impressions.count} impressions</span>
                </p>
                {entry.impressions.topTags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {entry.impressions.topTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">{tag}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-white/40">None recorded</p>
            )}
          </div>
          {entry.decision && (
            <span className="rounded-full bg-mecg-orange px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-navy">
              {entry.decision.outcome} · {entry.decision.status}
            </span>
          )}
        </div>
      </div>
      <footer className="flex items-center justify-between">
        <button type="button" onClick={() => setIndex((current) => Math.max(current - 1, 0))} disabled={index <= 0} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Previous</button>
        <p className="font-mono text-xs tabular-nums text-white/40">{Math.min(index + 1, entries.length)} of {entries.length}</p>
        <button type="button" onClick={() => setIndex((current) => Math.min(current + 1, entries.length - 1))} disabled={index >= entries.length - 1} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Next</button>
      </footer>
    </main>
  );
}
