"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { applicationStatusLabel, decisionOutcomeLabel, decisionStatusLabel } from "@/lib/labels";
import { initials } from "@/lib/initials";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { authorizedFetch } from "@/lib/client-fetch";
import { runAction } from "@/lib/run-action";
import type { HashStage } from "@/lib/hash-tally";
import { formatStars } from "../../speed-dating-results";

export type DeckEntry = {
  id: string;
  name: string;
  major: string | null;
  classYear: string | null;
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
type TallyRow = { applicationId: string; yes: number; no: number; unsure: number; total: number; quorum: number; outcome: string };
// drumroll → stamped → leaving, then the deck advances and the phase clears.
type Phase = { kind: "drumroll" } | { kind: "stamped" | "leaving"; status: string };
type Confetti = { x: string; delay: string; hue: number }[];

const PANEL = "rounded-2xl bg-white/[0.06] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]";
const SORT_BUTTON = "rounded-full px-3 py-1 text-xs font-semibold text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white aria-pressed:bg-white/[0.12] aria-pressed:text-white";
const ENTRANCES = ["fly", "spin", "swoosh"] as const;
const BARS = [["yes", "Yes", "bg-emerald-400"], ["unsure", "Unsure", "bg-amber-300"], ["no", "No", "bg-rose-400"]] as const;
const RUSH_URL = "/api/admin/rush";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function graders(count: number) {
  return `${count} grader${count === 1 ? "" : "s"}`;
}

// Entrance keyed off the id: stable across re-renders, varied across applicants, no ref or effect.
function entrance(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return ENTRANCES[sum % ENTRANCES.length];
}

function makeConfetti(): Confetti {
  return Array.from({ length: 60 }, () => ({ x: `${Math.random() * 100}vw`, delay: `${Math.random() * 600}ms`, hue: Math.floor(Math.random() * 360) }));
}

// Rolls 0 → target with an ease-out over `duration`; remounts with the card, so every slide starts from 0.
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useCountUp(value))}</>;
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

