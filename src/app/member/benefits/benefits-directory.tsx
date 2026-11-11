"use client";

import { useState } from "react";
import { benefits } from "./catalog";
import { filterBenefits } from "./filter";

const categories = Array.from(new Set(benefits.map((benefit) => benefit.category)));

export default function BenefitsDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [studentOnly, setStudentOnly] = useState(false);
  const visible = filterBenefits(benefits, { query, category, freeOnly, studentOnly });
  const filtered = Boolean(query || category || freeOnly || studentOnly);
  function clearFilters() {
    setQuery(""); setCategory(""); setFreeOnly(false); setStudentOnly(false);
  }

  return <section aria-label="Benefits directory" className="flex flex-col gap-6">
    <div className="rounded-xl border border-line bg-white p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
          Search resources
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Excel, interview prep, design…" className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 font-normal" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="select-control min-h-11 w-full font-normal">
            <option value="">All categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />Free access available</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={studentOnly} onChange={(event) => setStudentOnly(event.target.checked)} />Student benefits</label>
        {filtered && <button type="button" onClick={clearFilters} className="min-h-11 text-mecg-blue underline underline-offset-4">Clear filters</button>}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">Free access may be limited to selected content, a student account or a fixed period. Check the terms before signing up.</p>
    </div>

    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">Showing {visible.length} of {benefits.length} resources</p>
    {!visible.length && <div className="rounded-xl border border-dashed border-line-strong p-6">
      <h2 className="text-lg font-semibold">No resources match</h2>
      <p className="mt-2 text-sm text-muted">Try a broader search or remove a filter.</p>
      <button type="button" onClick={clearFilters} className="mt-4 min-h-11 text-mecg-blue underline underline-offset-4">Show all resources</button>
    </div>}

    <div className="divide-y divide-line border-y border-line">
      {visible.map((benefit) => <article key={benefit.id} className="py-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-muted">
          <span>{benefit.category}</span>
          {benefit.freeAccess && <span className="rounded-md bg-mecg-blue/10 px-2 py-1 text-mecg-blue">Free access available</span>}
          {benefit.studentBenefit && <span>Student benefit</span>}
          {(benefit.evidence === "limited read" || benefit.evidence === "blocked read") && <span className="text-warning">Needs verification</span>}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-heading text-mecg-navy">
          <a href={benefit.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-4 hover:text-mecg-blue">{benefit.name}<span className="sr-only"> — provider website, opens in a new tab</span><span aria-hidden="true"> ↗</span></a>
        </h2>
        <p className="mt-2 max-w-3xl text-base leading-7">{benefit.description}.</p>
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-mecg-blue">Eligibility, cost and how to access</summary>
          <dl className="flex max-w-3xl flex-col gap-4 rounded-xl bg-wash p-4 leading-6">
            <div><dt className="font-semibold">Cost</dt><dd className="text-muted">{benefit.cost}</dd></div>
            <div><dt className="font-semibold">Eligibility and limits</dt><dd className="text-muted">{benefit.terms}</dd></div>
            <div><dt className="font-semibold">How to access</dt><dd className="text-muted">{benefit.steps}</dd></div>
            <div><dt className="font-semibold">Source review</dt><dd className="text-muted">{benefit.evidence === "provider page" ? "Provider page reviewed" : benefit.evidence === "provider search" ? "Provider search listing reviewed; full terms still need checking" : "Page content could not be fully reviewed"} · {benefit.checked}. Individual access has not been tested.</dd></div>
          </dl>
        </details>
      </article>)}
    </div>
  </section>;
}
