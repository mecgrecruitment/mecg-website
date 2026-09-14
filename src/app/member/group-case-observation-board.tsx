"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { parseEvaluationDraftPayload, type EvaluationDraftPayload } from "@/app/api/member/evaluations/evaluation-draft-payload";
import OperationNotice from "@/components/operation-notice";
import { readEvaluationDraft, writeEvaluationDraft } from "@/lib/evaluation-draft-recovery";
import { authorizedFetch, retryOnNetworkError } from "@/lib/client-fetch";

type Candidate = {
  assignmentId: string;
  name: string;
  criteria: Array<{ id: string; name: string; description: string; weight: number; required: boolean }>;
};

const COMPOSER_STORAGE_KEY = "mecg:group-case-composers:v1";

function readComposers(candidateIds: Set<string>) {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(COMPOSER_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, text]) => candidateIds.has(id) && typeof text === "string" && text.length <= 500));
  } catch {
    return {};
  }
}

function blankDraft(candidate: Candidate): EvaluationDraftPayload {
  return { ratings: candidate.criteria.map((criterion) => ({ criterionId: criterion.id, score: "", note: "" })), evidence: "" };
}

export default function GroupCaseObservationBoard({ candidates }: { candidates: Candidate[] }) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.assignmentId ?? "");
  const selected = candidates.find((candidate) => candidate.assignmentId === selectedId) ?? candidates[0];
  const [criterionId, setCriterionId] = useState(selected?.criteria[0]?.id ?? "");
  const [composers, setComposers] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, EvaluationDraftPayload>>({});
  const [state, setState] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");
  const observationRef = useRef<HTMLTextAreaElement>(null);
  const observation = composers[selectedId] ?? "";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setComposers(readComposers(new Set(candidates.map((candidate) => candidate.assignmentId))));
      try {
        const loaded = await Promise.all(candidates.map(async (candidate) => {
          const local = readEvaluationDraft({ storage: window.sessionStorage, assignmentId: candidate.assignmentId, criteria: candidate.criteria });
          const response = await authorizedFetch(`/api/member/evaluations/${encodeURIComponent(candidate.assignmentId)}/draft`, { cache: "no-store", signal: controller.signal });
          const body = await response.json().catch(() => null);
          if (!response.ok) throw new Error(body?.error ?? "Could not load Group Case notes");
          const parsed = body?.draft == null ? null : parseEvaluationDraftPayload(body.draft);
          const recovered = parsed ?? (local ? {
            ratings: candidate.criteria.map((criterion) => ({ criterionId: criterion.id, score: local.scores[criterion.id] ?? "", note: local.notes[criterion.id] ?? "" })),
            evidence: local.evidence,
          } : blankDraft(candidate));
          return [candidate.assignmentId, recovered] as const;
        }));
        setDrafts(Object.fromEntries(loaded));
        setState("ready");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        const recovered = Object.fromEntries(candidates.flatMap((candidate) => {
          const local = readEvaluationDraft({ storage: window.sessionStorage, assignmentId: candidate.assignmentId, criteria: candidate.criteria });
          return local ? [[candidate.assignmentId, {
            ratings: candidate.criteria.map((criterion) => ({ criterionId: criterion.id, score: local.scores[criterion.id] ?? "", note: local.notes[criterion.id] ?? "" })),
            evidence: local.evidence,
          }] as const] : [];
        }));
        setDrafts(recovered);
        setError(`${loadError instanceof Error ? loadError.message : "Could not load Group Case notes"}${Object.keys(recovered).length ? " Browser backups were restored." : ""}`);
        setState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [candidates]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify(composers));
    } catch {
      // Browser recovery is best-effort; server drafts remain authoritative.
    }
  }, [composers]);

  useEffect(() => {
    function focusComposer(event: KeyboardEvent) {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        observationRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusComposer);
    return () => window.removeEventListener("keydown", focusComposer);
  }, []);

  const observationCounts = useMemo(() => Object.fromEntries(candidates.map((candidate) => [
    candidate.assignmentId,
    (drafts[candidate.assignmentId]?.ratings ?? []).filter((rating) => rating.note.trim()).length,
  ])), [candidates, drafts]);

  async function saveObservation() {
    if (!selected || !criterionId || !observation.trim() || state === "saving") return;
    const current = drafts[selected.assignmentId] ?? blankDraft(selected);
    const stamp = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());
    const next: EvaluationDraftPayload = {
      ...current,
      ratings: current.ratings.map((rating) => rating.criterionId === criterionId
        ? { ...rating, note: [rating.note.trim(), `• ${stamp} — ${observation.trim()}`].filter(Boolean).join("\n").slice(0, 2000) }
        : rating),
    };
    writeEvaluationDraft({
      storage: window.sessionStorage,
      assignmentId: selected.assignmentId,
      criteria: selected.criteria,
      draft: {
        scores: Object.fromEntries(next.ratings.map((rating) => [rating.criterionId, rating.score])),
        notes: Object.fromEntries(next.ratings.map((rating) => [rating.criterionId, rating.note])),
        evidence: next.evidence,
      },
    });
    setState("saving");
    setError("");
    try {
      const response = await retryOnNetworkError(() => authorizedFetch(`/api/member/evaluations/${encodeURIComponent(selected.assignmentId)}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      }));
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not save this observation");
      setDrafts((currentDrafts) => ({ ...currentDrafts, [selected.assignmentId]: next }));
      setComposers((current) => ({ ...current, [selected.assignmentId]: "" }));
      setState("saved");
      observationRef.current?.focus();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this observation");
      setState("error");
    }
  }

  if (!selected) return null;
  return (
    <section className="mt-3.5 rounded-2xl bg-paper p-4 sm:p-5" aria-labelledby="observation-board-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mecg-orange-ink">Live discussion</p>
          <h3 id="observation-board-heading" className="mt-1 text-xl font-semibold text-mecg-navy">Capture behavior now, rate later</h3>
          <p className="mt-1 text-sm text-mecg-navy/60">Pick a person and dimension, then record only what you directly observed.</p>
        </div>
        <Link href="/member?round=GROUP_CASE&mode=finish" className="button-primary text-sm">Finish ratings</Link>
      </div>

      <div className="scroll-cue -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
        {candidates.map((candidate) => (
          <button
            key={candidate.assignmentId}
            type="button"
            aria-pressed={candidate.assignmentId === selected.assignmentId}
            onClick={() => { setSelectedId(candidate.assignmentId); setCriterionId(candidate.criteria[0]?.id ?? ""); setState("ready"); }}
            className={`min-h-12 min-w-40 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,scale] active:scale-[0.96] ${candidate.assignmentId === selected.assignmentId ? "bg-mecg-navy text-white" : "bg-white text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"}`}
          >
            <span className="block text-sm font-semibold">{candidate.name}</span>
            <span className={`mt-0.5 block text-xs ${candidate.assignmentId === selected.assignmentId ? "text-white/65" : "text-mecg-navy/55"}`}>{observationCounts[candidate.assignmentId] ?? 0} dimensions noted</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
        <label className="text-sm font-medium text-mecg-navy">Dimension
          <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} disabled={state === "loading" || state === "saving"} className="select-control mt-2">
            {selected.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-mecg-navy">Observed behavior
          <textarea
            ref={observationRef}
            value={observation}
            onChange={(event) => { setComposers((current) => ({ ...current, [selected.assignmentId]: event.target.value })); setError(""); if (state === "saved") setState("ready"); }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveObservation(); } }}
            maxLength={500}
            placeholder={`What did ${selected.name} say or do?`}
            className="mt-2 min-h-24 w-full rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mecg-navy/55" role="status" aria-live="polite">{state === "loading" ? "Loading saved observations…" : state === "saving" ? "Saving observation…" : state === "saved" ? "Observation saved across devices." : "Enter saves · Shift+Enter adds a line · / focuses the field"}</p>
        <button type="button" onClick={() => void saveObservation()} disabled={!observation.trim() || state === "loading" || state === "saving"} className="button-secondary min-h-11">Save observation</button>
      </div>
      {error && <div className="mt-3"><OperationNotice kind="error">{error} Your text has not been cleared.</OperationNotice></div>}
    </section>
  );
}