export default function DeliberationDeck({
  entries,
  cycleId,
  stage,
  quorum,
  canOperate,
  initialPresentingId,
}: {
  entries: DeckEntry[];
  cycleId: string;
  stage: HashStage | "FINAL";
  quorum: number;
  canOperate: boolean;
  initialPresentingId: string | null;
}) {
  const storageKey = `mecg:hash-deck:${cycleId}`;
  const [sort, setSort] = useState<Sort>("score");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(new Set());
  const [tally, setTally] = useState<Map<string, TallyRow>>(new Map());
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase | null>(null);
  const [confetti, setConfetti] = useState<Confetti | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Server order is by score; A to Z re-sorts here so the projector never reloads mid-discussion.
  const ordered = useMemo(() => sort === "score" ? entries : [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries, sort]);
  const index = Math.max(ordered.findIndex((candidate) => candidate.id === selectedId), 0);
  const entry = ordered[index];

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(storageKey); } catch {}
    // The board's cursor wins over this browser's memory so a second screen picks up where the room is.
    const preferred = [initialPresentingId, stored].find((id) => id && entries.some((candidate) => candidate.id === id));
    if (!preferred) return;
    const timer = window.setTimeout(() => setSelectedId(preferred), 0);
    return () => window.clearTimeout(timer);
  }, [entries, storageKey, initialPresentingId]);

  // Presenting pointer for the phones. The cleanup is the debounce: arrow-key spam sends one POST.
  const entryId = entry?.id;
  useEffect(() => {
    if (!canOperate || !entryId) return;
    const timer = window.setTimeout(() => {
      void runAction(RUSH_URL, { action: "SET_HASH_PRESENTING", cycleId, applicationId: entryId }, "Could not point the phones at this applicant").then((result) => { if (!result.ok) setError(result.error); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [canOperate, cycleId, entryId]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await authorizedFetch("/api/admin/hash/live", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { tally: TallyRow[] };
        if (!cancelled) setTally(new Map(body.tally.map((row) => [row.applicationId, row])));
      } catch {}
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    document.addEventListener("visibilitychange", tick);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  function select(id: string) {
    setSelectedId(id);
    try { window.localStorage.setItem(storageKey, id); } catch {}
  }
  function step(delta: number) {
    const next = ordered[Math.min(Math.max(index + delta, 0), ordered.length - 1)];
    if (next) select(next.id);
  }

  const row = entry ? tally.get(entry.id) : undefined;
  const canReveal = canOperate && stage !== "FINAL" && !!entry && !applied[entry.id] && !!row && row.total >= quorum;

  async function reveal() {
    if (!canReveal || phase || !entry) return;
    const target = entry;
    setError("");
    setPhase({ kind: "drumroll" });
    await wait(1200);
    const result = await runAction(RUSH_URL, { action: "APPLY_STAGE_HASH", cycleId, applicationId: target.id }, "Could not apply the result");
    if (!result.ok) { setError(result.error); setPhase(null); return; }
    const status = String((result.body as { id?: string } | null)?.id ?? "");
    setPhase({ kind: "stamped", status });
    if (status !== "REJECTED") { setConfetti(makeConfetti()); window.setTimeout(() => setConfetti(null), 2500); }
    await wait(2500);
    setPhase({ kind: "leaving", status });
    await wait(700);
    const nextApplied = { ...applied, [target.id]: status };
    setApplied(nextApplied);
    const at = ordered.findIndex((candidate) => candidate.id === target.id);
    const next = [...ordered.slice(at + 1), ...ordered.slice(0, at)].find((candidate) => !nextApplied[candidate.id]);
    if (next) select(next.id);
    setPhase(null);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if (event.key === "/" && !typing) { event.preventDefault(); searchRef.current?.focus(); return; }
      if (typing || phase) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "Enter") void reveal();
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
  const outcome = applied[entry.id];
  const stampStatus = phase && phase.kind !== "drumroll" ? phase.status : null;
  const scale = Math.max(row?.total ?? 0, quorum, 1);
  const cardMotion = phase?.kind === "drumroll" ? "deck-drumroll" : phase?.kind === "leaving" ? (phase.status === "REJECTED" ? "deck-fade-out" : "deck-fly-off") : "";

  return (
    <main className={`flex min-h-screen flex-col bg-mecg-navy p-6 text-white sm:p-10 ${phase?.kind === "stamped" ? "deck-screen-shake" : ""}`}>
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
          data-enter={entrance(entry.id)}
          className={`deck-card relative flex w-full max-w-4xl flex-col items-center gap-8 rounded-3xl bg-white/[0.04] p-8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] sm:p-12 ${cardMotion}`}
        >
          {failedHeadshots.has(entry.id) ? (
            <span className="deck-headshot-pop flex size-28 items-center justify-center rounded-full bg-white/[0.08] text-3xl font-semibold text-white/70" aria-hidden="true">{initials(entry.name)}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
            <img
              src={`/api/admin/applications/${encodeURIComponent(entry.id)}/headshot`}
              alt=""
              className="deck-headshot-pop size-28 rounded-full object-cover"
              onError={() => setFailedHeadshots((current) => new Set(current).add(entry.id))}
            />
          )}
          <div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <h1 className="deck-wordart break-words text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">{entry.name}</h1>
              {outcome && <span className="rounded-full bg-white/[0.12] px-3 py-1 text-sm font-semibold">{applicationStatusLabel(outcome)}</span>}
            </div>
            <p className="mt-3 text-[13px] font-semibold text-white/50">{[entry.major, entry.classYear, entry.groupName, applicationStatusLabel(entry.status)].filter(Boolean).join(" · ")}</p>
          </div>
          <div className={`${PANEL} relative grid w-full gap-4 text-left sm:grid-cols-[1fr_auto] sm:items-center`}>
            <div>
              <p className="text-[13px] font-semibold text-white/50">Room vote</p>
              {row ? (
                <div className="mt-2 space-y-2">
                  {BARS.map(([key, label, color]) => (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span className="w-14 text-white/60">{label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${(row[key] / scale) * 100}%`, transition: "width 600ms" }} />
                      </div>
                      <span className="tabular w-8 text-right font-semibold">{row[key]}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-white/50">No votes yet</p>}
            </div>
            <div className="sm:w-48 sm:text-right">
              <p className="tabular text-sm font-semibold text-white/80">{canReveal ? "Quorum reached · press Enter to reveal" : `${row?.total ?? 0} of ${quorum} voted`}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min((row?.total ?? 0) / Math.max(quorum, 1), 1) * 100}%`, transition: "width 600ms" }} />
              </div>
            </div>
            {phase?.kind === "drumroll" && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#111a36] text-6xl font-bold" aria-hidden="true">…</div>}
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
                  <p className="tabular mt-1 text-6xl font-bold"><CountUp value={groupCase.mean} format={(value) => value.toFixed(1)} /><span className="ml-1 text-base font-normal text-white/50">/ 40</span></p>
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
                  <p className="tabular mt-1 text-6xl font-bold">{speedDating.adjusted == null ? formatStars(null) : <CountUp value={speedDating.adjusted} format={formatStars} />}</p>
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
          {stampStatus && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className={`deck-stamp rounded-2xl border-8 bg-mecg-navy/60 px-10 py-4 text-6xl font-black uppercase tracking-[0.2em] sm:text-8xl ${stampStatus === "REJECTED" ? "text-rose-300 border-rose-300" : "text-emerald-300 border-emerald-300"}`}>
                {applicationStatusLabel(stampStatus).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
      {confetti && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
          {confetti.map((piece, pieceIndex) => (
            <span key={pieceIndex} className="deck-confetti absolute top-0 size-3 rounded-sm" style={{ "--x": piece.x, "--delay": piece.delay, "--hue": piece.hue } as CSSProperties} />
          ))}
        </div>
      )}
      <footer className="flex items-center justify-between">
        <button type="button" onClick={() => step(-1)} disabled={index <= 0 || !!phase} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Previous</button>
        <div className="text-center">
          <p className="tabular text-sm font-semibold text-white/70">{index + 1} of {ordered.length}</p>
          {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
        </div>
        <button type="button" onClick={() => step(1)} disabled={index >= ordered.length - 1 || !!phase} className="rounded-full px-4 py-2 text-sm text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white disabled:opacity-30">Next</button>
      </footer>
    </main>
  );
}
