"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import { cycleStatusLabel } from "@/lib/labels";
import {
  RETENTION_MAX_MONTHS, retentionClock, retentionLabels, toolLabels,
  type Overview, type RetentionCategoryReport, type RetentionReport,
} from "@/lib/cycle-records/model";

const count = (value: number, one: string, many = `${one}s`) => `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const { response, body: data } = await fetchJsonWithTimeout(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    }, 15_000, (input, init) => authorizedFetch(input, init));
    const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : undefined;
    return { ok: response.ok, error };
  } catch {
    return { ok: false, error: "No response. Reload to check whether it saved before retrying." };
  }
}

function Unavailable({ title }: { title: string }) {
  return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="alert">
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load this. Reload to try again. If this page is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
}

export function CycleExportPanel({ overview, ownsCycle }: { overview: Overview | null; ownsCycle: boolean }) {
  const router = useRouter();
  if (!ownsCycle) return <section className="rounded-xl bg-wash p-5 text-sm leading-6">
    <h2 className="text-xl font-semibold text-mecg-navy">Export and archive</h2>
    <p className="mt-2 text-muted">Only the cycle’s Owner can export or archive it. Switch to a cycle you own to see its records.</p>
  </section>;
  if (!overview) return <Unavailable title="Cycle records are unavailable" />;
  const href = (format: "json" | "csv", section: "all" | "records" | "projects") =>
    `/api/admin/cycle-records?cycleId=${encodeURIComponent(overview.cycle.id)}&format=${format}&section=${section}`;
  // Each download is recorded as an export, which can unlock archiving; refresh
  // after it starts so the archive panel reflects it.
  const refreshSoon = () => window.setTimeout(() => router.refresh(), 2000);
  const withheld = overview.tools.filter((tool) => !tool.full && tool.records > 0);
  return <>
    <section aria-labelledby="export-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="export-heading" className="text-xl font-semibold text-mecg-navy">Export {overview.cycle.name ?? "this cycle"}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Member-tool records from this cycle, and every project with its team. Each download is logged in Activity.</p>
        </div>
        <StatusPill tone={overview.cycle.status === "ARCHIVED" ? "neutral" : overview.cycle.status === "CLOSED" ? "orange" : "navy"}>{cycleStatusLabel(overview.cycle.status)}</StatusPill>
      </header>
      <div>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">What the export contains</caption>
          <thead className="text-xs text-muted"><tr><th scope="col" className="py-2 pr-4 font-normal">Records</th><th scope="col" className="py-2 pr-4 text-right font-normal">Count</th><th scope="col" className="py-2 font-normal">In the export</th></tr></thead>
          <tbody>
            {overview.tools.map((tool) => <tr key={tool.kind} className="border-t border-line">
              <th scope="row" className="py-2 pr-4 font-semibold">{toolLabels[tool.kind]}</th>
              <td className="tabular py-2 pr-4 text-right">{tool.records.toLocaleString("en-US")}</td>
              <td className="py-2">{tool.full ? "Full content and review" : "Owner, dates and status only"}</td>
            </tr>)}
            <tr className="border-t border-line">
              <th scope="row" className="py-2 pr-4 font-semibold">Projects</th>
              <td className="tabular py-2 pr-4 text-right">{overview.projects.toLocaleString("en-US")}</td>
              <td className="py-2">Every project and its team. Projects aren’t tied to a cycle.</td>
            </tr>
          </tbody>
        </table>
      </div>
      {withheld.length > 0 && <p className="text-sm leading-6">
        Being Owner doesn’t open members’ private records. To include the content of {withheld.map((tool) => toolLabels[tool.kind]).join(" or ")}, give yourself reviewer access with the Owner controls on that tool’s page first. That grant is logged too.
      </p>}
      <div className="flex flex-wrap gap-3">
        <a href={href("json", "all")} onClick={refreshSoon} className="button-primary">Download everything (JSON)</a>
        <a href={href("csv", "records")} onClick={refreshSoon} className="button-secondary">Member-tool records (CSV)</a>
        <a href={href("csv", "projects")} onClick={refreshSoon} className="button-secondary">Projects (CSV)</a>
      </div>
      <p className="text-xs leading-5 text-muted">
        {overview.lastExportAt ? `Last exported ${formatEasternDateTime(overview.lastExportAt)}.` : "Not exported yet."} The file holds members’ records: keep it in the board’s restricted drive, not email.
      </p>
    </section>
    <ArchivePanel overview={overview} />
  </>;
}

function ArchivePanel({ overview }: { overview: Overview }) {
  const router = useRouter();
  const id = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { status, archivedAt } = overview.cycle;
  async function archive() {
    if (pending || !confirmed) return;
    setPending(true);
    setError("");
    const result = await postJson(`/api/admin/cycle-records?cycleId=${encodeURIComponent(overview.cycle.id)}`);
    setPending(false);
    if (!result.ok) { setError(result.error ?? "The cycle could not be archived. Reload to check its status."); return; }
    router.refresh();
  }
  let body;
  if (status === "ARCHIVED") {
    body = <p className="text-sm leading-6">Archived{archivedAt ? ` ${formatEasternDateTime(archivedAt)}` : ""}. Records stay readable and nothing has been deleted.</p>;
  } else if (status !== "CLOSED") {
    body = <p className="text-sm leading-6 text-muted">Close the cycle in Settings first. A closed cycle can be archived here after its records are exported.</p>;
  } else if (!overview.canArchive) {
    body = <p className="text-sm leading-6">Download the export above first. Archiving unlocks once an export has been logged since the cycle closed. Reload this page after the download if this message stays.</p>;
  } else {
    body = <div className="space-y-4">
      <p className="text-sm leading-6">Exported {formatEasternDateTime(overview.exportedSinceClose!)}. Archiving marks the cycle read-only history. It deletes nothing and can’t be undone here.</p>
      <label htmlFor={`${id}-confirm`} className="flex min-h-11 items-center gap-3 text-sm">
        <input id={`${id}-confirm`} type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="size-5" />
        I’ve saved the export somewhere the board can find it.
      </label>
      <button type="button" className="button-secondary" aria-disabled={pending || !confirmed} onClick={() => void archive()}>{pending ? "Archiving…" : "Archive cycle"}</button>
    </div>;
  }
  return <section aria-labelledby="archive-heading" className="space-y-3 rounded-xl bg-white p-5 inset-ring inset-ring-line">
    <h2 id="archive-heading" className="text-xl font-semibold text-mecg-navy">Archive</h2>
    {body}
    <p role="alert" className="text-sm leading-6 text-danger">{error}</p>
  </section>;
}

function RetentionRow({ entry }: { entry: RetentionCategoryReport }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(entry.keepMonths === null ? "" : String(entry.keepMonths));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  async function save() {
    if (pending) return;
    const trimmed = value.trim();
    const months = trimmed === "" ? null : Number(trimmed);
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > RETENTION_MAX_MONTHS)) {
      setMessage({ text: `Enter 1 to ${RETENTION_MAX_MONTHS} whole months, or leave it blank.`, error: true });
      return;
    }
    setPending(true);
    setMessage({ text: "", error: false });
    const result = await postJson("/api/admin/retention", { category: entry.category, keepMonths: months, revision: entry.revision });
    setPending(false);
    if (!result.ok) { setMessage({ text: result.error ?? "Could not save. Reload to check the current period.", error: true }); return; }
    setMessage({ text: months === null ? "Saved. No period set." : `Saved. The report below now counts against ${months} months.`, error: false });
    router.refresh();
  }
  return <div className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label htmlFor={`${id}-months`} className="block min-w-0 grow text-sm font-semibold">{retentionLabels[entry.category]}
        <span className="mt-1 block text-xs font-normal text-muted">Months to keep, {retentionClock[entry.category]}. Blank means no period set.</span>
        <input id={`${id}-months`} inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Not set" className="field-control mt-2 min-h-11 max-w-40" />
      </label>
      <button type="submit" className="button-secondary" aria-disabled={pending}>{pending ? "Saving…" : "Save period"}</button>
    </form>
    <p role="status" aria-live="polite" className={`text-sm leading-6 ${message.error ? "text-danger" : "text-success"}`}>{message.text}</p>
    <DryRun entry={entry} />
  </div>;
}

function DryRun({ entry }: { entry: RetentionCategoryReport }) {
  if (entry.keepMonths === null || entry.eligible === null) return <p className="rounded-xl bg-wash p-4 text-sm leading-6 text-muted">No period set, so nothing is counted.</p>;
  const noun = entry.category === "audit_events" ? "activity entry" : "record";
  const nouns = entry.category === "audit_events" ? "activity entries" : "records";
  return <div className="rounded-xl bg-wash p-4 text-sm leading-6">
    <p><span className="font-semibold"><span className="tabular">{entry.eligible.toLocaleString("en-US")}</span> {entry.eligible === 1 ? noun : nouns}</span> {entry.eligible === 1 ? "is" : "are"} older than {count(entry.keepMonths, "month")} and would be in scope. Nothing has been removed.</p>
    {entry.byCycle && entry.byCycle.length > 0 && <ul className="mt-2 space-y-1">
      {entry.byCycle.map((row) => <li key={row.cycleId} className="break-words">
        {row.cycleName ?? row.cycleId}: <span className="tabular">{row.records.toLocaleString("en-US")}</span> {row.records === 1 ? "record" : "records"}, archived {formatEasternDateTime(row.archivedAt)}
      </li>)}
    </ul>}
  </div>;
}

export function RetentionPanel({ report }: { report: RetentionReport | null }) {
  if (!report) return <Unavailable title="Retention settings are unavailable" />;
  return <section aria-labelledby="retention-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
    <div>
      <h2 id="retention-heading" className="text-xl font-semibold text-mecg-navy">Retention dry run</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Record how long the club means to keep each kind of record and see what that period would cover. This is a report only. Nothing is ever deleted from this page, and no period is set until the board approves one. Counts are for every cycle.
      </p>
    </div>
    {report.categories.map((entry) => <RetentionRow key={entry.category} entry={entry} />)}
    <p className="text-xs leading-5 text-muted">Counted {formatEasternDateTime(report.generatedAt)}. Applicant data has its own retention process and isn’t counted here.</p>
  </section>;
}
