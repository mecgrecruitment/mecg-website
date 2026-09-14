"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { applicationStatusLabel, decisionOutcomeLabel, decisionStatusLabel } from "@/lib/labels";
import { initials } from "@/lib/initials";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { formatStars } from "../../speed-dating-results";

export type DeckEntry = {
  id: string;
  name: string;
  status: string;
  groupName: string | null;
  groupCase: { mean: number | null; band: string | null; count: number; criteria: { name: string; mean: number | null }[]; notes: string[] } | null;
  speedDating: { adjusted: number | null; mean: number | null; count: number; notes: string[] } | null;
  rounds: { name: string; score: number | null; count: number; spread: number | null; status: string }[];
  finalScore: number | null;
  impressions: { count: number; topTags: string[]; notes: string[] } | null;
  decision: { outcome: string; status: string } | null;
};

type Sort = "score" | "name";

const PANEL = "rounded-2xl bg-white/[0.06] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]";
const SORT_BUTTON = "rounded-full px-3 py-1 text-xs font-semibold text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white aria-pressed:bg-white/[0.12] aria-pressed:text-white";

function graders(count: number) {
  return `${count} grader${count === 1 ? "" : "s"}`;
}

function NotesList({ title, notes }: { title: string; notes: string[] }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-[13px] font-semibold text-white/50">{title}</p>
      {notes.length ? (
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm leading-6 text-white/75">
          {notes.map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>&ldquo;{note}&rdquo;</li>)}
        </ul>
      ) : <p className="mt-2 text-sm text-white/50">No notes</p>}
    </div>
  );
}

