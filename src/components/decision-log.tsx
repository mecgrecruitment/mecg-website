"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import {
  categoryLabels, decisionCategories, decisionOutcomes, filterDecisions, formatVotes, outcomeLabels,
  SUMMARY_LIMIT, TITLE_LIMIT, URL_LIMIT, VOTE_LIMIT,
  type Decision, type DecisionCategory, type DecisionFilter, type DecisionLog as Log, type DecisionOutcome,
} from "@/lib/decisions/model";

const field = "field-control mt-2 min-h-11";
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

// A decision date is a calendar day, so format it without a time zone shift.
export function formatDecisionDate(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function outcomeTone(outcome: DecisionOutcome): "navy" | "orange" | "neutral" {
  if (outcome === "APPROVED") return "navy";
  if (outcome === "DEFERRED") return "orange";
  return "neutral";
}

// Each successful save remounts its form with fresh values (a new create form,
// or the edit form keyed on the new revision), so the success message and the
// focus live in a status region the parent owns.
function SavedNotice({ text, focusRef }: { text: string; focusRef: RefObject<HTMLParagraphElement | null> }) {
  return <p ref={focusRef} tabIndex={-1} role="status" aria-live="polite" className="min-h-6 text-sm leading-6 text-success">{text}</p>;
}

function useSavedNotice() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLParagraphElement>(null);
  return { text, ref, announce(message: string) { setText(message); requestAnimationFrame(() => ref.current?.focus()); } };
}

function DecisionForm({ decision, onSaved }: { decision: Decision | null; onSaved: () => void }) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  const [voted, setVoted] = useState(decision ? decision.votes !== null : true);
  const locked = useRef(false);

  async function submit(form: HTMLFormElement) {
    if (locked.current) return;
    const data = new FormData(form);
    const count = (name: string) => Number(data.get(name) ?? "");
    const payload = {
      id: decision?.id ?? null,
      revision: decision?.revision ?? 0,
      decision: {
        decidedOn: String(data.get("decidedOn") ?? ""),
        title: String(data.get("title") ?? ""),
        category: String(data.get("category") ?? ""),
        outcome: String(data.get("outcome") ?? ""),
        summary: String(data.get("summary") ?? ""),
        votes: voted ? { for: count("for"), against: count("against"), abstain: count("abstain") } : null,
        minutesUrl: String(data.get("minutesUrl") ?? ""),
      },
    };
    locked.current = true; setPending(true); setNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/board/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Save could not be confirmed. Reload to check before retrying.";
        setNotice({ text: message });
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setNotice({ text: "Save could not be confirmed. Your entry is still here. Reload to check before retrying." });
    } finally { locked.current = false; setPending(false); }
  }

  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <label htmlFor={`${id}-date`} className="block text-sm font-semibold">Decided on
        <input id={`${id}-date`} name="decidedOn" type="date" required defaultValue={decision?.decidedOn ?? ""} className={field} />
      </label>
      <label htmlFor={`${id}-title`} className="block text-sm font-semibold">Decision
        <input id={`${id}-title`} name="title" required maxLength={TITLE_LIMIT} defaultValue={decision?.title ?? ""} placeholder="Adopt the spring dues schedule" className={field} />
      </label>
      <label htmlFor={`${id}-category`} className="block text-sm font-semibold">Category
        <select id={`${id}-category`} name="category" required defaultValue={decision?.category ?? ""} className={field}>
          <option value="" disabled>Choose…</option>
          {decisionCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-outcome`} className="block text-sm font-semibold">Outcome
        <select id={`${id}-outcome`} name="outcome" required defaultValue={decision?.outcome ?? ""} className={field}>
          <option value="" disabled>Choose…</option>
          {decisionOutcomes.map((value) => <option key={value} value={value}>{outcomeLabels[value]}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-summary`} className="block text-sm font-semibold sm:col-span-2">What was decided and why · optional
        <textarea id={`${id}-summary`} name="summary" maxLength={SUMMARY_LIMIT} defaultValue={decision?.summary ?? ""} className="field-control mt-2 min-h-20 py-3 text-sm" />
      </label>
    </div>

    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Vote</legend>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={voted} onChange={(event) => setVoted(event.target.checked)} className="size-5" />
        A vote was taken
      </label>
      {voted
        ? <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {([["for", "For"], ["against", "Against"], ["abstain", "Abstained"]] as const).map(([name, label]) =>
            <label key={name} className="block text-xs font-semibold">{label}
              <input name={name} type="number" inputMode="numeric" required min={0} max={VOTE_LIMIT} step={1} defaultValue={decision?.votes?.[name] ?? 0} className={`${field} tabular`} />
            </label>)}
        </div>
        : <p className="text-sm text-muted">Recorded as decided without a vote.</p>}
    </fieldset>

    <label htmlFor={`${id}-minutes`} className="block text-sm font-semibold">Minutes link · optional
      <input id={`${id}-minutes`} name="minutesUrl" type="url" pattern="https://.*" maxLength={URL_LIMIT} defaultValue={decision?.minutesUrl ?? ""} placeholder="https://" className={field} />
      <span className="mt-1 block text-xs font-normal text-muted">A link to the minutes where they are kept. Anyone with the link’s own access can open it; this log does not change who can.</span>
    </label>

    <button type="submit" className="button-primary" aria-disabled={pending}>{pending ? "Saving…" : decision ? "Save changes" : "Record decision"}</button>
    <p role="alert" className="text-sm leading-6 text-danger">{notice?.text ?? ""}</p>
  </form>;
}

