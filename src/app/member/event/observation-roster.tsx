"use client";

import { useId, useState } from "react";
import ImpressionForm from "./impression-form";
import type { ObservationRow } from "./page";

export default function ObservationRoster({ eventId, rows }: { eventId: string; rows: ObservationRow[] }) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (row: ObservationRow) => row.applicant_name.toLocaleLowerCase().includes(normalized);
  const visibleCount = rows.filter(matches).length;
  const firstUnobservedId = rows.find((row) => !row.observation_id)?.application_id;

  if (!rows.length) return <div className="mt-4 rounded-xl border border-dashed border-line p-6"><h3 className="font-semibold">No applicants available</h3><p className="mt-1 text-sm text-muted">Checked-in applicants will appear here, minus your declared conflicts. Check-in controls visibility only; it is never scoring evidence.</p></div>;

  return <div className="mt-4">
    <label htmlFor={searchId} className="text-sm font-semibold">Find an applicant you spoke with</label>
    <div className="mt-2 flex items-center gap-2">
      <input id={searchId} type="search" className="field-control min-w-0 flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a name" autoComplete="off" />
      {query && <button type="button" className="button-secondary min-h-11" onClick={() => setQuery("")}>Clear</button>}
    </div>
    <p className="mt-2 text-xs text-muted" role="status">{visibleCount} {visibleCount === 1 ? "applicant" : "applicants"}{normalized ? " match your search" : " available"}. Record only conversations you actually observed.</p>
    {!visibleCount && <p className="py-6 text-sm text-muted">No applicant matches “{query.trim()}”. Check the name or clear your search.</p>}
    <div className="mt-3 divide-y divide-line">
      {/* Keep filtered forms mounted so searching never discards an unsaved note. */}
      {rows.map((row) => <article key={row.application_id} hidden={!matches(row)} className="py-4">
        <h3 className="text-base font-semibold">{row.applicant_name}</h3>
        <details className="mt-2" open={row.application_id === firstUnobservedId}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{row.observation_id ? "Observation saved · edit" : "Add an observation"}</summary>
          <ImpressionForm eventId={eventId} applicationId={row.application_id} initial={{ tags: row.tags ?? [], note: row.note ?? "" }} />
        </details>
      </article>)}
    </div>
  </div>;
}
