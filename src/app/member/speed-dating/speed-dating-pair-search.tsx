"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OperationNotice from "@/components/operation-notice";
import SegmentedControl from "@/components/segmented-control";
import {
  SPEED_DATING_GROUP_SIZES,
  SPEED_DATING_SESSIONS,
  searchSpeedDatingApplicants,
  type SpeedDatingApplicant,
  type SpeedDatingPair,
  type SpeedDatingPairQueue,
  type SpeedDatingSession,
} from "@/lib/speed-dating-pairs";
import SpeedDatingPairGrading from "./speed-dating-pair-grading";

const RESULT_LIMIT = 8;

function fold(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
}

// ponytail: index mapping assumes folding keeps the string length; names with
// ligatures or width-changing characters fall back to a raw match or no highlight.
function highlight(name: string, query: string) {
  const needle = fold(query).trim();
  if (!needle) return name;
  const folded = fold(name);
  let index = folded.length === name.length ? folded.indexOf(needle) : -1;
  if (index < 0) index = name.toLocaleLowerCase().indexOf(needle);
  if (index < 0) return name;
  return (
    <>
      {name.slice(0, index)}
      <mark className="rounded bg-amber-100 text-inherit">{name.slice(index, index + needle.length)}</mark>
      {name.slice(index + needle.length)}
    </>
  );
}

const SESSION_STORAGE_KEY = "speed-dating-session";
const SESSION_EVENT = "speed-dating-session-change";

function isSession(value: number): value is SpeedDatingSession {
  return (SPEED_DATING_SESSIONS as readonly number[]).includes(value);
}

// Session choice lives in localStorage so it survives a refresh mid-evening; a
// module-level copy keeps the switch working when storage is blocked.
let chosenSession: SpeedDatingSession | null = null;

function readSession(): SpeedDatingSession {
  if (chosenSession) return chosenSession;
  try {
    const stored = Number(window.localStorage.getItem(SESSION_STORAGE_KEY));
    return isSession(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function subscribeSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_EVENT, callback);
  };
}

