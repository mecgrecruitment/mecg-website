"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";
import { matchesApplicantName } from "@/lib/speed-dating-roster";

const NOTE_DEBOUNCE_MS = 800;
const NOTE_LIMIT = 1000;
type Vote = "YES" | "NO" | "UNSURE" | "";
const CHOICES: { value: Exclude<Vote, "">; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "UNSURE", label: "Unsure" },
  { value: "NO", label: "No" },
];
type Row = { vote: Vote; note: string };
type RowStatus = { kind: "saving" | "saved" | "error" | "hint"; message?: string };
export type BallotApplicant = { id: string; name: string };
export type BallotVote = { application_id: string; vote: string; note: string | null };

function grow(node: HTMLTextAreaElement | null) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

export default function HashBallot({ applicants, votes }: { applicants: BallotApplicant[]; votes: BallotVote[] }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const mine = new Map(votes.map((vote) => [vote.application_id, vote]));
    return Object.fromEntries(applicants.map(({ id }) => {
      const existing = mine.get(id);
      return [id, { vote: (existing?.vote ?? "") as Vote, note: existing?.note ?? "" }];
    }));
  });
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  // Last server-confirmed values, so a failed save can put the vote back without losing typed text.
  const saved = useRef<Record<string, Row>>({ ...rows });
  const timers = useRef<Record<string, number>>({});
  const sequence = useRef<Record<string, number>>({});

  const visible = useMemo(() => applicants.filter((applicant) => matchesApplicantName(applicant.name, query)), [applicants, query]);
  const voted = Object.values(rows).filter((row) => row.vote).length;

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
        {visible.map(({ id, name }) => {
          const row = rows[id];
          const rowStatus = status[id];
          return (
            <li key={id} className={`flex flex-wrap items-start gap-x-4 gap-y-2 py-3 ${row.vote ? "bg-mecg-navy/[0.03]" : ""} -mx-2 rounded-xl px-2`}>
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold text-mecg-navy">{name}</p>
                <p className="mt-0.5 min-h-4 text-xs text-mecg-navy/55" aria-live="polite">
                  {rowStatus?.kind === "saving" && "Saving…"}
                  {rowStatus?.kind === "saved" && "Saved"}
                  {rowStatus?.kind === "hint" && rowStatus.message}
                  {rowStatus?.kind === "error" && <span className="font-semibold text-red-700">{rowStatus.message}</span>}
                  {!rowStatus && row.vote && "Saved"}
                </p>
              </div>
              <div role="group" aria-label={`Your vote on ${name}`} className="flex basis-full overflow-hidden rounded-xl">
                {CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={row.vote === choice.value}
                    onClick={() => cast(id, choice.value)}
                    className={`min-h-11 flex-1 text-sm font-semibold transition-[background-color,color] ${
                      row.vote === choice.value ? "bg-mecg-navy text-white" : "bg-white text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"
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
                onChange={(event) => editNote(id, event.target.value)}
                onBlur={() => flushNote(id)}
                className="min-h-11 w-full basis-full resize-none rounded-xl bg-mecg-navy/[0.035] px-4 py-2.5 text-sm text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
