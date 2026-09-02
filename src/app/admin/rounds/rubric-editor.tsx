"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roundStatusLabel } from "@/lib/labels";

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
  const [criteria, setCriteria] = useState(round.criteria);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
    || criteria.some((item) => !KEY_PATTERN.test(item.key) || !item.name.trim() || item.weight < 1 || item.weight > 100);
  // Scoring normalises by the total observed weight, so these do not have to
  // reach 100. Showing the share each criterion carries is more honest than
  // demanding a total.
  const totalWeight = criteria.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);

  async function save() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: round.cycleId, action: "SET_RUBRIC_CRITERIA", roundId: round.roundId, criteria }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not save the scoring guide");
        return;
      }
      setNotice("Scoring guide saved.");
      router.refresh();
    } catch {
      setError("Could not save the scoring guide");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-mecg-navy/50">
            {round.roundName} scoring guide
          </p>
          <p className="mt-1 text-sm text-mecg-navy/55">
            {round.rubricVersion ? `Version ${round.rubricVersion}` : "No scoring guide yet"} · round is {roundStatusLabel(round.roundStatus)}
          </p>
        </div>
        <span className="tabular text-xs text-mecg-navy/45">{criteria.length} criteria · {totalWeight} weight</span>
      </div>

      {!editable ? (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-mecg-navy/65 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          This round is already under way, so its scoring guide is fixed. Evaluators who have scored against it keep the
          wording they saw.
        </p>
      ) : (
        <>
          <ol className="mt-4 flex flex-col gap-3">
            {criteria.map((item, index) => (
              <li key={index} className="rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="tabular text-xs font-semibold text-mecg-navy/65">{index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Move criterion ${index + 1} up`} className="inline-flex size-10 items-center justify-center rounded-full text-mecg-navy/60 hover:bg-mecg-blue/[0.1] disabled:opacity-35">&uarr;</button>
                    <button type="button" onClick={() => move(index, 1)} disabled={pending || index === criteria.length - 1} aria-label={`Move criterion ${index + 1} down`} className="inline-flex size-10 items-center justify-center rounded-full text-mecg-navy/60 hover:bg-mecg-blue/[0.1] disabled:opacity-35">&darr;</button>
                    <button type="button" onClick={() => setCriteria((current) => current.filter((_, at) => at !== index))} disabled={pending} aria-label={`Remove criterion ${index + 1}`} className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-45">Remove</button>
                  </div>
                </div>

                <label className="mt-2 block text-sm font-medium">
                  Name
                  <input
                    value={item.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    maxLength={120}
                    className="mt-1.5 min-h-11 w-full rounded-xl bg-mecg-navy/[0.035] px-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
                  />
                </label>
                <label className="mt-2 block text-sm font-medium">
                  What an evaluator is looking for
                  <textarea
                    value={item.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                    rows={2}
                    maxLength={2000}
                    className="mt-1.5 w-full rounded-xl bg-mecg-navy/[0.035] p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
                  />
                </label>

                <div className="mt-2.5 flex flex-wrap items-end gap-3">
                  <label className="block text-sm font-medium">
                    Key
                    <input
                      value={item.key}
                      onChange={(event) => update(index, { key: event.target.value })}
                      aria-invalid={!KEY_PATTERN.test(item.key)}
                      className="mt-1.5 min-h-11 w-44 rounded-xl bg-mecg-navy/[0.035] px-3 tabular text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Weight
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={item.weight}
                      onChange={(event) => update(index, { weight: Number.parseInt(event.target.value, 10) || 0 })}
                      className="mt-1.5 min-h-11 w-24 rounded-xl bg-mecg-navy/[0.035] px-3 text-sm tabular-nums shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
                    />
                  </label>
                  <span className="pb-3 tabular text-[11px] text-mecg-navy/45">
                    {totalWeight > 0 ? `${Math.round((item.weight / totalWeight) * 100)}% of the round` : ""}
                  </span>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={item.required} onChange={(event) => update(index, { required: event.target.checked })} className="size-4" />
                    Required
                  </label>
                </div>
                {!KEY_PATTERN.test(item.key) && (
                  <p className="mt-2 text-xs text-red-700">Keys are lowercase letters, digits and underscores, starting with a letter.</p>
                )}
              </li>
            ))}
          </ol>

          {!criteria.length && (
            <p className="mt-4 rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center text-sm text-mecg-navy/55">
              A scoring guide needs at least one criterion before evaluators can score.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || criteria.length >= 20}
              onClick={() => setCriteria((current) => [...current, { key: `criterion_${current.length + 1}`, name: "", description: "", weight: 20, required: false }])}
              className="button-secondary text-sm"
            >
              + Add criterion
            </button>
            <button type="button" disabled={pending || invalid} onClick={() => void save()} className="button-primary">
              {pending ? "Saving…" : "Save scoring guide"}
            </button>
            {duplicates.length > 0 && <p className="text-sm text-red-700">Duplicate key: {duplicates[0]}</p>}
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    </section>
  );
}
