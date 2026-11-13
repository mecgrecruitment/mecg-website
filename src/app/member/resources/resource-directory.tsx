import { resourceGroups } from "./catalog";

export default function ResourceDirectory({ query = "", category = "", cycleId = "" }: { query?: string; category?: string; cycleId?: string }) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visibleGroups = resourceGroups.filter((group) => !category || group.id === category).map((group) => ({ ...group, resources: group.resources.filter((resource) => {
    const text = [group.title, resource.title, resource.purpose, resource.format, resource.period, ...resource.sources.map((source) => source.title)].join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  }) })).filter((group) => group.resources.length);
  const resetHref = cycleId ? `/member/resources?${new URLSearchParams({ cycleId })}` : "/member/resources";
  return <div id="workspace-content" className="flex min-w-0 flex-col gap-8">
    <div className="border-l-2 border-mecg-orange pl-4 text-sm leading-6 text-muted">
      <p>Curated November 12, 2026. Official resources complement MECG’s consulting templates and workshop decks. Drive file contents and master versions still need review; original files are unchanged.</p>
      <p className="mt-2">Use the Google account with access to MECG resources. If Google denies access, switch accounts or use its request-access option. Website membership does not grant Drive access.</p>
    </div>
    <form method="get" className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-3 sm:p-6">
      {cycleId && <input type="hidden" name="cycleId" value={cycleId} />}
      <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">Search club resources
        <input type="search" name="q" defaultValue={query} placeholder="Try case practice, Excel, project plan…" className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 font-normal" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">Category
        <select name="category" defaultValue={category} className="select-control min-h-11 w-full font-normal">
          <option value="">All categories</option>
          {resourceGroups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        <button type="submit" className="min-h-11 rounded-lg bg-mecg-blue px-4 text-sm font-semibold text-white">Find resources</button>
        {(query || category) && <a href={resetHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue underline underline-offset-4">Clear filters</a>}
        <p role="status" className="text-sm text-muted">{visibleGroups.reduce((count, group) => count + group.resources.length, 0)} resources found</p>
      </div>
    </form>
    {!visibleGroups.length && <div className="rounded-xl border border-dashed border-line-strong p-6"><h2 className="text-lg font-semibold">No resources match</h2><p className="mt-2 text-sm text-muted">Try a broader search or clear your filters.</p></div>}
    <nav aria-label="Resource sections" className="flex flex-wrap gap-3">
      {visibleGroups.map((group) => <a key={group.id} href={`#${group.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-semibold text-mecg-blue hover:bg-wash">{group.title}</a>)}
    </nav>
    {visibleGroups.map((group) => <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-8">
      <h2 id={`${group.id}-title`} className="text-2xl font-semibold tracking-heading text-mecg-navy">{group.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{group.description}</p>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {group.resources.map((resource) => <article key={resource.id} className="min-w-0 py-6">
          <p className="text-xs font-semibold text-muted">{resource.format} · {resource.period}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-heading text-mecg-navy">{resource.title}</h3>
          <p className="mt-2 max-w-3xl text-base leading-7">{resource.purpose}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{resource.access}</p>
          <ul className="mt-3 flex flex-col items-start gap-2">
            {resource.sources.map((source) => <li key={source.url} className="min-w-0 max-w-full">
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 break-words py-2 text-sm font-semibold text-mecg-blue underline decoration-line-strong underline-offset-4">
                Open {source.title}<span aria-hidden="true"> ↗</span><span className="sr-only"> — {resource.sourceKind === "drive" ? "Google Drive" : "provider website"}, opens in a new tab</span>
              </a>
            </li>)}
          </ul>
          <details className="mt-2 max-w-3xl text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-mecg-blue">Before using this resource</summary>
            <p className="rounded-lg bg-wash p-4 leading-6 text-muted">{resource.guidance}</p>
          </details>
        </article>)}
      </div>
    </section>)}
    <p className="text-sm leading-6 text-muted">Public provider pages were reviewed; sign-ups, downloads and software entitlements were not tested. This collection is not an automatic sync or a complete Drive inventory. Personal worksheets, rosters, contacts and client deliverables are outside this collection.</p>
  </div>;
}