function Entry({ decision }: { decision: Decision }) {
  const edited = decision.revision > 1;
  const saved = useSavedNotice();
  return <article className="space-y-3 rounded-xl bg-paper p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="tabular text-xs text-muted"><time dateTime={decision.decidedOn}>{formatDecisionDate(decision.decidedOn)}</time></p>
        <h3 className="mt-1 break-words text-lg font-semibold text-mecg-navy">{decision.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="neutral">{categoryLabels[decision.category]}</StatusPill>
        <StatusPill tone={outcomeTone(decision.outcome)}>{outcomeLabels[decision.outcome]}</StatusPill>
      </div>
    </header>
    {decision.summary && <p className="whitespace-pre-line break-words text-sm leading-6">{decision.summary}</p>}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted">Vote</dt><dd className="tabular">{formatVotes(decision.votes)}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted">Minutes</dt><dd className="break-all">{decision.minutesUrl
        ? <a href={decision.minutesUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-mecg-blue underline underline-offset-4">Open minutes<span className="sr-only"> for {decision.title} (opens in a new tab)</span></a>
        : "No link"}</dd></div>
    </dl>
    <p className="text-xs text-muted">
      Recorded {formatEasternDateTime(decision.createdAt)}{decision.createdByName ? ` by ${decision.createdByName}` : ""}
      {edited ? ` · edited ${formatEasternDateTime(decision.updatedAt)}${decision.updatedByName ? ` by ${decision.updatedByName}` : ""}` : ""}
    </p>
    <details className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Edit<span className="sr-only"> {decision.title}</span></summary>
      <p className="mt-3 text-xs leading-5 text-muted">Entries are never deleted. Correct the record here, or set the outcome to Withdrawn. Every edit is kept in the activity log.</p>
      <div className="mt-4"><DecisionForm key={decision.revision} decision={decision} onSaved={() => saved.announce("Decision updated.")} /></div>
      <SavedNotice text={saved.text} focusRef={saved.ref} />
    </details>
  </article>;
}

function Filters({ filter, onChange, shown, total }: { filter: DecisionFilter; onChange: (filter: DecisionFilter) => void; shown: number; total: number }) {
  const id = useId();
  return <div className="space-y-2">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <label htmlFor={`${id}-q`} className="block text-sm font-semibold">Search
        <input id={`${id}-q`} type="search" value={filter.query} onChange={(event) => onChange({ ...filter, query: event.target.value })} placeholder="Words in the decision or summary" className={field} />
      </label>
      <label htmlFor={`${id}-c`} className="block text-sm font-semibold">Category
        <select id={`${id}-c`} value={filter.category} onChange={(event) => onChange({ ...filter, category: event.target.value as DecisionCategory | "" })} className={field}>
          <option value="">All</option>
          {decisionCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-o`} className="block text-sm font-semibold">Outcome
        <select id={`${id}-o`} value={filter.outcome} onChange={(event) => onChange({ ...filter, outcome: event.target.value as DecisionOutcome | "" })} className={field}>
          <option value="">All</option>
          {decisionOutcomes.map((value) => <option key={value} value={value}>{outcomeLabels[value]}</option>)}
        </select>
      </label>
    </div>
    <p role="status" aria-live="polite" className="tabular text-xs text-muted">{shown === total ? `${total} ${total === 1 ? "decision" : "decisions"}` : `Showing ${shown} of ${total}`}</p>
  </div>;
}

export default function DecisionLog({ log }: { log: Log | null }) {
  const [filter, setFilter] = useState<DecisionFilter>({ category: "", outcome: "", query: "" });
  const [formKey, setFormKey] = useState(0);
  const created = useSavedNotice();
  if (!log) return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="alert">
    <h2 className="text-lg font-semibold">The decision log is unavailable</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load board decisions. Reload to try again. If the log is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
  const shown = filterDecisions(log.decisions, filter);
  return <>
    <section aria-labelledby="record-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <div>
        <h2 id="record-heading" className="text-xl font-semibold text-mecg-navy">Record a decision</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Visible to active board members and owners only.</p>
      </div>
      <DecisionForm key={formKey} decision={null} onSaved={() => { setFormKey((key) => key + 1); created.announce(`Decision recorded at ${formatEasternDateTime(new Date())}. It is in the log below.`); }} />
      <SavedNotice text={created.text} focusRef={created.ref} />
    </section>
    <section aria-labelledby="log-heading" className="space-y-4">
      <h2 id="log-heading" className="text-xl font-semibold text-mecg-navy">Log</h2>
      {log.decisions.length === 0
        ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No decisions recorded yet. The first one you record above appears here, newest first.</p>
        : <>
          <Filters filter={filter} onChange={setFilter} shown={shown.length} total={log.decisions.length} />
          {shown.length === 0
            ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No decisions match these filters.</p>
            : shown.map((decision) => <Entry key={decision.id} decision={decision} />)}
        </>}
    </section>
  </>;
}
