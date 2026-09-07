"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { SPEED_DATING_SCORE_ANCHORS } from "@/lib/rubrics";
import type { SpeedDatingPair } from "@/lib/speed-dating-pairs";

type MemberDraft = { score: string; note: string };
type Drafts = Record<string, MemberDraft>;

function blankDrafts(pair: SpeedDatingPair): Drafts {
  return Object.fromEntries(pair.members.map((member) => [member.applicationId, { score: "", note: "" }]));
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
  const [confirmingWrongPair, setConfirmingWrongPair] = useState(false);
  const lastSaved = useRef("");
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const signature = useMemo(() => JSON.stringify(drafts), [drafts]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const loaded = await Promise.all(pair.members.map(async (member) => {
          if (!member.assignmentId) throw new Error("This pair is not ready for grading.");
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
      setSaveMessage("Saving both applicant drafts…");
      try {
        await Promise.all(pair.members.map(async (member) => {
          if (!member.assignmentId) throw new Error("Pair assignment missing");
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
        setSaveMessage("Both drafts saved across devices.");
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
      if (["1", "2", "5"].includes(draft.score) && !draft.note.trim()) {
        noteRefs.current[member.applicationId]?.focus();
        return `Add a short evidence note for ${member.name}’s ${draft.score}.`;
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
      if (!response.ok) throw new Error(body?.error ?? "Could not submit this pair");
      router.push("/member/speed-dating?submitted=1");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit this pair");
      setPending(false);
    }
  }

  async function reportWrongPair() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/speed-dating/pairs/${encodeURIComponent(pair.id)}/report`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not report this pair");
      router.push("/member/speed-dating?reported=1");
      router.refresh();
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Could not report this pair");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-7" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mecg-orange-ink">{pair.label}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy">Grade both applicants</h2>
          <p className="mt-1 text-sm text-mecg-navy/65">{pair.members[0].name} + {pair.members[1].name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBack} className="button-secondary min-h-11">Back to search</button>
          <button type="button" onClick={() => setConfirmingWrongPair(true)} className="button-secondary min-h-11">Wrong pair</button>
        </div>
      </div>

      {confirmingWrongPair && (
        <section className="mt-4 rounded-xl bg-mecg-orange/[0.1] p-4" aria-labelledby="wrong-pair-heading">
          <h3 id="wrong-pair-heading" className="font-semibold text-mecg-navy">These are not the two people you met?</h3>
          <p className="mt-1 text-sm leading-6 text-mecg-navy/65">Report the mismatch and return to search. Your ratings stay saved as private drafts while the Board resolves the roster.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void reportWrongPair()} className="button-primary">{pending ? "Reporting…" : "Report and return to search"}</button>
            <button type="button" disabled={pending} onClick={() => setConfirmingWrongPair(false)} className="button-secondary">Cancel</button>
          </div>
        </section>
      )}

      <div className="mt-4 rounded-xl bg-mecg-navy/[0.045] px-4 py-3 text-sm text-mecg-navy/70" role="status" aria-live="polite">{saveMessage}</div>
      {error && <div className="mt-4"><OperationNotice kind="error">{error}</OperationNotice></div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {pair.members.map((member) => {
          const draft = drafts[member.applicationId];
          const needsNote = ["1", "2", "5"].includes(draft.score);
          return (
            <fieldset key={member.applicationId} className="rounded-2xl border border-mecg-navy/10 p-4 sm:p-5" disabled={!ready || pending}>
              <legend className="px-1 text-lg font-semibold text-mecg-navy">{member.name}</legend>
              <p className="mt-1 text-sm font-medium text-mecg-navy">{criterion.name}</p>
              <p className="mt-1 min-h-10 text-xs leading-5 text-mecg-navy/60">{criterion.description}</p>
              <div className="mt-4 grid grid-cols-5 gap-2" aria-label={`${member.name} rating`}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <label key={score} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name={`rating-${member.applicationId}`}
                      value={score}
                      checked={draft.score === String(score)}
                      onChange={() => update(member.applicationId, { score: String(score) })}
                      className="peer sr-only"
                      aria-label={`Score ${score}: ${SPEED_DATING_SCORE_ANCHORS[score]}`}
                    />
                    <span className="flex min-h-12 items-center justify-center rounded-xl text-base font-semibold shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16)] peer-checked:bg-mecg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mecg-blue">
                      {score}
                    </span>
                  </label>
                ))}
              </div>
              {draft.score && <p className="mt-3 text-xs leading-5 text-mecg-navy/65">{SPEED_DATING_SCORE_ANCHORS[Number(draft.score)]}</p>}
              <label htmlFor={`speed-note-${member.applicationId}`} className="mt-4 block text-sm font-medium text-mecg-navy">
                Evidence note{needsNote ? " · required" : " · optional"}
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
        <div className="mt-5 rounded-2xl bg-mecg-orange/[0.1] p-4" role="region" aria-label="Pair submission review">
          <p className="font-semibold text-mecg-navy">Review before locking</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pair.members.map((member) => (
              <p key={member.applicationId} className="text-sm text-mecg-navy/75">
                <span className="font-semibold">{member.name}: {drafts[member.applicationId].score}/5</span>
                {drafts[member.applicationId].note ? ` — ${drafts[member.applicationId].note}` : ""}
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-mecg-navy/60">Submitting locks both independent evaluations together. Neither rating can be edited afterward.</p>
        </div>
      )}

      <button type="submit" disabled={!ready || pending} className="button-primary mt-5 min-h-12 w-full disabled:opacity-50">
        {pending ? "Submitting both ratings…" : reviewing ? "Submit both ratings" : "Review and submit pair"}
      </button>
    </form>
  );
}
