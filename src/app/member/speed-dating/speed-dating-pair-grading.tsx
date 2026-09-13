"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { initials } from "@/lib/initials";
import { SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS } from "@/lib/rubrics";
import type { SpeedDatingPair } from "@/lib/speed-dating-pairs";

type MemberDraft = { score: string; note: string };
type Drafts = Record<string, MemberDraft>;

const SCORES = [1, 2, 3, 4, 5];
const NOTE_REQUIRED = ["1", "2", "5"];

function blankDrafts(pair: SpeedDatingPair): Drafts {
  return Object.fromEntries(pair.members.map((member) => [member.applicationId, { score: "", note: "" }]));
}

function Star({ filled, className = "" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8Z" />
    </svg>
  );
}

function StarRow({ score, className = "h-5 w-5" }: { score: number; className?: string }) {
  return (
    <span className="inline-flex text-amber-400" aria-label={`${score} of 5`}>
      {SCORES.map((value) => <Star key={value} filled={value <= score} className={value <= score ? className : `${className} text-mecg-navy/30`} />)}
    </span>
  );
}

export default function SpeedDatingPairGrading({
  pair,
  criterion,
  onBack,
}: {
  pair: SpeedDatingPair;
  criterion: { id: string; name: string; description: string };
  onBack: () => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Drafts>(() => blankDrafts(pair));
  const [ready, setReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Loading saved ratings…");
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const count = pair.members.length;
  const [failedHeadshots, setFailedHeadshots] = useState<Set<string>>(() => new Set());
  function markHeadshotFailed(applicationId: string) {
    setFailedHeadshots((current) => current.has(applicationId) ? current : new Set(current).add(applicationId));
  }
  const lastSaved = useRef("");
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const signature = useMemo(() => JSON.stringify(drafts), [drafts]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const loaded = await Promise.all(pair.members.map(async (member) => {
          if (!member.assignmentId) throw new Error("This group is not ready for grading.");
          const response = await fetch(`/api/member/evaluations/${encodeURIComponent(member.assignmentId)}/draft`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const body = await response.json().catch(() => null);
          if (!response.ok) throw new Error(body?.error ?? "Could not restore saved ratings");
          const rating = body?.draft?.ratings?.find((candidate: { criterionId?: string }) => candidate.criterionId === criterion.id);
          return [member.applicationId, {
            score: typeof rating?.score === "string" ? rating.score : "",
            note: typeof rating?.note === "string" ? rating.note : "",
          }] as const;
        }));
        const restored = Object.fromEntries(loaded);
        setDrafts(restored);
        lastSaved.current = JSON.stringify(restored);
        setSaveMessage("Changes save automatically across devices.");
        setReady(true);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not restore saved ratings");
      }
    }
    void load();
    return () => controller.abort();
  }, [criterion.id, pair]);

  useEffect(() => {
    if (!ready || pending || signature === lastSaved.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSaveMessage("Saving applicant drafts…");
      try {
        await Promise.all(pair.members.map(async (member) => {
          if (!member.assignmentId) throw new Error("Group assignment missing");
          const draft = drafts[member.applicationId];
          const response = await fetch(`/api/member/evaluations/${encodeURIComponent(member.assignmentId)}/draft`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ratings: [{ criterionId: criterion.id, score: draft.score, note: draft.note }],
              evidence: "",
            }),
            signal: controller.signal,
          });
          const body = await response.json().catch(() => null);
          if (!response.ok) throw new Error(body?.error ?? "Could not save ratings");
        }));
        lastSaved.current = signature;
        setSaveMessage("All drafts saved across devices.");
      } catch (saveError) {
        if (controller.signal.aborted) return;
        setSaveMessage("Draft sync failed. Keep this page open and retry your change.");
        setError(saveError instanceof Error ? saveError.message : "Could not save ratings");
      }
    }, 650);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [criterion.id, drafts, pair.members, pending, ready, signature]);

  function update(applicationId: string, patch: Partial<MemberDraft>) {
    setDrafts((current) => ({
      ...current,
      [applicationId]: { ...current[applicationId], ...patch },
    }));
    setReviewing(false);
    setError("");
    setSaveMessage("Unsaved changes. Saving shortly…");
  }

  function validate() {
    for (const member of pair.members) {
      const draft = drafts[member.applicationId];
      if (!draft.score) return `Rate ${member.name}.`;
      if (NOTE_REQUIRED.includes(draft.score) && !draft.note.trim()) {
        noteRefs.current[member.applicationId]?.focus();
        return `Add 1–2 sentences for ${member.name}: a ${SPEED_DATING_SCORE_LABELS[Number(draft.score)]} needs a reason.`;
      }
    }
    return "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!reviewing) { setReviewing(true); return; }

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/speed-dating/pairs/${encodeURIComponent(pair.id)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          members: pair.members.map((member) => ({
            applicationId: member.applicationId,
            score: Number(drafts[member.applicationId].score),
            note: drafts[member.applicationId].note,
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not submit this group");
      router.push("/member/speed-dating?submitted=1");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit this group");
      setPending(false);
    }
  }

  async function discardGroup() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/speed-dating/pairs/${encodeURIComponent(pair.id)}/discard`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not discard this group");
      router.push("/member/speed-dating?discarded=1");
      router.refresh();
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : "Could not discard this group");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-orange-ink">{pair.label}</p>
          <p className="mt-1 text-sm font-semibold text-mecg-navy/65">Session {pair.session}{pair.tableNumber ? ` · Table ${pair.tableNumber}` : ""}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy">{count === 1 ? "Grade this applicant" : `Grade all ${count} applicants`}</h2>
          <p className="mt-1 text-sm text-mecg-navy/65">{pair.members.map((member) => member.name).join(" + ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBack} className="button-secondary min-h-11">Back to search</button>
          <button type="button" onClick={() => setConfirmingDiscard(true)} className="button-secondary min-h-11">Discard group</button>
        </div>
      </div>

      {confirmingDiscard && (
        <section className="mt-4 rounded-xl bg-mecg-orange/[0.1] p-4" aria-labelledby="discard-group-heading">
          <h3 id="discard-group-heading" className="font-semibold text-mecg-navy">Discard this group?</h3>
          <p className="mt-1 text-sm leading-6 text-mecg-navy/65">Made a mistake building this group? Discard it and start again from search. Nothing has been submitted.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void discardGroup()} className="button-primary min-h-11">{pending ? "Discarding…" : "Discard and return to search"}</button>
            <button type="button" disabled={pending} onClick={() => setConfirmingDiscard(false)} className="button-secondary min-h-11">Cancel</button>
          </div>
        </section>
      )}

      <div className="mt-4 rounded-xl bg-mecg-navy/[0.045] px-4 py-3 text-sm text-mecg-navy/70" role="status" aria-live="polite">{saveMessage}</div>
      {error && <div className="mt-4"><OperationNotice kind="error">{error}</OperationNotice></div>}

      <details className="mt-4 rounded-xl bg-mecg-navy/[0.045] px-4 py-3 text-sm text-mecg-navy">
        <summary className="cursor-pointer font-semibold">Scoring guide</summary>
        <ul className="mt-3 space-y-2">
          {SCORES.map((score) => (
            <li key={score} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 sm:grid-cols-[auto_6.5rem_1fr]">
              <StarRow score={score} className="h-4 w-4" />
              <span className="font-semibold">{SPEED_DATING_SCORE_LABELS[score]}</span>
              <span className="col-span-2 text-xs leading-5 text-mecg-navy/65 sm:col-span-1">{SPEED_DATING_SCORE_ANCHORS[score]}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className={`mt-5 grid gap-4 md:grid-cols-2 ${count === 3 ? "lg:grid-cols-3" : ""}`}>
        {pair.members.map((member) => {
          const draft = drafts[member.applicationId];
          const selected = Number(draft.score) || 0;
          const needsNote = NOTE_REQUIRED.includes(draft.score);
          return (
            <fieldset key={member.applicationId} className="rounded-2xl border border-mecg-navy/10 p-4 sm:p-5" disabled={!ready || pending}>
              <legend className="sr-only">{member.name}</legend>
              {failedHeadshots.has(member.applicationId)
                ? <div className="mx-auto flex size-36 items-center justify-center rounded-2xl bg-mecg-navy/[0.06] text-3xl font-semibold text-mecg-navy/60" aria-hidden="true">{initials(member.name)}</div>
                // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route
                : <img
                    src={`/api/admin/applications/${encodeURIComponent(member.applicationId)}/headshot`}
                    alt=""
                    className="mx-auto size-36 rounded-2xl object-cover"
                    // The server-rendered img can fail before React attaches onError, so also check on mount.
                    ref={(node) => { if (node?.complete && node.naturalWidth === 0) markHeadshotFailed(member.applicationId); }}
                    onError={() => markHeadshotFailed(member.applicationId)}
                  />}
              <h3 className="mt-3 text-center text-lg font-semibold text-mecg-navy">{member.name}</h3>
              <p className="mt-4 text-sm font-medium text-mecg-navy">Score this applicant</p>
              <div className="mt-2 flex justify-between gap-1" role="radiogroup" aria-label={`${member.name} rating`}>
                {SCORES.map((score) => (
                  <label key={score} className="relative flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`rating-${member.applicationId}`}
                      value={score}
                      checked={draft.score === String(score)}
                      onChange={() => update(member.applicationId, { score: String(score) })}
                      className="peer sr-only"
                      aria-label={`${score} of 5, ${SPEED_DATING_SCORE_LABELS[score]}`}
                    />
                    <span className="flex min-h-12 items-center justify-center rounded-xl transition-colors hover:bg-amber-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mecg-blue">
                      <Star filled={score <= selected} className={`h-11 w-11 ${score <= selected ? "text-amber-400" : "text-mecg-navy/30"}`} />
                    </span>
                  </label>
                ))}
              </div>
              {selected
                ? <>
                    <p className="mt-2 font-semibold text-mecg-navy">{SPEED_DATING_SCORE_LABELS[selected]}</p>
                    <p className="mt-1 text-xs leading-5 text-mecg-navy/65">{SPEED_DATING_SCORE_ANCHORS[selected]}</p>
                  </>
                : <p className="mt-2 text-sm text-mecg-navy/55">Tap a star to score</p>}
              <label htmlFor={`speed-note-${member.applicationId}`} className="mt-4 block text-sm font-medium text-mecg-navy">
                1–2 sentences about why you gave this score{needsNote ? " · required for this score" : " · optional"}
              </label>
              <textarea
                id={`speed-note-${member.applicationId}`}
                ref={(node) => { noteRefs.current[member.applicationId] = node; }}
                value={draft.note}
                maxLength={2000}
                onChange={(event) => update(member.applicationId, { note: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
              />
            </fieldset>
          );
        })}
      </div>

      {reviewing && (
        <div className="mt-5 rounded-2xl bg-mecg-orange/[0.1] p-4" role="region" aria-label="Group submission review">
          <p className="font-semibold text-mecg-navy">Review before locking</p>
          <div className={`mt-2 grid gap-2 sm:grid-cols-2 ${count === 3 ? "lg:grid-cols-3" : ""}`}>
            {pair.members.map((member) => {
              const score = Number(drafts[member.applicationId].score);
              return (
                <div key={member.applicationId} className="text-sm text-mecg-navy/75">
                  <p className="font-semibold text-mecg-navy">{member.name}</p>
                  <p className="mt-1 flex items-center gap-2"><StarRow score={score} /><span className="font-semibold">{SPEED_DATING_SCORE_LABELS[score]}</span></p>
                  {drafts[member.applicationId].note && <p className="mt-1">{drafts[member.applicationId].note}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-mecg-navy/60">{count === 1 ? "Submitting locks this evaluation." : `Submitting locks all ${count} independent evaluations together.`} No rating can be edited afterward.</p>
        </div>
      )}

      <button type="submit" disabled={!ready || pending} className="button-primary mt-5 min-h-12 w-full disabled:opacity-50">
        {pending ? "Submitting…" : reviewing ? (count === 1 ? "Submit rating" : `Submit all ${count} ratings`) : "Review and submit"}
      </button>
    </form>
  );
}
