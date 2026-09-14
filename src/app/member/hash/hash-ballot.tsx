"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import { initials } from "@/lib/initials";
import { matchesApplicantName } from "@/lib/speed-dating-roster";

const NOTE_DEBOUNCE_MS = 800;
const NOTE_LIMIT = 1000;
const LIVE_POLL_MS = 3000;
type Vote = "YES" | "NO" | "UNSURE" | "";
const CHOICES: { value: Exclude<Vote, "">; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "UNSURE", label: "Unsure" },
  { value: "NO", label: "No" },
];
const NOTE_SOURCES: { source: string; label: string }[] = [
  { source: "SPEED_DATING", label: "Speed Dating" },
  { source: "GROUP_CASE", label: "Group Case" },
];
type Row = { vote: Vote; note: string };
type RowStatus = { kind: "saving" | "saved" | "error" | "hint"; message?: string };
type Note = { source: string; note: string };
type Live = { presentingId: string | null; notes: Note[] };
export type BallotApplicant = { id: string; name: string };
export type BallotVote = { application_id: string; vote: string; note: string | null };

function grow(node: HTMLTextAreaElement | null) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

async function fetchLive(applicationId?: string): Promise<Live | null> {
  try {
    const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
    const response = await authorizedFetch(`/api/member/hash/live${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    const body: Partial<Live> | null = await response.json().catch(() => null);
    if (!body) return null;
    return { presentingId: body.presentingId ?? null, notes: Array.isArray(body.notes) ? body.notes : [] };
  } catch {
    // Stale is fine on a phone; the next tick tries again.
    return null;
  }
}

// Grader notes grouped by round. `notes` is undefined while a lazy fetch is in flight.
function ApplicantNotes({ notes, dark }: { notes: Note[] | undefined; dark?: boolean }) {
  const heading = dark ? "text-white/50" : "text-mecg-navy/55";
  const body = dark ? "text-white/75" : "text-mecg-navy/80";
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

function BallotRow({ id, name, row, rowStatus, dark, onCast, onEditNote, onFlushNote }: {
  id: string;
  name: string;
  row: Row;
  rowStatus: RowStatus | undefined;
  dark?: boolean;
  onCast: (applicationId: string, vote: Exclude<Vote, "">) => void;
  onEditNote: (applicationId: string, note: string) => void;
  onFlushNote: (applicationId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-40">
        <p className={`font-semibold ${dark ? "text-white" : "text-mecg-navy"}`}>{name}</p>
        <p className={`mt-0.5 min-h-4 text-xs ${dark ? "text-white/60" : "text-mecg-navy/55"}`} aria-live="polite">
          {rowStatus?.kind === "saving" && "Saving…"}
          {rowStatus?.kind === "saved" && "Saved"}
          {rowStatus?.kind === "hint" && rowStatus.message}
          {rowStatus?.kind === "error" && <span className={`font-semibold ${dark ? "text-red-300" : "text-red-700"}`}>{rowStatus.message}</span>}
          {!rowStatus && row.vote && "Saved"}
        </p>
      </div>
      <div role="group" aria-label={`Your vote on ${name}`} className="flex basis-full overflow-hidden rounded-xl">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={row.vote === choice.value}
            onClick={() => onCast(id, choice.value)}
            className={`min-h-11 flex-1 text-sm font-semibold transition-[background-color,color] ${
              row.vote === choice.value
                ? (dark ? "bg-mecg-orange text-mecg-navy" : "bg-mecg-navy text-white")
                : "bg-white text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"
            }`}
          >
            {choice.label}
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
            ? "bg-white/[0.08] text-white placeholder:text-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] focus:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.6)]"
            : "bg-mecg-navy/[0.035] text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
        }`}
      />
    </div>
  );
}

