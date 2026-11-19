// design-owner: client:mecg because it uses the MECG workspace design system (docs/DESIGN.md).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { HUB_UNAVAILABLE_MESSAGE, loadConsultingHub } from "@/lib/consulting-hub/load";
import { hubEntries, searchHub } from "@/lib/consulting-hub/catalog";
import { HUB_ROOT, hubDocHref } from "@/lib/consulting-hub/paths";
import { EntryCard, FileLink, HubUnavailable } from "./hub-parts";

export const metadata: Metadata = { title: "Consulting hub", robots: { index: false, follow: false } };

export default async function ConsultingHubPage({ searchParams }: { searchParams?: Promise<{ q?: string }> } = {}) {
  // Board only: this holds named contacts, unsent outreach and unapproved pricing.
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.slice(0, 200).trim() : "";
  const hub = await loadConsultingHub();

  const header = (
    <>
      <WorkspaceHeader
        eyebrow="Board only"
        title="Consulting hub"
        description="Every consulting plan, packet, prospect list and campaign the board has drafted for Winter 2027. Nothing here has been sent or approved."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current={HUB_ROOT} />
    </>
  );
  if (hub.status !== "ready") {
    return <main className="workspace-stack mx-auto flex max-w-5xl flex-col">{header}<HubUnavailable message={HUB_UNAVAILABLE_MESSAGE[hub.status]} /></main>;
  }
  const { manifest } = hub.bundle;
  const results = query ? searchHub(manifest, query) : [];

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      {header}
      <div id="workspace-content" className="flex min-w-0 flex-col gap-10">
        <form method="get" action={HUB_ROOT} role="search" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-end sm:p-6">
          <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">Search every document
            <input type="search" name="q" defaultValue={query} placeholder="Try a company, a person, “pricing” or a task ID" className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 font-normal" />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-mecg-blue px-4 text-sm font-semibold text-white">Search</button>
          {query && <a href={HUB_ROOT} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue underline underline-offset-4">Clear</a>}
        </form>

        {query ? (
          <section aria-labelledby="results-title">
            <h2 id="results-title" className="text-2xl font-semibold tracking-heading text-mecg-navy">
              {results.length ? `${results.length}${results.length === 60 ? "+" : ""} results for “${query}”` : `Nothing matches “${query}”`}
            </h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {results.map((result) => result.kind === "doc" ? (
                <li key={result.doc.slug} className="py-4">
                  <a href={hubDocHref(result.doc.slug)} className="text-lg font-semibold text-mecg-blue underline decoration-line-strong underline-offset-4">{result.doc.title}</a>
                  <p className="mt-1 text-xs font-semibold text-muted">{manifest.sections.find((section) => section.id === result.doc.sectionId)?.title}</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{result.snippet}</p>
                </li>
              ) : (
                <li key={result.file.id} className="py-2"><FileLink file={result.file} /></li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <article className="consulting-doc rounded-xl border border-line bg-white p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: manifest.overviewHtml }} />
            <nav aria-label="Hub sections" className="flex flex-wrap gap-3">
              {manifest.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-semibold text-mecg-blue hover:bg-wash">{section.title}</a>
              ))}
            </nav>
            {manifest.sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-8">
                <h2 id={`${section.id}-title`} className="text-2xl font-semibold tracking-heading text-mecg-navy">{section.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{section.description}</p>
                <div className="mt-4 divide-y divide-line border-y border-line">
                  {hubEntries(manifest, section.id).map((entry) => <EntryCard key={entry.key} entry={entry} />)}
                </div>
              </section>
            ))}
          </>
        )}
        <p className="text-sm leading-6 text-muted">
          Built {new Date(manifest.generatedAt).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" })} from the board operations workspace. Recheck names, titles and emails before contacting anyone. Don&apos;t forward contact lists outside the board.
        </p>
      </div>
    </main>
  );
}
