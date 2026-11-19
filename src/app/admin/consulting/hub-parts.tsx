// design-owner: client:mecg because it uses the MECG workspace design system (docs/DESIGN.md).
import type { HubEntry } from "@/lib/consulting-hub/catalog";
import { fileKind, formatBytes, formatUpdated } from "@/lib/consulting-hub/catalog";
import type { HubFile } from "@/lib/consulting-hub/format";
import { HUB_ROOT, hubDocHref, hubFileHref } from "@/lib/consulting-hub/paths";

export function FileLink({ file }: { file: HubFile }) {
  const opensInTab = file.inline;
  return (
    <a
      href={hubFileHref(file.id, file.name)}
      {...(opensInTab ? { target: "_blank", rel: "noopener" } : { download: file.name })}
      className="inline-flex min-h-11 max-w-full items-center gap-2 py-2 text-sm font-semibold text-mecg-blue underline decoration-line-strong underline-offset-4"
    >
      <span className="break-all">{file.name}</span>
      <span className="shrink-0 font-normal text-muted no-underline">{fileKind(file)} · {formatBytes(file.size)}</span>
      {opensInTab && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

export function EntryCard({ entry }: { entry: HubEntry }) {
  const extras = entry.docs.length + entry.files.length;
  const isLooseFile = !entry.lead && !entry.docs.length && entry.files.length === 1;
  const updated = formatUpdated(entry.updated);
  return (
    <article className="min-w-0 py-5">
      {isLooseFile ? (
        <FileLink file={entry.files[0]} />
      ) : (
        <>
          <h3 className="text-lg font-semibold tracking-heading text-mecg-navy">
            <a href={entry.href} className="underline decoration-line-strong underline-offset-4 hover:decoration-mecg-blue">{entry.title}</a>
          </h3>
          <p className="mt-1 text-sm text-muted">
            {[updated && `Updated ${updated}`, entry.docs.length && `${entry.docs.length + (entry.lead ? 1 : 0)} documents`, entry.files.length && `${entry.files.length} files`].filter(Boolean).join(" · ")}
          </p>
        </>
      )}
      {!isLooseFile && extras > 0 && (
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-mecg-blue">Everything in this folder ({extras})</summary>
          <EntryContents entry={entry} />
        </details>
      )}
    </article>
  );
}

export function EntryContents({ entry, currentSlug }: { entry: HubEntry; currentSlug?: string }) {
  const docs = entry.lead ? [entry.lead, ...entry.docs] : entry.docs;
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-wash p-4">
      {docs.length > 0 && (
        <ul className="flex flex-col">
          {docs.map((doc) => (
            <li key={doc.slug}>
              {doc.slug === currentSlug ? (
                <span aria-current="page" className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-navy">{doc.title}</span>
              ) : (
                <a href={hubDocHref(doc.slug)} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue underline decoration-line-strong underline-offset-4">{doc.title}</a>
              )}
            </li>
          ))}
        </ul>
      )}
      {entry.files.length > 0 && (
        <ul className="flex flex-col">
          {entry.files.map((file) => <li key={file.id} className="min-w-0"><FileLink file={file} /></li>)}
        </ul>
      )}
    </div>
  );
}

export function HubUnavailable({ message }: { message: string }) {
  return (
    <div id="workspace-content" className="rounded-xl border border-dashed border-line-strong p-6">
      <h2 className="text-lg font-semibold">The consulting hub isn&apos;t available</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}

export const backToHub = <a href={HUB_ROOT} className="button-secondary">All consulting</a>;
