"use client";

import { useState, type ReactNode } from "react";
import { GRAD_TERMS, gradTermFromSelection, gradYearOptions, parseGradTerm, type GradTermName } from "@/lib/grad-term";

const AS_ENTERED = "__as_entered__";

type Draft = { term: GradTermName | ""; year: string; base: string };

export default function GradTermPicker({ id, name, value, onChange, baseYear, legend, legendClassName, selectClassName, invalid, describedBy }: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  baseYear: number;
  legend: ReactNode;
  legendClassName?: string;
  selectClassName?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  // A half-picked selection belongs to the value it started from. When the parent
  // replaces that value (a draft conflict, a reset), the selects follow the new value.
  const [draft, setDraft] = useState<Draft | null>(null);
  if (draft && draft.base !== value) setDraft(null);
  const active = draft?.base === value ? draft : null;
  const parsed = parseGradTerm(value);
  // A draft saved before this picker existed can hold free text. Keep it selectable
  // until the person picks a structured term, so autosave never erases it unasked.
  const asEntered = !parsed && value.trim() ? value : null;
  const term = active ? active.term : parsed ? parsed.term : asEntered ? AS_ENTERED : "";
  const year = active ? active.year : parsed ? String(parsed.year) : "";
  const hintId = `${id}-hint`;

  function update(nextTerm: GradTermName | "", nextYear: string) {
    const next = gradTermFromSelection(nextTerm, nextYear, value);
    setDraft(next.partial ? { term: nextTerm, year: nextYear, base: value } : null);
    if (next.value !== value) onChange(next.value);
  }

  function chooseTerm(selected: string) {
    if (selected === AS_ENTERED) return setDraft(null);
    update(selected as GradTermName | "", year);
  }

  const shared = { className: selectClassName, "aria-invalid": invalid || undefined, "aria-describedby": [describedBy, hintId].filter(Boolean).join(" ") };
  return (
    <fieldset className="min-w-0">
      <legend className={legendClassName}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="sr-only">Graduation term</span>
          <select {...shared} id={id} value={term} onChange={(event) => chooseTerm(event.target.value)}>
            <option value="">Term</option>
            {asEntered && <option value={AS_ENTERED}>{asEntered} (as entered)</option>}
            {GRAD_TERMS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Graduation year</span>
          <select {...shared} id={`${id}-year`} value={year} onChange={(event) => update(term === AS_ENTERED ? "" : term as GradTermName | "", event.target.value)}>
            <option value="">Year</option>
            {gradYearOptions(baseYear, Number(year) || null).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <p id={hintId} aria-live="polite" className="mt-1 text-sm text-muted">{active ? "Pick a term and a year" : ""}</p>
      {name && <input type="hidden" name={name} value={value} />}
    </fieldset>
  );
}
