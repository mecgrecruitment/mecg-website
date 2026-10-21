"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { applicationStatusLabel, decisionOutcomeLabel, decisionStatusLabel } from "@/lib/labels";
import { initials } from "@/lib/initials";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { runAction } from "@/lib/run-action";
import { HASH_STAGE_RULES, type HashStage } from "@/lib/hash-tally";
import { formatStars } from "@/lib/speed-dating-roster";
import { LIVE_SYNC_START, liveSyncNotice, nextLiveSync, pollOutcome, type PollOutcome } from "@/lib/live-sync";

export type DeckEntry = {
  id: string;
  name: string;
  major: string | null;
  classYear: string | null;
  status: string;
  // Set when this stage's result was already applied; the deck treats it as stamped.
  result: string | null;
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
// drumroll → stamped. The stamp holds until the presenter moves; leaving a
// stamped card is what records it as applied, so nothing is on a timer.
type Phase = { kind: "drumroll" } | { kind: "stamped"; status: string };
type Confetti = { x: string; delay: string; hue: number }[];

const PANEL = "rounded-xl bg-white/10 p-5 inset-ring inset-ring-white/10";
const SORT_BUTTON = "min-h-11 min-w-11 rounded-sm px-3 py-1 text-xs font-semibold text-white/70 inset-ring inset-ring-white/20 hover:text-white aria-pressed:bg-white/[0.12] aria-pressed:text-white";
const ENTRANCES = ["fly", "spin", "swoosh"] as const;
const RUSH_URL = "/api/admin/rush";
const APPLY_TIMEOUT_MS = 15_000;
const MOTION_PREFERENCE_KEY = "mecg:hash-deck:motion";
const PRESENT_RETRY_MS = 2_000;
// Arrows still page the deck from a focused button; Enter and Space stay native there.
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const OWNS_ARROWS = `${TEXT_ENTRY}, a, summary, [role="link"], [tabindex]:not([data-deck-context])`;
const OWNS_KEYS = `${OWNS_ARROWS}, button, [role="button"]`;

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

function NotesList({ title, notes }: { title: string; notes: string[] }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-[13px] font-semibold text-white/70">{title}</p>
      {notes.length ? (
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm leading-6 text-white/70">
          {notes.map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>&ldquo;{note}&rdquo;</li>)}
        </ul>
      ) : <p className="mt-2 text-sm text-white/70">No notes</p>}
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
  // Start still until browser preferences are known; this also prevents a
  // reduced-motion viewer seeing an animated first frame during hydration.
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean | null>(null);
  const [presentationMotion, setPresentationMotion] = useState(false);
  // Only the tab that opts in moves members' phones, so a second laptop can browse freely.
  // It starts off on every load: Duplicate Tab copies sessionStorage and would make two presenters.
  const [presentingHere, setPresentingHere] = useState(false);
  const [phonesShowId, setPhonesShowId] = useState(initialPresentingId);
  const motionEnabled = presentationMotion && systemReducedMotion === false;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(() => {
      setSystemReducedMotion(media.matches);
      let enabled = true;
      try { enabled = window.sessionStorage.getItem(MOTION_PREFERENCE_KEY) !== "off"; } catch {}
      setPresentationMotion(enabled);
    }, 0);
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => { window.clearTimeout(timer); media.removeEventListener("change", update); };
  }, []);

  function togglePresentationMotion() {
    if (systemReducedMotion !== false) return;
    const enabled = !presentationMotion;
    setPresentationMotion(enabled);
    // This non-sensitive display preference lasts only in this browser tab.
    // Storage may be unavailable; the in-memory control must still work.
    try { window.sessionStorage.setItem(MOTION_PREFERENCE_KEY, enabled ? "on" : "off"); } catch {}
  }
  const [sort, setSort] = useState<Sort>("score");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(new Set());
  const [tally, setTally] = useState<Map<string, TallyRow>>(new Map());
  const [applied, setApplied] = useState<Record<string, string>>(() => Object.fromEntries(entries.flatMap((candidate) => candidate.result ? [[candidate.id, candidate.result]] : [])));
  const [revisit, setRevisit] = useState<Set<string>>(new Set());
  const [onlyRevisits, setOnlyRevisits] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [confetti, setConfetti] = useState<Confetti | null>(null);
  const [error, setError] = useState("");
  const [sync, setSync] = useState(LIVE_SYNC_START);
  const [presentError, setPresentError] = useState("");
  const [applyFailure, setApplyFailure] = useState<{ kind: "rejected" | "unknown"; message: string } | null>(null);
  const applyErrorRef = useRef<HTMLDivElement>(null);
  const applyingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceButtonRef = useRef<HTMLButtonElement>(null);
  const focusNextContext = useRef(false);
  useEffect(() => { if (applyFailure) applyErrorRef.current?.focus(); }, [applyFailure]);
  const searchRef = useRef<HTMLInputElement>(null);
  // Server order is by score; A to Z re-sorts here so the projector never reloads mid-discussion.
  const sorted = useMemo(() => sort === "score" ? entries : [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries, sort]);
  // The revisit filter drops itself once the last flag clears, so the deck never goes empty.
  const revisitCount = entries.filter((candidate) => revisit.has(candidate.id)).length;
  const ordered = onlyRevisits && revisitCount > 0 ? sorted.filter((candidate) => revisit.has(candidate.id)) : sorted;
  // A cursor outside the narrowed list lands on its first card.
  const index = Math.max(ordered.findIndex((candidate) => candidate.id === selectedId), 0);
  const entry = ordered[index];
  useEffect(() => {
    if (phase?.kind === "stamped") advanceButtonRef.current?.focus();
    else if (focusNextContext.current) {
      headingRef.current?.focus();
      focusNextContext.current = false;
    }
  }, [entry?.id, phase?.kind]);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(storageKey); } catch {}
    // The board's cursor wins over this browser's memory so a second screen picks up where the room is.
    const preferred = [initialPresentingId, stored].find((id) => id && entries.some((candidate) => candidate.id === id));
    if (!preferred) return;
    const timer = window.setTimeout(() => setSelectedId(preferred), 0);
    return () => window.clearTimeout(timer);
  }, [entries, storageKey, initialPresentingId]);

  useEffect(() => {
    let stored: string[] = [];
    try { stored = JSON.parse(window.localStorage.getItem(`${storageKey}:revisit`) ?? "[]"); } catch {}
    const known = stored.filter((id) => entries.some((candidate) => candidate.id === id));
    if (!known.length) return;
    const timer = window.setTimeout(() => setRevisit(new Set(known)), 0);
    return () => window.clearTimeout(timer);
  }, [entries, storageKey]);

  // Presenting pointer for the phones. The cleanup is the debounce: arrow-key spam sends one POST.
  const entryId = entry?.id;
  const lastBroadcast = useRef<string | null>(null);
  // The applicant whose broadcast failed and is still wanted; the poll and one timer retry it.
  const failedBroadcast = useRef<string | null>(null);
  const retryBroadcastTimer = useRef<number | undefined>(undefined);
  const broadcast = useCallback(function send(applicationId: string, retryLater = true) {
    lastBroadcast.current = applicationId;
    window.clearTimeout(retryBroadcastTimer.current);
    void runAction(RUSH_URL, { action: "SET_HASH_PRESENTING", cycleId, applicationId }, "Could not point the phones at this applicant").then((result) => {
      if (lastBroadcast.current !== applicationId) return;
      if (result.ok) {
        failedBroadcast.current = null;
        setPresentError("");
        setPhonesShowId(applicationId);
        return;
      }
      setPresentError(result.error);
      failedBroadcast.current = applicationId;
      if (retryLater) retryBroadcastTimer.current = window.setTimeout(() => {
        if (failedBroadcast.current === applicationId && lastBroadcast.current === applicationId) send(applicationId, false);
      }, PRESENT_RETRY_MS);
    });
  }, [cycleId]);
  useEffect(() => () => window.clearTimeout(retryBroadcastTimer.current), []);
  useEffect(() => {
    if (!canOperate || !presentingHere || !entryId || lastBroadcast.current === entryId) return;
    const timer = window.setTimeout(() => broadcast(entryId), 300);
    return () => window.clearTimeout(timer);
  }, [broadcast, canOperate, presentingHere, entryId]);

  function togglePresenting() {
    const enabled = !presentingHere;
    setPresentingHere(enabled);
    if (enabled && entry) broadcast(entry.id);
    else {
      lastBroadcast.current = null;
      failedBroadcast.current = null;
      window.clearTimeout(retryBroadcastTimer.current);
      setPresentError("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      let outcome: PollOutcome = "failed";
      try {
        const response = await authorizedFetch(`/api/admin/hash/live?cycleId=${encodeURIComponent(cycleId)}`, { cache: "no-store" });
        outcome = pollOutcome(response.status);
        if (outcome === "ok") {
          const body = (await response.json()) as { tally: TallyRow[]; presentingId?: string | null };
          if (!cancelled) {
            setTally(new Map(body.tally.map((row) => [row.applicationId, row])));
            setPhonesShowId(body.presentingId ?? null);
          }
        }
      } catch { outcome = "failed"; }
      if (cancelled) return;
      setSync((current) => nextLiveSync(current, outcome));
      const failed = failedBroadcast.current;
      if (outcome === "ok" && failed && failed === lastBroadcast.current) broadcast(failed, false);
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    document.addEventListener("visibilitychange", tick);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [broadcast, cycleId]);

  function select(id: string) {
    if (id !== entry?.id && headingRef.current?.closest(".deck-card")?.contains(document.activeElement)) focusNextContext.current = true;
    if (applyFailure?.kind === "rejected") setApplyFailure(null);
    setSelectedId(id);
    try { window.localStorage.setItem(storageKey, id); } catch {}
  }
  // Moving off a stamped card commits it; the drumroll is a request in flight, so it holds.
  function leave(): Record<string, string> {
    if (phase?.kind !== "stamped" || !entry) return applied;
    // An UNSURE stamp applied nothing; the applicant stays live and flagged to revisit.
    if (phase.status === "UNSURE") { setPhase(null); return applied; }
    const nextApplied = { ...applied, [entry.id]: phase.status };
    setApplied(nextApplied);
    setPhase(null);
    return nextApplied;
  }
  function toggleRevisit(force = false) {
    if (phase?.kind === "drumroll" || !entry) return;
    const next = new Set(revisit);
    if (force) next.add(entry.id);
    else if (!next.delete(entry.id)) next.add(entry.id);
    setRevisit(next);
    try { window.localStorage.setItem(`${storageKey}:revisit`, JSON.stringify([...next])); } catch {}
  }
  function step(delta: number) {
    if (phase?.kind === "drumroll") return;
    leave();
    const next = ordered[Math.min(Math.max(index + delta, 0), ordered.length - 1)];
    if (next) select(next.id);
  }
  function advance() {
    if (phase?.kind !== "stamped" || !entry) return;
    focusNextContext.current = true;
    const nextApplied = leave();
    const at = ordered.findIndex((candidate) => candidate.id === entry.id);
    const next = [...ordered.slice(at + 1), ...ordered.slice(0, at)].find((candidate) => !nextApplied[candidate.id]);
    if (next) select(next.id);
  }

  const row = entry ? tally.get(entry.id) : undefined;
  const canReveal = canOperate && stage !== "FINAL" && !!entry && !applied[entry.id] && !!row && row.total >= quorum;

  async function reveal() {
    if (!canReveal || phase || !entry || applyingRef.current || applyFailure?.kind === "unknown") return;
    const target = entry;
    setError("");
    setApplyFailure(null);
    applyingRef.current = true;
    setPhase({ kind: "drumroll" });
    const reducedMotion = !motionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) await wait(1200);
    // Unsure is the room's answer when it out-votes both Yes and No: nothing is applied,
    // the card gets a yellow stamp and a revisit flag, and the vote stays open.
    if (row && row.unsure >= row.yes && row.unsure >= row.no) {
      setPhase({ kind: "stamped", status: "UNSURE" });
      toggleRevisit(true);
      applyingRef.current = false;
      return;
    }
    const unknown = () => {
      setPhase(null);
      setApplyFailure({ kind: "unknown", message: "We could not confirm whether the result was applied. It may already be saved. Check the saved result in Hash, then reload saved results before applying again. This card has not advanced." });
    };
    try {
      const { response, body } = await fetchJsonWithTimeout(RUSH_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPLY_STAGE_HASH", cycleId, applicationId: target.id }),
      }, APPLY_TIMEOUT_MS, authorizedFetch);
      if (!response.ok) {
        if (response.status >= 500 || response.status === 408) { unknown(); return; }
        const detail = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The request was refused.";
        setPhase(null);
        setApplyFailure({ kind: "rejected", message: `${detail} The result was not confirmed and this card has not advanced. Correct the issue, then retry applying this applicant’s result.` });
        return;
      }
      const status = body && typeof body === "object" && "id" in body ? body.id : null;
      if (status !== "REJECTED" && status !== HASH_STAGE_RULES[stage].pass) { unknown(); return; }
      setPhase({ kind: "stamped", status });
      if (status !== "REJECTED" && !reducedMotion) { setConfetti(makeConfetti()); window.setTimeout(() => setConfetti(null), 2500); }
    } catch { unknown(); }
    finally { applyingRef.current = false; }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      const arrow = event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (target instanceof Element && target.closest(arrow ? OWNS_ARROWS : OWNS_KEYS)) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "Enter") { event.preventDefault(); if (phase?.kind === "stamped") advance(); else void reveal(); }
      if (event.key.toLowerCase() === "u") { event.preventDefault(); toggleRevisit(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const matches = query.trim() ? ordered.filter((candidate) => matchesApplicantName(candidate.name, query)).slice(0, 8) : [];
  function jump(id: string) {
    if (phase?.kind === "drumroll") return;
    leave();
    if (id === entry?.id) headingRef.current?.focus();
    else focusNextContext.current = true;
    select(id);
    setQuery("");
    searchRef.current?.blur();
  }

  if (!entry) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mecg-navy p-6 text-white/70">
        <p>No applicants to discuss yet.</p>
        <Link href={withWorkspaceCycle("/admin/hash", cycleId)} className="inline-flex min-h-11 items-center text-sm text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">Back to Hash</Link>
      </main>
    );
  }

  const stageHash = entry.finalScore === null && entry.rounds.length === 0;
  const groupCase = entry.groupCase;
  const speedDating = entry.speedDating;
  const outcome = applied[entry.id];
  const flagged = revisit.has(entry.id);
  const phonesShowName = entries.find((candidate) => candidate.id === phonesShowId)?.name;
  const stampStatus = phase && phase.kind !== "drumroll" ? phase.status : null;
  const allApplied = ordered.length > 0 && ordered.every((candidate) => Boolean(applied[candidate.id]));
  const cardMotion = phase?.kind === "drumroll" ? "deck-drumroll" : "";

  return (
    <main data-motion={motionEnabled ? "on" : "off"} className={`deck-root flex min-h-screen flex-col bg-mecg-navy p-6 text-white sm:p-10 ${phase?.kind === "stamped" ? "deck-screen-shake" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p className="text-[13px] font-semibold text-white/70">Discussion mode</p>
          <p role="status" className="live-sync-status" data-dark>
            {liveSyncNotice(sync) === "reconnecting" && "Reconnecting…"}
            {liveSyncNotice(sync) === "session-ended" && <>Your session ended. <button type="button" onClick={() => window.location.reload()} className="min-h-11 underline underline-offset-2 hover:text-white">Reload</button> to keep the live tally.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={sort === "score"} onClick={() => setSort("score")} className={SORT_BUTTON}>By score</button>
          <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")} className={SORT_BUTTON}>A to Z</button>
          <button type="button" aria-pressed={onlyRevisits && revisitCount > 0} disabled={revisitCount === 0} onClick={() => setOnlyRevisits((current) => !current)} className={`${SORT_BUTTON} disabled:opacity-30`}>Revisits ({revisitCount})</button>
          <Link href={withWorkspaceCycle("/admin/hash", cycleId)} className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white">Exit</Link>
        </div>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      {canOperate && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" aria-pressed={presentingHere} aria-describedby="deck-present-help" onClick={togglePresenting} className={`${SORT_BUTTON} deck-present min-h-11`}>
            Present to members
          </button>
          <p id="deck-present-help" className="text-sm text-white/70" role="status">
            {presentingHere ? "On for this browser tab. Members' phones follow the card shown here." : `Off for this browser tab. Browsing here does not move members' phones.${phonesShowName ? ` Members' phones show ${phonesShowName}.` : ""}`}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" aria-pressed={motionEnabled} aria-describedby="deck-motion-help" disabled={systemReducedMotion !== false} onClick={togglePresentationMotion} className={`${SORT_BUTTON} min-h-11 disabled:opacity-60`}>
          Presentation motion
        </button>
        <p id="deck-motion-help" className="text-sm text-white/70" role="status">
          {systemReducedMotion === null ? "Off while checking your device motion preference." : systemReducedMotion ? "Off — your device requests reduced motion." : motionEnabled ? "On for this browser tab. Turn off for a still shared display." : "Off for this browser tab. Results appear without a reveal delay."}
        </p>
      </div>
      </div>
      <div className="relative mt-4 self-center w-full max-w-sm">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); jump(matches[0].id); } if (event.key === "Escape") setQuery(""); }}
          placeholder="Jump to a name"
          aria-label="Jump to a name"
          className="min-h-11 w-full rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 inset-ring inset-ring-white/15 focus:outline-none focus:inset-ring-white/40"
        />
        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl bg-public-ink inset-ring inset-ring-white/15">
            {matches.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => jump(candidate.id)} className="min-h-11 w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 hover:text-white">{candidate.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {index + 1} of {ordered.length}: {entry.name}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {phase?.kind === "drumroll" ? "Applying room result…" : phase?.kind === "stamped" ? `Room result: ${phase.status === "UNSURE" ? "Unsure. No result applied; flagged to revisit." : applicationStatusLabel(phase.status)}` : ""}
      </p>
      <div className="flex flex-1 items-center justify-center py-6">
        <div
          key={entry.id}
          data-enter={entrance(entry.id)}
          className={`deck-card relative flex w-full max-w-4xl flex-col items-center gap-6 rounded-xl bg-white/[0.04] p-5 text-center inset-ring inset-ring-white/10 sm:gap-8 sm:p-12 ${cardMotion}`}
        >
          <div className="flex w-full items-center gap-4 text-left sm:flex-col sm:gap-8 sm:text-center">
          {failedHeadshots.has(entry.id) ? (
            <span className="deck-headshot-pop flex size-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white/70 sm:size-56 sm:text-6xl" aria-hidden="true">{initials(entry.name)}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
            <img
              ref={(image) => {
                // A cached/fast image failure can precede hydration and its onError handler.
                if (image?.complete && image.naturalWidth === 0) setFailedHeadshots((current) => new Set(current).add(entry.id));
              }}
              src={`/api/admin/applications/${encodeURIComponent(entry.id)}/headshot`}
              alt=""
              className="deck-headshot-pop size-16 shrink-0 rounded-full object-cover sm:size-56"
              onError={() => setFailedHeadshots((current) => new Set(current).add(entry.id))}
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 sm:justify-center">
              <h1 ref={headingRef} tabIndex={-1} data-deck-context className="deck-name break-words text-2xl sm:text-6xl">{entry.name}</h1>
              {outcome && <span className="rounded-full bg-white/[0.12] px-3 py-1 text-sm font-semibold">{applicationStatusLabel(outcome)}</span>}
              {flagged && <span className="rounded-full bg-amber-300/20 px-3 py-1 text-sm font-semibold text-amber-200">Revisit</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-white sm:mt-3 sm:text-2xl">{[entry.classYear, entry.major].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-[13px] font-semibold text-white/70">{[entry.groupName, applicationStatusLabel(entry.status)].filter(Boolean).join(" · ")}</p>
          </div>
          </div>
          {/* Participation only. Which way the room is leaning stays off the wall until the stamp lands. */}
          <div className={`${PANEL} relative w-full`}>
            <p className="text-[13px] font-semibold text-white/70">Room vote</p>
            {outcome ? (
              <p className={`mt-1 text-4xl font-bold ${outcome === "REJECTED" ? "text-rose-300" : "text-emerald-300"}`}>{applicationStatusLabel(outcome)}</p>
            ) : (
              <>
                <p className="tabular mt-1 text-4xl font-bold">{row?.total ?? 0}<span className="ml-2 text-base font-normal text-white/70">of {quorum} voted</span></p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min((row?.total ?? 0) / Math.max(quorum, 1), 1) * 100}%`, transition: "width 600ms" }} />
                </div>
              </>
            )}
            {canReveal && <button type="button" disabled={!!phase || applyFailure?.kind === "unknown"} aria-describedby="deck-apply-error" onClick={() => void reveal()} className="mt-3 min-h-11 rounded-sm px-4 py-2 text-sm font-semibold text-mecg-orange ring-1 ring-white/30 disabled:opacity-50">{phase?.kind === "drumroll" ? "Applying result…" : "Reveal and apply result"}</button>}
            <div id="deck-apply-error" ref={applyErrorRef} tabIndex={-1} role="alert" aria-atomic="true" className={applyFailure ? "mt-4 text-left text-sm leading-6 text-rose-200" : ""}>
              {applyFailure && <><p>{applyFailure.message}</p><div className="mt-3 flex flex-wrap gap-3">
                {applyFailure.kind === "rejected" ? <button type="button" onClick={() => void reveal()} className="min-h-11 rounded-sm px-4 py-2 font-semibold text-white ring-1 ring-white/30">Retry applying result</button> : <>
                  <Link href={withWorkspaceCycle("/admin/hash", cycleId)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Check saved result in Hash (new tab)</Link>
                  <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-sm px-4 py-2 font-semibold text-white ring-1 ring-white/30">Reload saved results</button>
                </>}
              </div></>}
            </div>
            {phase?.kind === "stamped" && <button ref={advanceButtonRef} type="button" onClick={advance} className="mt-3 min-h-11 rounded-sm px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30">Next unapplied applicant</button>}
            {phase?.kind === "drumroll" && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-public-ink text-6xl font-bold" aria-hidden="true">…</div>}
          </div>
          {!stageHash && (
            <>
              <p className="tabular text-7xl font-bold sm:text-8xl">
                {entry.finalScore === null ? <span className="text-3xl font-normal text-white/70">Pending</span> : entry.finalScore.toFixed(1)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {entry.rounds.map((round) => (
                  <span key={round.name} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white inset-ring inset-ring-white/10">
                    <span className="text-white/70">{round.name}</span>{" "}
                    <span className="tabular font-semibold">{round.score === null ? (round.status === "PENDING" ? "Pending" : "—") : round.score.toFixed(1)}</span>
                    <span className="ml-2 text-xs text-white/70">{round.count} ratings{round.spread != null ? ` · spread ${round.spread.toFixed(0)}` : ""}{round.status === "REVIEW" ? " · review" : ""}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <div className={PANEL}>
              <p className="text-[13px] font-semibold text-white/70">Group Case</p>
              {groupCase?.mean != null ? (
                <>
                  <p className="tabular mt-1 text-6xl font-bold">{groupCase.mean.toFixed(1)}<span className="ml-1 text-base font-normal text-white/70">/ 40</span></p>
                  <p className="mt-1 text-lg font-semibold">{groupCase.band}</p>
                  <p className="text-sm text-white/70">{graders(groupCase.count)}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    {groupCase.criteria.map((criterion) => (
                      <div key={criterion.name} title={criterion.name} className="rounded-lg bg-white/10 px-2 py-1.5">
                        <p className="truncate text-white/70">{criterion.name.split(/\s+/)[0]}</p>
                        <p className="tabular font-semibold">{criterion.mean == null ? "—" : criterion.mean.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="mt-3 text-2xl text-white/70">Not graded</p>}
            </div>
            <div className={PANEL}>
              <p className="text-[13px] font-semibold text-white/70">Speed Dating</p>
              {speedDating && speedDating.count > 0 ? (
                <>
                  <p className="tabular mt-1 text-6xl font-bold">{speedDating.adjusted == null ? formatStars(null) : formatStars(speedDating.adjusted)}</p>
                  <p className="mt-1 text-sm text-white/70">raw {speedDating.mean == null ? "—" : speedDating.mean.toFixed(1)} · {graders(speedDating.count)}</p>
                </>
              ) : <p className="mt-3 text-2xl text-white/70">Not graded</p>}
            </div>
          </div>
          <div className="grid w-full gap-6 sm:grid-cols-2">
            <NotesList title="Group Case notes" notes={groupCase?.notes ?? []} />
            <NotesList title="Speed Dating notes" notes={speedDating?.notes ?? []} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[13px] font-semibold text-white/70">Event observations</p>
            {entry.impressions ? (
              <>
                <p className="text-sm text-white/70">{entry.impressions.count} observation{entry.impressions.count === 1 ? "" : "s"}</p>
                {entry.impressions.topTags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {entry.impressions.topTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 inset-ring inset-ring-white/10">{tag}</span>
                    ))}
                  </div>
                )}
                {entry.impressions.notes.length > 0 && (
                  <ul className="mt-2 max-w-xl space-y-1 text-sm leading-6 text-white/70">
                    {entry.impressions.notes.slice(0, 5).map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>{note}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-white/70">None recorded</p>
            )}
          </div>
          {entry.decision && (
            <span className="rounded-full bg-mecg-orange px-4 py-1.5 text-[13px] font-semibold text-mecg-navy">
              {decisionOutcomeLabel(entry.decision.outcome)} · {decisionStatusLabel(entry.decision.status)}
            </span>
          )}
          {stampStatus && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className={`deck-stamp rounded-xl border-8 bg-mecg-navy/60 px-10 py-4 text-6xl font-black uppercase tracking-[0.2em] sm:text-8xl ${stampStatus === "REJECTED" ? "text-rose-300 border-rose-300" : stampStatus === "UNSURE" ? "text-amber-300 border-warning-edge" : "text-emerald-300 border-emerald-300"}`}>
                {stampStatus === "UNSURE" ? "UNSURE" : applicationStatusLabel(stampStatus).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
      {confetti && motionEnabled && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
          {confetti.map((piece, pieceIndex) => (
            <span key={pieceIndex} className="deck-confetti absolute top-0 size-3 rounded-sm" style={{ "--x": piece.x, "--delay": piece.delay, "--hue": piece.hue } as CSSProperties} />
          ))}
        </div>
      )}
      {allApplied && <p role="status" className="mb-4 text-center text-sm text-white/70">Applied results are shown for every applicant in this view. Return to Hash to check stage readiness.</p>}
      <footer className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
        <button type="button" onClick={() => step(-1)} disabled={index <= 0 || phase?.kind === "drumroll"} className="min-h-11 min-w-11 rounded-sm px-4 py-2 text-sm text-white/70 inset-ring inset-ring-white/20 hover:text-white disabled:opacity-30">Previous</button>
        <div className="order-first w-full text-center sm:order-none sm:w-auto">
          <p className="tabular text-sm font-semibold text-white/70">{index + 1} of {ordered.length}</p>
          <p role="alert" aria-atomic="true" className="mt-1 text-sm text-rose-300">{error || presentError}</p>
        </div>
        <button type="button" aria-pressed={flagged} onClick={() => toggleRevisit()} disabled={phase?.kind === "drumroll"} className={`${SORT_BUTTON} px-4 py-2 text-sm font-normal disabled:opacity-30`}>Revisit (U)</button>
        <button type="button" onClick={() => step(1)} disabled={index >= ordered.length - 1 || phase?.kind === "drumroll"} className="min-h-11 min-w-11 rounded-sm px-4 py-2 text-sm text-white/70 inset-ring inset-ring-white/20 hover:text-white disabled:opacity-30">Next</button>
      </footer>
    </main>
  );
}
