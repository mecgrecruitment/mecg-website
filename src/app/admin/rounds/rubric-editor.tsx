"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roundStatusLabel } from "@/lib/labels";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import OperationNotice from "@/components/operation-notice";

export type Criterion = {
  key: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

export type RoundRubric = {
  // The rush endpoint checks the caller's permission against a cycle, so the
  // round alone is not enough to authorize the write.
  cycleId: string;
  roundId: string;
  roundName: string;
  roundStatus: string;
  rubricVersion: number | null;
  criteria: Criterion[];
};

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const EDITABLE_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

export default function RubricEditor({ round }: { round: RoundRubric }) {
  const router = useRouter();
  const fieldPrefix = useId();
  const saving = useRef(false);
  const [criteria, setCriteria] = useState(round.criteria);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const editable = EDITABLE_STATUSES.has(round.roundStatus);
  const update = (index: number, patch: Partial<Criterion>) =>
    setCriteria((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) =>
    setCriteria((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const duplicates = criteria.map((item) => item.key).filter((key, index, all) => all.indexOf(key) !== index);
  const invalid = !criteria.length
    || duplicates.length > 0
    || criteria.some((item) => !KEY_PATTERN.test(item.key) || item.key.length > 80 || !item.name.trim() || !Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100);
  // Scoring normalises by the total observed weight, so these do not have to
  // reach 100. Showing the share each criterion carries is more honest than
  // demanding a total.
  const totalWeight = criteria.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);

  async function save() {
    if (saving.current || uncertain || invalid || !editable) return;
    saving.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/rush", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: round.cycleId, action: "SET_RUBRIC_CRITERIA", roundId: round.roundId, criteria }),
      }, 15_000, authorizedFetch);
      if (!response.ok && response.status < 500 && response.status !== 408) {
        setError(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not save the scoring guide");
        return;
      }
      if (!response.ok || !body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id.trim() || !("roundId" in body) || body.roundId !== round.roundId) {
        setUncertain(true);
        return;
      }
      setNotice("Scoring guide saved. Reload the current guide to check its version.");
      router.refresh();
    } catch {
      setUncertain(true);
    } finally {
      saving.current = false;
      setPending(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }

  return (
    <section className="rounded-xl bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-muted">
            {round.roundName} scoring guide
          </p>
          <p className="mt-1 text-sm text-muted">
            {round.rubricVersion ? `Version ${round.rubricVersion}` : "No scoring guide yet"} · round is {roundStatusLabel(round.roundStatus)}
          </p>
        </div>
        <span className="tabular text-xs text-muted">{criteria.length} criteria · {totalWeight} weight</span>
      </div>

      {!editable ? (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-muted inset-ring inset-ring-line">
          This round is already under way, so its scoring guide is fixed. Evaluators who have scored against it keep the
          wording they saw.
        </p>
      ) : (
        <fieldset disabled={pending} className="min-w-0 border-0 p-0">
          <ol className="mt-4 flex flex-col gap-3">
            {criteria.map((item, index) => {
              const id = `${fieldPrefix}-${index}`;
              const nameError = !item.name.trim() ? "Enter a name for this criterion." : null;
              const keyError = !KEY_PATTERN.test(item.key) || item.key.length > 80 ? "Use up to 80 lowercase letters, digits and underscores, starting with a letter." : duplicates.includes(item.key) ? "Each criterion needs a different key." : null;
              const weightError = !Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100 ? "Enter a whole-number weight from 1 to 100." : null;
              return (
              <li key={index} className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
                <div className="flex items-start justify-between gap-3">
                  <span className="tabular text-xs font-semibold text-muted">{index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Move criterion ${index + 1} up`} className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-mecg-blue/10 disabled:opacity-35">&uarr;</button>
                    <button type="button" onClick={() => move(index, 1)} disabled={pending || index === criteria.length - 1} aria-label={`Move criterion ${index + 1} down`} className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-mecg-blue/10 disabled:opacity-35">&darr;</button>
                    <button type="button" onClick={() => setCriteria((current) => current.filter((_, at) => at !== index))} disabled={pending} aria-label={`Remove criterion ${index + 1}`} className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-danger hover:bg-danger-wash disabled:opacity-45">Remove</button>
                  </div>
                </div>

                <label className="mt-2 block text-sm font-medium">
                  Name
                  <input
                    id={`${id}-name`}
                    aria-invalid={!!nameError}
                    aria-describedby={nameError ? `${id}-name-error` : undefined}
                    value={item.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    maxLength={120}
                    className="mt-1.5 min-h-11 w-full aria-invalid:bg-danger-wash aria-invalid:inset-ring-danger rounded-xl bg-wash px-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
                  />
                </label>
                {nameError && <p id={`${id}-name-error`} className="mt-2 text-sm text-danger">{nameError}</p>}
                <label className="mt-2 block text-sm font-medium">
                  What an evaluator is looking for
                  <textarea
                    value={item.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                    rows={2}
                    maxLength={2000}
                    className="mt-1.5 w-full rounded-xl bg-wash p-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
                  />
                </label>

                <div className="mt-2.5 flex flex-wrap items-end gap-3">
                  <label className="block text-sm font-medium">
                    Key
                    <input
                      maxLength={80}
                      value={item.key}
                      onChange={(event) => update(index, { key: event.target.value })}
                      id={`${id}-key`}
                      aria-invalid={!!keyError}
                      aria-describedby={keyError ? `${id}-key-error` : undefined}
                      className="mt-1.5 block min-h-11 w-44 aria-invalid:bg-danger-wash aria-invalid:inset-ring-danger rounded-xl bg-wash px-3 tabular text-xs inset-ring inset-ring-line-strong outline-none"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Weight
                    <input
                      type="number"
                      min={1}
                      max={100}
                      id={`${id}-weight`}
                      aria-invalid={!!weightError}
                      aria-describedby={weightError ? `${id}-weight-error` : undefined}
                      value={item.weight}
                      onChange={(event) => update(index, { weight: Number(event.target.value) })}
                      className="mt-1.5 block min-h-11 w-24 aria-invalid:bg-danger-wash aria-invalid:inset-ring-danger rounded-xl bg-wash px-3 text-sm tabular-nums inset-ring inset-ring-line-strong outline-none"
                    />
                  </label>
                  <span className="pb-3 tabular text-xs text-muted">
                    {totalWeight > 0 ? `${Math.round((item.weight / totalWeight) * 100)}% of the round` : ""}
                  </span>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={item.required} onChange={(event) => update(index, { required: event.target.checked })} className="size-4" />
                    Required
                  </label>
                </div>
                {keyError && <p id={`${id}-key-error`} className="mt-2 text-sm text-danger">{keyError}</p>}
                {weightError && <p id={`${id}-weight-error`} className="mt-2 text-sm text-danger">{weightError}</p>}
              </li>
            ); })}
          </ol>

          {!criteria.length && (
            <p className="mt-4 rounded-xl border-[1.5px] border-dashed border-line p-6 text-center text-sm text-muted">
              A scoring guide needs at least one criterion before evaluators can score.
            </p>
          )}

          {invalid && <p id={`${fieldPrefix}-validation`} className="mt-4 text-sm text-danger">{criteria.length ? "Fix the highlighted fields before saving the scoring guide." : "Add at least one named criterion before saving the scoring guide."}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || criteria.length >= 20}
              onClick={() => setCriteria((current) => {
                let suffix = 1;
                while (current.some((item) => item.key === `criterion_${suffix}`)) suffix += 1;
                return [...current, { key: `criterion_${suffix}`, name: "", description: "", weight: 20, required: false }];
              })}
              className="button-secondary text-sm"
            >
              + Add criterion
            </button>
            <button type="button" disabled={pending || uncertain || invalid} aria-describedby={invalid ? `${fieldPrefix}-validation` : undefined} onClick={() => void save()} className="button-primary">
              {pending ? "Saving…" : "Save scoring guide"}
            </button>
          </div>
        </fieldset>
      )}

      <div ref={resultRef} tabIndex={-1} aria-label="Scoring guide save result" className="mt-3">
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{notice}</OperationNotice>
        {uncertain && <>
          <OperationNotice kind="info">The save could not be confirmed. This scoring guide may already be saved. Your current wording remains in this page; do not save again until you reload and compare the current guide. Download your private copy before reloading so you can recover any differences.</OperationNotice>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="button-secondary" onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify({ cycleId: round.cycleId, roundId: round.roundId, basedOnVersion: round.rubricVersion, criteria }, null, 2)], { type: "application/json" }));
              const anchor = document.createElement("a"); anchor.href = url; anchor.download = "scoring-guide-private-copy.json"; anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>Download private scoring guide copy</button>
            <button type="button" className="button-secondary" onClick={() => {
              if (window.confirm("Reload the current scoring guide? Download your private copy first; unsaved wording in this page will be replaced.")) window.location.reload();
            }}>Reload current scoring guide</button>
          </div>
        </>}
      </div>
    </section>
  );
}
