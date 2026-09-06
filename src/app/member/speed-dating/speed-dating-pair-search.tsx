"use client";

import { useMemo, useRef, useState } from "react";
import OperationNotice from "@/components/operation-notice";
import {
  searchSpeedDatingPairs,
  type SpeedDatingPair,
  type SpeedDatingPairQueue,
} from "@/lib/speed-dating-pairs";

export default function SpeedDatingPairSearch({ initialQueue }: { initialQueue: SpeedDatingPairQueue }) {
  const [pairs, setPairs] = useState(initialQueue.pairs);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchSpeedDatingPairs(pairs, query), [pairs, query]);
  const claimed = pairs.filter((pair) => pair.claimed);
  const isActive = initialQueue.roundStatus === "ACTIVE";

  async function claimPair(pair: SpeedDatingPair) {
    setPendingId(pair.id);
    setError("");
    try {
      const response = await fetch(`/api/member/speed-dating/pairs/${encodeURIComponent(pair.id)}/claim`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not claim this pair");
      setPairs((current) => current.map((candidate) =>
        candidate.id === pair.id ? { ...candidate, claimed: true } : candidate));
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not claim this pair");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initialQueue.roundName}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy">Search either applicant’s name</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">You only need one name. The matching partner appears automatically so you can confirm both people before claiming.</p>

        <label htmlFor="pair-search" className="mt-6 block text-sm font-semibold text-mecg-navy">Applicant name</label>
        <div className="relative mt-2">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mecg-navy/45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            id="pair-search"
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setError(""); }}
            placeholder="Start typing a first or last name"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
          />
        </div>

        {!isActive && (
          <div className="mt-4"><OperationNotice kind="info">Pairs are published. Claiming opens when the Board starts the round.</OperationNotice></div>
        )}
        {error && <div className="mt-4"><OperationNotice kind="error">{error}</OperationNotice></div>}

        <div className="mt-5" aria-live="polite">
          {!query.trim() ? (
            <div className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center text-sm text-mecg-navy/55">Search to find the pair in front of you.</div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
              <p className="font-semibold text-mecg-navy">No available pair matches “{query.trim()}”</p>
              <p className="mt-1 text-sm text-mecg-navy/55">Check the spelling or search the partner’s name. Conflicted pairs are intentionally hidden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-navy/50">{results.length} {results.length === 1 ? "pair" : "pairs"} found</p>
              {results.map((pair) => (
                <article key={pair.id} className="rounded-2xl border border-mecg-navy/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-mecg-orange-ink">{pair.label}</p>
                      <h3 className="mt-1 text-lg font-semibold text-mecg-navy">{pair.members[0].name} <span className="font-normal text-mecg-navy/35">+</span> {pair.members[1].name}</h3>
                    </div>
                    {pair.claimed && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Claimed by you</span>}
                  </div>
                  <p className="mt-3 text-sm text-mecg-navy/60">Confirm both names before continuing. Each applicant will receive their own 1–5 grade.</p>
                  <button
                    type="button"
                    disabled={!isActive || pendingId === pair.id || pair.claimed}
                    onClick={() => void claimPair(pair)}
                    className="button-primary mt-4 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingId === pair.id ? "Claiming…" : pair.claimed ? "Pair claimed" : "Claim this pair"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl bg-mecg-navy p-5 text-white lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">Your round</p>
        <p className="mt-2 text-3xl font-semibold">{claimed.length}</p>
        <p className="text-sm text-white/65">{claimed.length === 1 ? "pair claimed" : "pairs claimed"}</p>
        <div className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white/70">
          <p>Claims keep your live work organized. Other evaluators can still grade the same pair independently.</p>
        </div>
      </aside>
    </div>
  );
}