export default function HashBallot({ applicants, votes, presentingId }: { applicants: BallotApplicant[]; votes: BallotVote[]; presentingId: string | null }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const mine = new Map(votes.map((vote) => [vote.application_id, vote]));
    return Object.fromEntries(applicants.map(({ id }) => {
      const existing = mine.get(id);
      return [id, { vote: (existing?.vote ?? "") as Vote, note: existing?.note ?? "" }];
    }));
  });
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [live, setLive] = useState<Live>({ presentingId, notes: [] });
  const [notesById, setNotesById] = useState<Record<string, Note[]>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  // Last server-confirmed values, so a failed save can put the vote back without losing typed text.
  const saved = useRef<Record<string, Row>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  const sequence = useRef<Record<string, number>>({});
  const lastPresented = useRef(presentingId);

  const visible = useMemo(() => applicants.filter((applicant) => matchesApplicantName(applicant.name, query)), [applicants, query]);
  const voted = Object.values(rows).filter((row) => row.vote).length;
  const presenting = applicants.find((applicant) => applicant.id === live.presentingId);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) inputRef.current?.focus();
    function focusSearch(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    const pending = timers.current;
    return () => {
      window.removeEventListener("keydown", focusSearch);
      Object.values(pending).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Follow the projector: poll while the tab is in front, skip ticks in the background.
  useEffect(() => {
    let active = true;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      const next = await fetchLive();
      if (active && next) setLive(next);
    }
    void tick();
    const interval = window.setInterval(tick, LIVE_POLL_MS);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (live.presentingId === lastPresented.current) return;
    lastPresented.current = live.presentingId;
    if (!live.presentingId) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [live.presentingId]);

  function patchRow(applicationId: string, patch: Partial<Row>) {
    setRows((current) => ({ ...current, [applicationId]: { ...current[applicationId], ...patch } }));
  }

  function setRowStatus(applicationId: string, next: RowStatus) {
    setStatus((current) => ({ ...current, [applicationId]: next }));
  }

  async function save(applicationId: string, vote: Exclude<Vote, "">, note: string) {
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
      }), { stillWanted: () => sequence.current[applicationId] === ticket });
      const body: { ok?: boolean; error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not save this vote");
      if (sequence.current[applicationId] !== ticket) return;
      saved.current[applicationId] = { vote, note };
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
    window.clearTimeout(timers.current[applicationId]);
    delete timers.current[applicationId];
  }

  function cast(applicationId: string, vote: Exclude<Vote, "">) {
    if (rows[applicationId].vote === vote) return;
    cancelTimer(applicationId);
    patchRow(applicationId, { vote });
    void save(applicationId, vote, rows[applicationId].note);
  }

  function editNote(applicationId: string, note: string) {
    patchRow(applicationId, { note });
    cancelTimer(applicationId);
    const vote = rows[applicationId].vote;
    if (!vote) { setRowStatus(applicationId, { kind: "hint", message: "Pick Yes, Unsure or No to save" }); return; }
    timers.current[applicationId] = window.setTimeout(() => {
      delete timers.current[applicationId];
      void save(applicationId, vote, note);
    }, NOTE_DEBOUNCE_MS);
  }

  function flushNote(applicationId: string) {
    if (!timers.current[applicationId]) return;
    cancelTimer(applicationId);
    const row = rows[applicationId];
    if (row.vote) void save(applicationId, row.vote, row.note);
  }

  function toggleNotes(applicationId: string) {
    const opening = !openNotes[applicationId];
    setOpenNotes((current) => ({ ...current, [applicationId]: opening }));
    if (!opening || notesById[applicationId]) return;
    void fetchLive(applicationId).then((result) => {
      if (result) setNotesById((current) => ({ ...current, [applicationId]: result.notes }));
    });
  }

  if (!applicants.length) {
    return (
      <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55">
        No applicants are up for a vote right now. Anyone you have declared a conflict on stays off this list.
      </p>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
      <p className="text-sm font-semibold text-mecg-navy/65" aria-live="polite">Voted {voted} of {applicants.length}</p>

      {presenting && (
        <div className="mt-4 rounded-2xl bg-mecg-navy p-5 text-white" aria-label="Now presenting">
          <div className="flex items-center gap-4">
            {failedHeadshots.has(presenting.id) ? (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-2xl font-semibold text-white/70" aria-hidden="true">{initials(presenting.name)}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
              <img
                src={`/api/admin/applications/${encodeURIComponent(presenting.id)}/headshot`}
                alt=""
                className="size-20 shrink-0 rounded-full object-cover"
                onError={() => setFailedHeadshots((current) => new Set(current).add(presenting.id))}
              />
            )}
            <p className="text-[13px] font-semibold text-white/50">Now presenting</p>
          </div>
          <div className="mt-4">
            <BallotRow id={presenting.id} name={presenting.name} row={rows[presenting.id]} rowStatus={status[presenting.id]} dark onCast={cast} onEditNote={editNote} onFlushNote={flushNote} />
          </div>
          <div className="mt-5">
            <ApplicantNotes notes={live.notes} dark />
          </div>
        </div>
      )}

      <div className="relative mt-4">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mecg-navy/45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
          className="min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
        />
      </div>

      <ul className="mt-5 divide-y divide-mecg-navy/10">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
            <p className="font-semibold text-mecg-navy">No applicant matches “{query.trim()}”</p>
            <p className="mt-1 text-sm text-mecg-navy/55">Check the spelling or try their other name.</p>
          </li>
        )}
        {visible.map(({ id, name }) => (
          <li key={id} className={`py-3 ${rows[id].vote ? "bg-mecg-navy/[0.03]" : ""} -mx-2 rounded-xl px-2`}>
            <BallotRow id={id} name={name} row={rows[id]} rowStatus={status[id]} onCast={cast} onEditNote={editNote} onFlushNote={flushNote} />
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
