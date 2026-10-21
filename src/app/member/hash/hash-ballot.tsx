"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import { initials } from "@/lib/initials";
import { matchesApplicantName } from "@/lib/speed-dating-roster";
import { LIVE_SYNC_START, liveSyncNotice, nextLiveSync, pollOutcome, type PollOutcome } from "@/lib/live-sync";
import TallyStrip from "@/components/tally-strip";
import { ballotList, shouldScrollToPresenting, unvotedIds } from "./ballot-list";

const NOTE_DEBOUNCE_MS = 800;
const NOTE_LIMIT = 1000;
const LIVE_POLL_MS = 3000;
type Vote = "YES" | "NO" | "UNSURE" | "";
const CHOICES: { value: Exclude<Vote, "">; label: string; key: string; glyph: string }[] = [
  { value: "YES", label: "Yes", key: "y", glyph: "M5 12.5 10 17l9-10" },
  { value: "UNSURE", label: "Unsure", key: "u", glyph: "M9 9a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8v.5 M12 17.5v.01" },
  { value: "NO", label: "No", key: "n", glyph: "M6 6l12 12 M18 6 6 18" },
];
const NOTE_SOURCES: { source: string; label: string }[] = [
  { source: "SPEED_DATING", label: "Speed Dating" },
  { source: "GROUP_CASE", label: "Group Case" },
];
type Row = { vote: Vote; note: string };
type RowStatus = { kind: "saving" | "saved" | "error" | "hint"; message?: string };
type Note = { source: string; note: string };
type Presenting = { id: string; name: string; meta: string; decided: string | null };
type Live = { presentingId: string | null; presenting: Presenting | null; notes: Note[] };
type PendingNote = { timer: number; vote: Exclude<Vote, "">; note: string };
export type BallotApplicant = { id: string; name: string; meta: string };
export type BallotVote = { application_id: string; vote: string; note: string | null };

function grow(node: HTMLTextAreaElement | null) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

async function fetchLive(cycleId?: string, applicationId?: string): Promise<{ outcome: PollOutcome; live: Live | null }> {
  try {
    const params = new URLSearchParams();
    if (cycleId) params.set("cycleId", cycleId);
    if (applicationId) params.set("applicationId", applicationId);
    const query = params.size ? `?${params.toString()}` : "";
    const response = await authorizedFetch(`/api/member/hash/live${query}`, { cache: "no-store" });
    const outcome = pollOutcome(response.status);
    if (outcome !== "ok") return { outcome, live: null };
    const body: Partial<Live> | null = await response.json().catch(() => null);
    if (!body) return { outcome: "failed", live: null };
    return { outcome, live: { presentingId: body.presentingId ?? null, presenting: body.presenting ?? null, notes: Array.isArray(body.notes) ? body.notes : [] } };
  } catch {
    // Stale is fine on a phone; the next tick tries again.
    return { outcome: "failed", live: null };
  }
}

// Grader notes grouped by round. `notes` is undefined while a lazy fetch is in flight.
function ApplicantNotes({ notes, dark }: { notes: Note[] | undefined; dark?: boolean }) {
  const heading = dark ? "text-white/70" : "text-muted";
  const body = dark ? "text-white/70" : "text-mecg-navy";
  if (!notes) return <p className={`text-sm ${heading}`}>Loading notes…</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {NOTE_SOURCES.map(({ source, label }) => {
        const matching = notes.filter((note) => note.source === source);
        return (
          <div key={source} className="min-w-0">
            <p className={`text-[13px] font-semibold ${heading}`}>{label}</p>
            {matching.length ? (
              <ul className={`mt-1 space-y-1 text-sm leading-6 ${body}`}>
                {matching.map((note, noteIndex) => <li key={`${noteIndex}-${note.note}`}>&ldquo;{note.note}&rdquo;</li>)}
              </ul>
            ) : <p className={`mt-1 text-sm ${heading}`}>No notes yet</p>}
          </div>
        );
      })}
    </div>
  );
}

