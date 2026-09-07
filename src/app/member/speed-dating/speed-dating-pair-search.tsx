"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import {
  searchSpeedDatingPairs,
  type SpeedDatingPair,
  type SpeedDatingPairQueue,
} from "@/lib/speed-dating-pairs";
import SpeedDatingPairGrading from "./speed-dating-pair-grading";

export default function SpeedDatingPairSearch({
  initialQueue,
  requestedPairId,
  submitted,
  reported,
}: {
  initialQueue: SpeedDatingPairQueue;
  requestedPairId?: string;
  submitted: boolean;
  reported: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pairs = initialQueue.pairs;
  const results = useMemo(() => query.trim()
    ? searchSpeedDatingPairs(pairs, query)
    : pairs.filter((pair) => pair.claimed).slice(0, 6), [pairs, query]);
  const claimed = pairs.filter((pair) => pair.claimed);
  const isActive = initialQueue.roundStatus === "ACTIVE";
  const activePair = requestedPairId
    ? pairs.find((pair) => pair.id === requestedPairId && pair.claimed && !pair.submittedAt)
    : undefined;

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  async function claimPair(pair: SpeedDatingPair) {
    setPendingId(pair.id);
    setError("");
    try {
      const response = await fetch(`/api/member/speed-dating/pairs/${encodeURIComponent(pair.id)}/claim`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not claim this pair");
      router.push(`/member/speed-dating?pair=${encodeURIComponent(pair.id)}`);
      router.refresh();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not claim this pair");
    } finally {
      setPendingId(null);
    }
  }

  if (activePair && initialQueue.criterion && initialQueue.rubricReady && initialQueue.calibrated
      && activePair.members.every((member) => member.assignmentId)) {
    return (
      <SpeedDatingPairGrading
        pair={activePair}
        criterion={initialQueue.criterion}
        onBack={() => router.push("/member/speed-dating")}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initialQueue.roundName}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy">Search either applicant’s name</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">You only need one name. The matching partner appears automatically so you can confirm both people before claiming.</p>

        {submitted && <div className="mt-4"><OperationNotice kind="success">Both ratings were submitted and locked. Search for the next pair.</OperationNotice></div>}
        {reported && <div className="mt-4"><OperationNotice kind="success">The wrong pair was reported to the Board. Both private drafts were preserved.</OperationNotice></div>}
        {!initialQueue.rubricReady && (
          <div className="mt-4"><OperationNotice kind="error">The Board must configure one required 100% Speed Dating criterion before pair grading can begin.</OperationNotice></div>
        )}
        {initialQueue.rubricReady && !initialQueue.calibrated && (
          <div className="mt-4 rounded-xl bg-mecg-orange/[0.1] p-4">
            <p className="text-sm font-semibold text-mecg-navy">Review the scoring anchors before grading</p>
            <p className="mt-1 text-xs leading-5 text-mecg-navy/60">Calibration keeps the 1–5 scale consistent across a live round.</p>
            <Link href={`/member/calibration/${encodeURIComponent(initialQueue.roundId)}?return=${encodeURIComponent("/member/speed-dating")}`} className="button-primary mt-3 inline-flex text-sm">Review calibration</Link>
          </div>
        )}

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
          {results.length === 0 && !query.trim() ? (
            <div className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center text-sm text-mecg-navy/55">Search to find the pair in front of you. Press / to return here quickly.</div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
              <p className="font-semibold text-mecg-navy">No available pair matches “{query.trim()}”</p>
              <p className="mt-1 text-sm text-mecg-navy/55">Check the spelling or search the partner’s name. Conflicted pairs are intentionally hidden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-navy/50">{query.trim() ? `${results.length} ${results.length === 1 ? "pair" : "pairs"} found` : "Continue or review recent pairs"}</p>
              {results.map((pair) => (
                <article key={pair.id} className="rounded-2xl border border-mecg-navy/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-mecg-orange-ink">{pair.label}</p>
                      <h3 className="mt-1 text-lg font-semibold text-mecg-navy">{pair.members[0].name} <span className="font-normal text-mecg-navy/35">+</span> {pair.members[1].name}</h3>
                    </div>
                    {pair.submittedAt
                      ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Submitted</span>
                      : pair.claimed && <span className="rounded-full bg-mecg-orange/[0.14] px-3 py-1 text-xs font-semibold text-mecg-orange-ink">In progress</span>}
                  </div>
                  <p className="mt-3 text-sm text-mecg-navy/60">Confirm both names before continuing. Each applicant will receive their own 1–5 grade.</p>
                  <button
                    type="button"
                    disabled={!isActive || !initialQueue.rubricReady || pendingId === pair.id || Boolean(pair.submittedAt)}
                    onClick={() => pair.claimed
                      ? router.push(`/member/speed-dating?pair=${encodeURIComponent(pair.id)}`)
                      : void claimPair(pair)}
                    className="button-primary mt-4 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingId === pair.id ? "Claiming…" : pair.submittedAt ? "Submitted" : pair.claimed ? "Continue grading" : "Claim pair"}
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
        <p className="text-sm text-white/65">{claimed.length === 1 ? "pair started" : "pairs started"}</p>
        <p className="mt-4 text-sm font-semibold text-white">{claimed.filter((pair) => pair.submittedAt).length} submitted</p>
        <div className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white/70">
          <p>Claims keep your live work organized. Other evaluators can still grade the same pair independently.</p>
        </div>
      </aside>
    </div>
  );
}