function chooseSession(next: SpeedDatingSession) {
  chosenSession = next;
  try { window.localStorage.setItem(SESSION_STORAGE_KEY, String(next)); } catch {}
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function memberNames(pair: SpeedDatingPair) {
  return pair.members.map((member) => member.name).join(" + ");
}

function StatePill({ pair }: { pair: SpeedDatingPair }) {
  if (pair.submittedAt) return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Submitted</span>;
  return <span className="rounded-full bg-mecg-orange/[0.14] px-3 py-1 text-xs font-semibold text-mecg-orange-ink">In progress</span>;
}

export default function SpeedDatingPairSearch({
  initialQueue,
  requestedPairId,
  submitted,
  discarded,
}: {
  initialQueue: SpeedDatingPairQueue;
  requestedPairId?: string;
  submitted: boolean;
  discarded: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const session = useSyncExternalStore(subscribeSession, readSession, () => 1 as SpeedDatingSession);
  const [tray, setTray] = useState<SpeedDatingApplicant[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { pairs, applicants } = initialQueue;
  const results = useMemo(() => searchSpeedDatingApplicants(applicants, query).slice(0, RESULT_LIMIT), [applicants, query]);
  const unfinished = pairs.filter((pair) => !pair.submittedAt);
  const inSession = pairs.filter((pair) => pair.session === session);
  const unfinishedInSession = inSession.filter((pair) => !pair.submittedAt);
  const submittedInSession = inSession.filter((pair) => pair.submittedAt);
  const submittedBySession = SPEED_DATING_SESSIONS.map((s) => `Session ${s}: ${pairs.filter((pair) => pair.session === s && pair.submittedAt).length} submitted`).join(" · ");
  const scoredCount = applicants.filter((applicant) => applicant.scored).length;
  const isActive = initialQueue.roundStatus === "ACTIVE";
  const canStart = isActive && initialQueue.rubricReady && initialQueue.calibrated;
  const traySized = tray.length >= SPEED_DATING_GROUP_SIZES.min && tray.length <= SPEED_DATING_GROUP_SIZES.max;
  const activePair = requestedPairId
    ? pairs.find((pair) => pair.id === requestedPairId && !pair.submittedAt)
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

  function add(applicant: SpeedDatingApplicant) {
    if (tray.length >= SPEED_DATING_GROUP_SIZES.max) return;
    setTray((current) => current.some((item) => item.applicationId === applicant.applicationId) ? current : [...current, applicant]);
    setQuery("");
    setError("");
    inputRef.current?.focus();
  }

  function remove(applicationId: string) {
    setTray((current) => current.filter((item) => item.applicationId !== applicationId));
    setError("");
  }

  async function startGroup() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/member/speed-dating/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: initialQueue.roundId, applicationIds: tray.map((item) => item.applicationId), session }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.pairId !== "string") throw new Error(body?.error ?? "Could not start this group");
      router.push(`/member/speed-dating?pair=${encodeURIComponent(body.pairId)}`);
      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start this group");
      setPending(false);
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

  function renderPair(pair: SpeedDatingPair) {
    return (
      <article key={pair.id} className="rounded-2xl border border-mecg-navy/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-mecg-orange-ink">{pair.label}</p>
            <h3 className="mt-1 text-lg font-semibold text-mecg-navy">{memberNames(pair)}</h3>
          </div>
          <StatePill pair={pair} />
        </div>
        {!pair.submittedAt && (
          <button
            type="button"
            disabled={!canStart}
            onClick={() => router.push(`/member/speed-dating?pair=${encodeURIComponent(pair.id)}`)}
            className="button-primary mt-4 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue grading
          </button>
        )}
      </article>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">{initialQueue.roundName}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy">Who is in front of you?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">Search each applicant’s name and add them. Groups are two or three people.</p>

        {submitted && <div className="mt-4"><OperationNotice kind="success">All ratings were submitted. Search to build the next group.</OperationNotice></div>}
        {discarded && <div className="mt-4"><OperationNotice kind="success">Group discarded. Search to build the next one.</OperationNotice></div>}
        {!initialQueue.rubricReady && (
          <div className="mt-4"><OperationNotice kind="error">The Board must configure one required 100% Speed Dating criterion before group grading can begin.</OperationNotice></div>
        )}
        {initialQueue.rubricReady && !initialQueue.calibrated && (
          <div className="mt-4 rounded-xl bg-mecg-orange/[0.1] p-4">
            <p className="text-sm font-semibold text-mecg-navy">Review the scoring anchors before grading</p>
            <p className="mt-1 text-xs leading-5 text-mecg-navy/60">Calibration keeps the 1–5 scale consistent across a live round.</p>
            <Link href={`/member/calibration/${encodeURIComponent(initialQueue.roundId)}?return=${encodeURIComponent("/member/speed-dating")}`} className="button-primary mt-3 inline-flex text-sm">Review calibration</Link>
          </div>
        )}

        <p className="mt-6 text-sm font-semibold text-mecg-navy">Session</p>
        <div className="mt-2 max-w-xs">
          <SegmentedControl
            name="Session"
            options={SPEED_DATING_SESSIONS.map((s) => ({ value: String(s), label: `Session ${s}` }))}
            value={String(session)}
            onChange={(value) => { const next = Number(value); if (isSession(next)) chooseSession(next); }}
          />
        </div>

        <label htmlFor="applicant-search" className="mt-5 block text-sm font-semibold text-mecg-navy">Applicant name</label>
        <div className="relative mt-2">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mecg-navy/45" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            id="applicant-search"
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setError(""); }}
            placeholder="Start typing a first or last name"
            autoComplete="off"
            autoFocus
            className="min-h-12 w-full rounded-xl border border-mecg-navy/15 bg-white py-3 pl-12 pr-4 text-base text-mecg-navy outline-none transition focus:border-mecg-blue focus:ring-4 focus:ring-mecg-blue/10"
          />
        </div>

        {!isActive && (
          <div className="mt-4"><OperationNotice kind="info">Grading opens when the Board starts the round.</OperationNotice></div>
        )}
        {error && <div className="mt-4"><OperationNotice kind="error">{error}</OperationNotice></div>}

        <div aria-live="polite">
          {query.trim() && (
            <div className="mt-4 space-y-2">
              {results.length === 0
                ? (
                  <div className="rounded-xl border border-dashed border-mecg-navy/15 px-5 py-8 text-center">
                    <p className="font-semibold text-mecg-navy">No applicant matches “{query.trim()}”</p>
                    <p className="mt-1 text-sm text-mecg-navy/55">Check the spelling or try their other name.</p>
                  </div>
                )
                : results.map((applicant) => {
                  const added = tray.some((item) => item.applicationId === applicant.applicationId);
                  const openGroup = unfinished.find((pair) => pair.members.some((member) => member.applicationId === applicant.applicationId));
                  return (
                    <div key={applicant.applicationId} className="flex items-center justify-between gap-3 rounded-xl border border-mecg-navy/10 px-4 py-2">
                      <span className="font-semibold text-mecg-navy">{highlight(applicant.name, query)}</span>
                      <span className="flex items-center gap-2">
                        {applicant.scored && <span className="rounded-full bg-mecg-navy/[0.06] px-3 py-1 text-xs font-semibold text-mecg-navy/60">Scored</span>}
                        {!applicant.scored && openGroup && <span className="rounded-full bg-mecg-orange/[0.14] px-3 py-1 text-xs font-semibold text-mecg-orange-ink">In {openGroup.label}</span>}
                        <button
                          type="button"
                          disabled={applicant.scored || Boolean(openGroup) || added || tray.length >= SPEED_DATING_GROUP_SIZES.max}
                          onClick={() => add(applicant)}
                          className="button-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {added ? "Added" : "Add"}
                        </button>
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-mecg-navy/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-navy/50">Your group</p>
              <p className="text-sm font-semibold text-mecg-navy">{tray.length} of {SPEED_DATING_GROUP_SIZES.max}</p>
            </div>
            {tray.length === 0
              ? <p className="mt-3 text-sm text-mecg-navy/55">Add the applicants sitting in front of you. Press / to jump back to search.</p>
              : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {tray.map((applicant) => (
                    <li key={applicant.applicationId} className="flex min-h-11 items-center gap-1 rounded-full bg-mecg-navy/[0.06] pl-4 pr-1 text-sm font-semibold text-mecg-navy">
                      {applicant.name}
                      <button type="button" onClick={() => remove(applicant.applicationId)} aria-label={`Remove ${applicant.name}`} className="flex size-9 items-center justify-center rounded-full text-lg leading-none text-mecg-navy/60 hover:bg-mecg-navy/10 hover:text-mecg-navy">×</button>
                    </li>
                  ))}
                </ul>
              )}
            <button
              type="button"
              disabled={!traySized || !canStart || pending}
              onClick={() => void startGroup()}
              className="button-primary mt-4 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Starting…" : tray.length < SPEED_DATING_GROUP_SIZES.min ? `Add ${SPEED_DATING_GROUP_SIZES.min - tray.length} more to start` : `Start grading these ${tray.length} applicants`}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-navy/50">Your unfinished groups</p>
          {unfinishedInSession.length === 0
            ? <p className="text-sm text-mecg-navy/55">Nothing in progress for Session {session}.</p>
            : unfinishedInSession.map(renderPair)}
          <details className="rounded-2xl border border-mecg-navy/10 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-mecg-navy">Submitted this session ({submittedInSession.length})</summary>
            <div className="mt-3 space-y-3">{submittedInSession.map(renderPair)}</div>
          </details>
        </div>
      </section>

      <aside className="h-fit rounded-2xl bg-mecg-navy p-5 text-white lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">Your round</p>
        <p className="mt-2 text-3xl font-semibold">{pairs.length}</p>
        <p className="text-sm text-white/65">{pairs.length === 1 ? "group started" : "groups started"}</p>
        <p className="mt-4 text-sm font-semibold text-white">{pairs.length - unfinished.length} submitted</p>
        <p className="mt-1 text-sm font-semibold text-white">{unfinished.length} remaining</p>
        <p className="mt-2 text-xs text-white/65">{submittedBySession}</p>
        <p className="mt-4 text-sm font-semibold text-white">Applicants scored: {scoredCount} of {applicants.length}</p>
        <div className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white/70">
          <p>You score each applicant once per round. Other evaluators grade the same people independently.</p>
        </div>
      </aside>
    </div>
  );
}
