// design-owner: client:mecg because it uses the MECG workspace design system (docs/DESIGN.md).
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireBoard } from "@/lib/auth";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { HUB_UNAVAILABLE_MESSAGE, findHubDoc, loadConsultingHub } from "@/lib/consulting-hub/load";
import { entryForDoc, formatUpdated } from "@/lib/consulting-hub/catalog";
import { HUB_ROOT } from "@/lib/consulting-hub/paths";
import { EntryContents, HubUnavailable, backToHub } from "../hub-parts";

// The title would name a target company, so it stays generic in the tab and history.
export const metadata: Metadata = { title: "Consulting hub", robots: { index: false, follow: false } };

export default async function ConsultingDocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const user = await requireBoard();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const { slug } = await params;
  const hub = await loadConsultingHub();
  if (hub.status !== "ready") {
    return (
      <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
        <WorkspaceHeader eyebrow="Board only" title="Consulting hub" action={backToHub} />
        <WorkspaceNav user={user} cycleId={cycleId} current={HUB_ROOT} />
        <HubUnavailable message={HUB_UNAVAILABLE_MESSAGE[hub.status]} />
      </main>
    );
  }
  const { manifest } = hub.bundle;
  const doc = findHubDoc(hub.bundle, slug.map((part) => decodeURIComponent(part)).join("/"));
  if (!doc) notFound();
  const section = manifest.sections.find((item) => item.id === doc.sectionId);
  const entry = entryForDoc(manifest, doc);
  const siblings = entry && entry.docs.length + entry.files.length + (entry.lead ? 1 : 0) > 1 ? entry : null;
  const updated = formatUpdated(doc.updated);

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader eyebrow={`Consulting hub · ${section?.title ?? "Board only"}`} title={doc.title} action={backToHub} />
      <WorkspaceNav user={user} cycleId={cycleId} current={HUB_ROOT} />
      <div id="workspace-content" className="flex min-w-0 flex-col gap-6">
        <p className="text-sm text-muted">
          <span className="break-all font-mono text-xs">{doc.sourcePath}</span>
          {updated && <> · Updated {updated}</>}
        </p>
        <article className="consulting-doc min-w-0 rounded-xl border border-line bg-white p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
        {siblings && (
          <section aria-labelledby="folder-title">
            <h2 id="folder-title" className="text-lg font-semibold tracking-heading text-mecg-navy">In this folder: {siblings.title}</h2>
            <div className="mt-3"><EntryContents entry={siblings} currentSlug={doc.slug} /></div>
          </section>
        )}
      </div>
    </main>
  );
}