function isTyping(element: Element | null) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || (element instanceof HTMLElement && element.isContentEditable);
}

function BallotRow({ id, name, meta, row, rowStatus, stamped, dark, rowRef, onCast, onEditNote, onFlushNote }: {
  id: string;
  stamped: number;
  name: string;
  meta: string;
  row: Row;
  rowStatus: RowStatus | undefined;
  dark?: boolean;
  rowRef?: Ref<HTMLDivElement>;
  onCast: (applicationId: string, vote: Exclude<Vote, "">) => void;
  onEditNote: (applicationId: string, note: string) => void;
  onFlushNote: (applicationId: string) => void;
}) {
  function shortcut(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const choice = CHOICES.find((option) => option.key === event.key.toLowerCase());
    if (!choice) return;
    event.preventDefault();
    onCast(id, choice.value);
  }
  return (
    <div ref={rowRef} tabIndex={rowRef ? -1 : undefined} className="ballot-row relative flex flex-wrap items-start gap-x-4 gap-y-2" data-dark={dark || undefined} onKeyDown={shortcut}>
      {row.vote && <span key={`${row.vote}-${stamped}`} className="ballot-stamp" data-vote={row.vote} data-fresh={stamped > 0 || undefined} aria-hidden="true">{CHOICES.find((choice) => choice.value === row.vote)?.label}</span>}
      <div className="min-w-0 flex-1 basis-40 pr-28">
        <p className={`font-semibold ${dark ? "text-white" : "text-mecg-navy"}`}>{name}</p>
        {meta && <p className={`text-xs ${dark ? "text-white/70" : "text-muted"}`}>{meta}</p>}
        <p className={`mt-0.5 min-h-4 text-xs ${dark ? "text-white/70" : "text-muted"}`} aria-live="polite">
          {rowStatus?.kind === "saving" && "Saving…"}
          {rowStatus?.kind === "saved" && "Saved"}
          {rowStatus?.kind === "hint" && rowStatus.message}
          {rowStatus?.kind === "error" && <span className={`font-semibold ${dark ? "text-red-300" : "text-danger"}`}>{rowStatus.message}</span>}
          {!rowStatus && row.vote && "Saved"}
        </p>
      </div>
      <div role="group" aria-label={`Your vote on ${name}`} className="ballot-choices">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={row.vote === choice.value}
            aria-keyshortcuts={choice.key.toUpperCase()}
            data-choice={choice.value}
            onClick={() => onCast(id, choice.value)}
            className="ballot-choice"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={choice.glyph} /></svg>
            {choice.label}
            <kbd aria-hidden="true">{choice.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <textarea
        rows={1}
        value={row.note}
        maxLength={NOTE_LIMIT}
        placeholder="Note for the board (optional)"
        aria-label={`Note for ${name}`}
        ref={grow}
        onInput={(event) => grow(event.currentTarget)}
        onChange={(event) => onEditNote(id, event.target.value)}
        onBlur={() => onFlushNote(id)}
        className={`min-h-11 w-full basis-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none ${
          dark
            ? "bg-white/10 text-white placeholder:text-white/40 inset-ring inset-ring-white/20 focus:inset-ring-2 focus:inset-ring-white/40"
            : "bg-wash text-mecg-navy inset-ring inset-ring-line-strong focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
        }`}
      />
    </div>
  );
}

export default function HashBallot({ applicants, votes, presentingId, cycleId }: { cycleId?: string; applicants: BallotApplicant[]; votes: BallotVote[]; presentingId: string | null }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const mine = new Map(votes.map((vote) => [vote.application_id, vote]));
    return Object.fromEntries(applicants.map(({ id }) => {
      const existing = mine.get(id);
      return [id, { vote: (existing?.vote ?? "") as Vote, note: existing?.note ?? "" }];
    }));
  });
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  // Counts votes cast in this visit, so a stamp animates when pressed, not on every load.
  const [stamped, setStamped] = useState<Record<string, number>>({});
  const [live, setLive] = useState<Live>({ presentingId, presenting: null, notes: [] });
  const [notesById, setNotesById] = useState<Record<string, Note[]>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  // Applicants that were unvoted when the filter went on; null shows everyone.
  const [unvotedSnapshot, setUnvotedSnapshot] = useState<Set<string> | null>(null);
  const [sync, setSync] = useState(LIVE_SYNC_START);
  // A list row the member was inside when the board presented that applicant.
  const [keepId, setKeepId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const presentingCardRef = useRef<HTMLDivElement>(null);
  const presentingRowRef = useRef<HTMLDivElement>(null);
  // Last server-confirmed values, so a failed save can put the vote back without losing typed text.
  const saved = useRef<Record<string, Row>>({ ...rows });
  const pending = useRef<Record<string, PendingNote>>({});
  const sequence = useRef<Record<string, number>>({});
  const lastPresented = useRef(presentingId);
  const seenPresenting = useRef(presentingId);
  // Read when the poll sees a new presenter, before the re-render can unmount the focused field.
  const typingAtSwitch = useRef(false);

  const voted = Object.values(rows).filter((row) => row.vote).length;
  const unvotedNow = useMemo(() => unvotedIds(rows), [rows]);
  // On the ballot: the member's own row pins to the top. Already stamped by the
  // board: the phone still shows who is on the wall, with no buttons to tap.
  const onBallot = applicants.find((applicant) => applicant.id === live.presentingId);
  const presenting = onBallot ?? (live.presenting && live.presenting.id === live.presentingId ? live.presenting : undefined);
  const visible = useMemo(() => ballotList(applicants, { query, pinnedId: onBallot?.id ?? null, keepId, unvotedSnapshot, unvotedNow }), [applicants, query, onBallot?.id, keepId, unvotedSnapshot, unvotedNow]);
  const notice = liveSyncNotice(sync);
  const pinnedMatches = !!onBallot && !!query.trim() && matchesApplicantName(onBallot.name, query);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) inputRef.current?.focus();
    function focusSearch(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  // A note still waiting on its debounce is sent when the page goes away, not dropped.
  const flushRef = useRef<(applicationId: string) => void>(() => {});
  const flushAllRef = useRef(() => {});
  useEffect(() => {
    flushRef.current = (applicationId) => flushNote(applicationId);
    flushAllRef.current = () => Object.keys(pending.current).forEach((applicationId) => flushNote(applicationId, true));
  });
  useEffect(() => {
    const flushAll = () => flushAllRef.current();
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, []);

  // Follow the projector: poll while the tab is in front, skip ticks in the background.
  useEffect(() => {
    let active = true;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      const { outcome, live: next } = await fetchLive(cycleId);
      if (!active) return;
      setSync((current) => nextLiveSync(current, outcome));
      if (!next) return;
      if (next.presentingId !== seenPresenting.current) {
        seenPresenting.current = next.presentingId;
        const focused = document.activeElement;
        typingAtSwitch.current = isTyping(focused);
        const row = focused instanceof HTMLElement ? focused.closest<HTMLElement>("[data-ballot-row]")?.dataset.ballotRow : undefined;
        setKeepId(row && row === next.presentingId ? row : null);
      }
      setLive(next);
    }
    void tick();
    const interval = window.setInterval(tick, LIVE_POLL_MS);
    return () => { active = false; window.clearInterval(interval); };
  }, [cycleId]);

  useEffect(() => {
    const previous = lastPresented.current;
    if (live.presentingId === previous) return;
    lastPresented.current = live.presentingId;
    // The card's note now belongs to someone else; send what was typed for the last applicant to them.
    if (previous) flushRef.current(previous);
    // Someone mid-note or mid-search keeps their place; the card still updates above.
    if (!live.presentingId || typingAtSwitch.current) return;
    presentingRowRef.current?.focus({ preventScroll: true });
    const card = presentingCardRef.current;
    if (!card || !shouldScrollToPresenting(card.getBoundingClientRect(), window.innerHeight, window.scrollY)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [live.presentingId]);

  function patchRow(applicationId: string, patch: Partial<Row>) {
    setRows((current) => ({ ...current, [applicationId]: { ...current[applicationId], ...patch } }));
  }

  function setRowStatus(applicationId: string, next: RowStatus) {
    setStatus((current) => ({ ...current, [applicationId]: next }));
  }

  async function save(applicationId: string, vote: Exclude<Vote, "">, note: string, keepalive = false) {
    const ticket = (sequence.current[applicationId] ?? 0) + 1;
    sequence.current[applicationId] = ticket;
    setRowStatus(applicationId, { kind: "saving" });
    try {
      // cast_hash_vote upserts per voter and applicant, so resending after a
      // dropped connection is safe. stillWanted drops a retry once a newer tap
      // for the same applicant has taken over, so an old vote cannot land last.
      const response = await retryOnNetworkError(() => authorizedFetch("/api/member/hash-votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId, vote, note }),
        keepalive,
      }), { stillWanted: () => sequence.current[applicationId] === ticket });
      const body: { ok?: boolean; error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not save this vote");
      if (sequence.current[applicationId] !== ticket) return;
      saved.current[applicationId] = { vote, note };
      // A note save carries the vote from when typing started, which a failed
      // tap may since have reverted on screen. Show what the server now holds.
      patchRow(applicationId, { vote });
      setRowStatus(applicationId, { kind: "saved" });
    } catch (saveError) {
      if (sequence.current[applicationId] !== ticket) return;
      patchRow(applicationId, { vote: saved.current[applicationId].vote });
      const message = saveError instanceof Error && !(saveError instanceof TypeError)
        ? saveError.message
        : "No connection. Check wifi and tap again.";
      setRowStatus(applicationId, { kind: "error", message });
    }
  }

  function cancelTimer(applicationId: string) {
    window.clearTimeout(pending.current[applicationId]?.timer);
    delete pending.current[applicationId];
  }

  function cast(applicationId: string, vote: Exclude<Vote, "">) {
    if (rows[applicationId].vote === vote) return;
    cancelTimer(applicationId);
    patchRow(applicationId, { vote });
    setStamped((current) => ({ ...current, [applicationId]: (current[applicationId] ?? 0) + 1 }));
    void save(applicationId, vote, rows[applicationId].note);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const vote = rows[applicationId].vote;
    // The API stores a note only alongside a vote; the draft stays here and goes with the first tap.
    if (!vote) { setRowStatus(applicationId, { kind: "hint", message: "Note saves with your vote. Pick Yes, Unsure or No." }); return; }
    const timer = window.setTimeout(() => {
      delete pending.current[applicationId];
      void save(applicationId, vote, note);
    }, NOTE_DEBOUNCE_MS);
    pending.current[applicationId] = { timer, vote, note };
  }

  function flushNote(applicationId: string, keepalive = false) {
    const waiting = pending.current[applicationId];
    if (!waiting) return;
    cancelTimer(applicationId);
    void save(applicationId, waiting.vote, waiting.note, keepalive);
  }

  function toggleNotes(applicationId: string) {
    const opening = !openNotes[applicationId];
    setOpenNotes((current) => ({ ...current, [applicationId]: opening }));
    if (!opening || notesById[applicationId]) return;
    void fetchLive(cycleId, applicationId).then(({ live: result }) => {
      if (result) setNotesById((current) => ({ ...current, [applicationId]: result.notes }));
    });
  }

  if (!applicants.length) {
    return (
      <p className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-sm text-muted">
        No applicants are up for a vote right now. Anyone you have declared a conflict on stays off this list.
      </p>
    );
  }

  return (
    <section className="grading-workspace rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-7">
      <TallyStrip caption={`Voted ${voted} of ${applicants.length}`} items={applicants.map(({ id }) => ({ id, state: rows[id].vote || "empty" }))} />
      <p role="status" className="live-sync-status">
        {notice === "reconnecting" && "Reconnecting…"}
        {notice === "session-ended" && <>Your session ended. Reload to keep voting. <button type="button" onClick={() => window.location.reload()} className="min-h-11 font-semibold text-mecg-blue underline underline-offset-2">Reload</button></>}
      </p>
      {voted === applicants.length && <p className="ballot-complete">Ballot complete. You can change any vote until the board applies the result.</p>}

      {presenting && (
        <div ref={presentingCardRef} className="mt-4 scroll-mt-4 rounded-xl bg-mecg-navy p-5 text-white" aria-label="Now presenting">
          <div className="flex items-center gap-4">
            {failedHeadshots.has(presenting.id) ? (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white/70" aria-hidden="true">{initials(presenting.name)}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
              <img
                src={`/api/admin/applications/${encodeURIComponent(presenting.id)}/headshot`}
                alt=""
                className="size-20 shrink-0 rounded-full object-cover"
                onError={() => setFailedHeadshots((current) => new Set(current).add(presenting.id))}
              />
            )}
            <p className="text-[13px] font-semibold text-white/70">Now presenting</p>
          </div>
          <div className="mt-4">
            {onBallot ? (
              <BallotRow key={presenting.id} id={presenting.id} name={presenting.name} meta={presenting.meta} row={rows[presenting.id]} rowStatus={status[presenting.id]} stamped={stamped[presenting.id] ?? 0} dark rowRef={presentingRowRef} onCast={cast} onEditNote={editNote} onFlushNote={flushNote} />
            ) : (
              <div>
                <p className="font-semibold text-white">{presenting.name}</p>
                {presenting.meta && <p className="text-xs text-white/70">{presenting.meta}</p>}
                <p className="mt-2 inline-block rounded-full bg-mecg-orange px-3 py-1 text-[13px] font-semibold text-mecg-navy">{"decided" in presenting && presenting.decided ? `Board decided: ${presenting.decided}` : "Not on your ballot"}</p>
              </div>
            )}
          </div>
          <div className="mt-5">
            <ApplicantNotes notes={live.notes} dark />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-60">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name"
          aria-label="Search applicants"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-line bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>
        <button
          type="button"
          aria-pressed={!!unvotedSnapshot}
          disabled={!unvotedSnapshot && voted === applicants.length}
          onClick={() => setUnvotedSnapshot((current) => current ? null : unvotedIds(rows))}
          className="ballot-filter"
        >
          Unvoted ({applicants.length - voted})
        </button>
      </div>

      <ul className="mt-5 divide-y divide-line">
        {visible.length === 0 && (pinnedMatches || query.trim() || unvotedSnapshot) && (
          <li className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
            {pinnedMatches ? (
              <p className="font-semibold text-mecg-navy">{onBallot.name} is in Now presenting above.</p>
            ) : query.trim() ? (
              <>
                <p className="font-semibold text-mecg-navy">No applicant matches “{query.trim()}”</p>
                <p className="mt-1 text-sm text-muted">{unvotedSnapshot ? "Check the spelling, try their other name, or turn off Unvoted." : "Check the spelling or try their other name."}</p>
              </>
            ) : (
              <p className="font-semibold text-mecg-navy">Nothing else is waiting on your vote.</p>
            )}
          </li>
        )}
        {visible.map(({ id, name, meta }) => (
          <li key={id} data-ballot-row={id} className={`py-3 ${rows[id].vote ? "bg-wash" : ""} -mx-2 rounded-xl px-2`}>
            <BallotRow id={id} name={name} meta={meta} row={rows[id]} rowStatus={status[id]} stamped={stamped[id] ?? 0} onCast={cast} onEditNote={editNote} onFlushNote={flushNote} />
            <button
              type="button"
              aria-expanded={!!openNotes[id]}
              onClick={() => toggleNotes(id)}
              className="mt-1 min-h-11 px-1 text-sm font-semibold text-mecg-blue"
            >
              {openNotes[id] ? "Hide notes" : "Notes"}
            </button>
            {openNotes[id] && (
              <div className="pb-2">
                <ApplicantNotes notes={notesById[id]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