export default function DeliberationDeck({ entries, cycleId }: { entries: DeckEntry[]; cycleId: string }) {
  const storageKey = `mecg:hash-deck:${cycleId}`;
  const [sort, setSort] = useState<Sort>("score");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  // Server order is by score; A to Z re-sorts here so the projector never reloads mid-discussion.
  const ordered = useMemo(() => sort === "score" ? entries : [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries, sort]);
  const index = Math.max(ordered.findIndex((candidate) => candidate.id === selectedId), 0);
  const entry = ordered[index];

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(storageKey); } catch {}
    if (!stored || !entries.some((candidate) => candidate.id === stored)) return;
    const timer = window.setTimeout(() => setSelectedId(stored), 0);
    return () => window.clearTimeout(timer);
  }, [entries, storageKey]);

  function select(id: string) {
    setSelectedId(id);
    try { window.localStorage.setItem(storageKey, id); } catch {}
  }
  function step(delta: number) {
    const next = ordered[Math.min(Math.max(index + delta, 0), ordered.length - 1)];
    if (next) select(next.id);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if (event.key === "/" && !typing) { event.preventDefault(); searchRef.current?.focus(); return; }
      if (typing) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const matches = query.trim() ? ordered.filter((candidate) => matchesApplicantName(candidate.name, query)).slice(0, 8) : [];
  function jump(id: string) {
    select(id);
    setQuery("");
    searchRef.current?.blur();
  }

  if (!entry) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mecg-navy p-6 text-white/60">
        <p>No applicants to discuss yet.</p>
        <Link href="/admin/hash" className="text-sm text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">Back to Hash</Link>
      </main>
    );
  }

  const stageHash = entry.finalScore === null && entry.rounds.length === 0;
  const groupCase = entry.groupCase;
  const speedDating = entry.speedDating;

  return (
    <main className="flex min-h-screen flex-col bg-mecg-navy p-6 text-white sm:p-10">
      <header className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-semibold text-white/50">Discussion mode</p>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={sort === "score"} onClick={() => setSort("score")} className={SORT_BUTTON}>By score</button>
          <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")} className={SORT_BUTTON}>A to Z</button>
          <Link href="/admin/hash" className="ml-2 text-sm text-white/50 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white">Exit</Link>
        </div>
      </header>
      <div className="relative mt-4 self-center w-full max-w-sm">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); jump(matches[0].id); } if (event.key === "Escape") setQuery(""); }}
          placeholder="Jump to a name"
          aria-label="Jump to a name"
          className="w-full rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white placeholder:text-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]"
        />
        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl bg-[#111a36] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]">
            {matches.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => jump(candidate.id)} className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/[0.08] hover:text-white">{candidate.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {index + 1} of {ordered.length}: {entry.name}
      </p>
      <div className="flex flex-1 items-center justify-center py-6">
        <div
          key={entry.id}
          className="flex w-full max-w-4xl flex-col items-center gap-8 rounded-3xl bg-white/[0.04] p-8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] sm:p-12"
        >
          {failedHeadshots.has(entry.id) ? (
            <span className="flex size-28 items-center justify-center rounded-full bg-white/[0.08] text-3xl font-semibold text-white/70" aria-hidden="true">{initials(entry.name)}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
            <img
              src={`/api/admin/applications/${encodeURIComponent(entry.id)}/headshot`}
              alt=""
              className="size-28 rounded-full object-cover"
              onError={() => setFailedHeadshots((current) => new Set(current).add(entry.id))}
            />
          )}
          <div>
            <h1 className="break-words text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{entry.name}</h1>
            <p className="mt-3 text-[13px] font-semibold text-white/50">{[entry.groupName, applicationStatusLabel(entry.status)].filter(Boolean).join(" · ")}</p>
          </div>
          {!stageHash && (
            <>
              <p className="tabular text-7xl font-bold sm:text-8xl">
                {entry.finalScore === null ? <span className="text-3xl font-normal text-white/50">Pending</span> : entry.finalScore.toFixed(1)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {entry.rounds.map((round) => (
                  <span key={round.name} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                    <span className="text-white/50">{round.name}</span>{" "}
                    <span className="tabular font-semibold">{round.score === null ? (round.status === "PENDING" ? "Pending" : "—") : round.score.toFixed(1)}</span>
                    <span className="ml-2 text-xs text-white/50">{round.count} ratings{round.spread != null ? ` · spread ${round.spread.toFixed(0)}` : ""}{round.status === "REVIEW" ? " · review" : ""}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <div className={PANEL}>
              <p className="text-[13px] font-semibold text-white/50">Group Case</p>
              {groupCase?.mean != null ? (
                <>
                  <p className="tabular mt-1 text-6xl font-bold">{groupCase.mean.toFixed(1)}<span className="ml-1 text-base font-normal text-white/50">/ 40</span></p>
                  <p className="mt-1 text-lg font-semibold">{groupCase.band}</p>
                  <p className="text-sm text-white/50">{graders(groupCase.count)}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    {groupCase.criteria.map((criterion) => (
                      <div key={criterion.name} title={criterion.name} className="rounded-lg bg-white/[0.05] px-2 py-1.5">
                        <p className="truncate text-white/50">{criterion.name.split(/\s+/)[0]}</p>
                        <p className="tabular font-semibold">{criterion.mean == null ? "—" : criterion.mean.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="mt-3 text-2xl text-white/50">Not graded</p>}
            </div>
            <div className={PANEL}>
              <p className="text-[13px] font-semibold text-white/50">Speed Dating</p>
              {speedDating && speedDating.count > 0 ? (
                <>
                  <p className="tabular mt-1 text-6xl font-bold">{formatStars(speedDating.adjusted)}</p>
                  <p className="mt-1 text-sm text-white/50">raw {speedDating.mean == null ? "—" : speedDating.mean.toFixed(1)} · {graders(speedDating.count)}</p>
                </>
              ) : <p className="mt-3 text-2xl text-white/50">Not graded</p>}
            </div>
          </div>
          <div className="grid w-full gap-6 sm:grid-cols-2">
            <NotesList title="Group Case notes" notes={groupCase?.notes ?? []} />
            <NotesList title="Speed Dating notes" notes={speedDating?.notes ?? []} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[13px] font-semibold text-white/50">Event observations</p>
            {entry.impressions ? (
              <>
                <p className="text-sm text-white/70">{entry.impressions.count} observation{entry.impressions.count === 1 ? "" : "s"}</p>
                {entry.impressions.topTags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {entry.impressions.topTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">{tag}</span>
                    ))}
                  </div>
                )}
                {entry.impressions.notes.length > 0 && (
                  <ul className="mt-2 max-w-xl space-y-1 text-sm leading-6 text-white/60">
                    {entry.impressions.notes.slice(0, 5).map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>{note}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-white/50">None recorded</p>
            )}
          </div>
          {entry.decision && (
            <span className="rounded-full bg-mecg-orange px-4 py-1.5 text-[13px] font-semibold text-mecg-navy">
              {decisionOutcomeLabel(entry.decision.outcome)} · {decisionStatusLabel(entry.decision.status)}
            </span>
          )}
        </div>
      </div>
      <footer className="flex items-center justify-between">
        <button type="button" onClick={() => step(-1)} disabled={index <= 0} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Previous</button>
        <p className="tabular text-sm font-semibold text-white/70">{index + 1} of {ordered.length}</p>
        <button type="button" onClick={() => step(1)} disabled={index >= ordered.length - 1} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Next</button>
      </footer>
    </main>
  );
}
