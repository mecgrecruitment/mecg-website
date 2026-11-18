"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import {
  availableActions, budgetCategories, categoryLabels, formatCents, kindLabels, orderForBoard, parseDollars, requestKinds,
  requestStatuses, statusLabels, summarizeRequests,
  DECISION_NOTE_LIMIT, NOTES_LIMIT, PAYMENT_NOTE_LIMIT, TITLE_LIMIT, URL_LIMIT,
  type BudgetAction, type BudgetRequest, type BudgetRequestList, type RequestKind, type RequestStatus, type Tally,
} from "@/lib/budget/model";

const field = "field-control mt-2 min-h-11";
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const UNCONFIRMED = "Save could not be confirmed. Reload to check before retrying.";

// Spent and paid dates are calendar days, so format them without a time zone shift.
export function formatDay(value: string): string {
  return dayFormat.format(new Date(`${value}T00:00:00Z`));
}

function statusTone(status: RequestStatus): "navy" | "orange" | "neutral" {
  if (status === "SUBMITTED") return "orange";
  if (status === "APPROVED" || status === "PAID") return "navy";
  return "neutral";
}

async function post(url: string, payload: unknown): Promise<string | null> {
  try {
    const { response, body } = await fetchJsonWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
    if (response.ok && body && typeof body === "object" && "ok" in body && body.ok === true) return null;
    return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : UNCONFIRMED;
  } catch {
    return `${UNCONFIRMED} Your entry is still here.`;
  }
}

// A saved request can move to another group or remount its form, so the
// success message and the focus live in one region the page owns.
type Announce = (message: string) => void;
function SavedNotice({ text, focusRef }: { text: string; focusRef: RefObject<HTMLParagraphElement | null> }) {
  return <p ref={focusRef} tabIndex={-1} role="status" aria-live="polite" className={text ? "text-sm leading-6 text-success" : "sr-only"}>{text}</p>;
}
function useSavedNotice() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLParagraphElement>(null);
  const announce: Announce = (message) => { setText(message); requestAnimationFrame(() => ref.current?.focus()); };
  return { text, ref, announce };
}

function useSubmit(onSuccess: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function run(url: string, payload: unknown) {
    if (locked.current) return;
    locked.current = true; setPending(true); setError("");
    try {
      const failure = await post(url, payload);
      if (failure) { setError(failure); return; }
      onSuccess();
      router.refresh();
    } finally { locked.current = false; setPending(false); }
  }
  return { pending, error, setError, run };
}

function RequestForm({ request, onSaved }: { request: BudgetRequest | null; onSaved: () => void }) {
  const id = useId();
  const [kind, setKind] = useState<RequestKind>(request?.kind ?? "REIMBURSEMENT");
  const submit = useSubmit(onSaved);
  // An approved request only takes a receipt link; everything else is fixed.
  const receiptOnly = request?.status === "APPROVED";

  function send(form: HTMLFormElement) {
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "");
    const receiptUrl = value("receiptUrl");
    let payload;
    if (receiptOnly && request) {
      payload = { kind: request.kind, title: request.title, category: request.category, amountCents: request.amountCents, spentOn: request.spentOn, receiptUrl, notes: request.notes };
    } else {
      const amountCents = parseDollars(value("amount"));
      if (amountCents === null) { submit.setError("Give an amount from $0.01 to $10,000.00, like 84.50."); return; }
      payload = { kind, title: value("title"), category: value("category"), amountCents, spentOn: value("spentOn") || null, receiptUrl, notes: value("notes") };
    }
    void submit.run("/api/member/budget", { id: request?.id ?? null, revision: request?.revision ?? 0, request: payload });
  }

  const receipt = <label htmlFor={`${id}-receipt`} className="block text-sm font-semibold">Receipt link{receiptOnly ? "" : " · optional"}
    <input id={`${id}-receipt`} name="receiptUrl" type="url" pattern="https://.*" maxLength={URL_LIMIT} defaultValue={request?.receiptUrl ?? ""} placeholder="https://" className={field} />
    <span className="mt-1 block text-xs font-normal text-muted">A link to a photo or PDF of the receipt in the club drive. Whoever opens it needs the drive’s own access.</span>
  </label>;

  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); send(event.currentTarget); }}>
    {receiptOnly ? receipt : <>
      <fieldset>
        <legend className="text-sm font-semibold">What you need</legend>
        <div className="mt-2 flex flex-wrap gap-x-6">
          {requestKinds.map((value) => <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="size-5" />
            {kindLabels[value]}
          </label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-title`} className="block text-sm font-semibold sm:col-span-2">What it’s for
          <input id={`${id}-title`} name="title" required maxLength={TITLE_LIMIT} defaultValue={request?.title ?? ""} placeholder="Pizza for the case workshop" className={field} />
        </label>
        <label htmlFor={`${id}-category`} className="block text-sm font-semibold">Budget area
          <select id={`${id}-category`} name="category" required defaultValue={request?.category ?? ""} className={field}>
            <option value="" disabled>Choose…</option>
            {budgetCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-amount`} className="block text-sm font-semibold">Amount (USD)
          <input id={`${id}-amount`} name="amount" required inputMode="decimal" autoComplete="off" defaultValue={request ? (request.amountCents / 100).toFixed(2) : ""} placeholder="84.50" className={`${field} tabular`} />
        </label>
        <label htmlFor={`${id}-spent`} className="block text-sm font-semibold">{kind === "REIMBURSEMENT" ? "Date you paid" : "Date you plan to buy · optional"}
          <input id={`${id}-spent`} name="spentOn" type="date" required={kind === "REIMBURSEMENT"} defaultValue={request?.spentOn ?? ""} className={field} />
        </label>
      </div>
      {receipt}
      <label htmlFor={`${id}-notes`} className="block text-sm font-semibold">Notes for the board · optional
        <textarea id={`${id}-notes`} name="notes" maxLength={NOTES_LIMIT} defaultValue={request?.notes ?? ""} className="field-control mt-2 min-h-20 py-3 text-sm" />
        <span className="mt-1 block text-xs font-normal text-muted">Don’t put card or bank numbers here. The treasurer pays you outside this site.</span>
      </label>
    </>}
    <button type="submit" className="button-primary" aria-disabled={submit.pending}>{submit.pending ? "Saving…" : !request ? "Send request" : receiptOnly ? "Save receipt link" : "Save changes"}</button>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function WithdrawForm({ request, announce }: { request: BudgetRequest; announce: Announce }) {
  const submit = useSubmit(() => announce(`“${request.title}” withdrawn.`));
  return <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void submit.run("/api/member/budget/actions", { id: request.id, revision: request.revision, action: "WITHDRAW", payload: {} }); }}>
    <p className="text-xs leading-5 text-muted">Withdraw a request you no longer need. It stays in the record as withdrawn.</p>
    <button type="submit" className="button-secondary" aria-disabled={submit.pending}>{submit.pending ? "Withdrawing…" : "Withdraw request"}<span className="sr-only"> {request.title}</span></button>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function DecideForm({ request, announce }: { request: BudgetRequest; announce: Announce }) {
  const id = useId();
  const step = useRef<"APPROVE" | "DENY">("APPROVE");
  const submit = useSubmit(() => announce(`“${request.title}” ${step.current === "APPROVE" ? "approved" : "denied"}.`));
  function send(form: HTMLFormElement) {
    const note = String(new FormData(form).get("note") ?? "").trim();
    if (step.current === "DENY" && !note) { submit.setError("Say why the request is denied. The member sees this note."); return; }
    void submit.run("/api/member/budget/actions", { id: request.id, revision: request.revision, action: step.current, payload: { note } });
  }
  return <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); send(event.currentTarget); }}>
    <label htmlFor={`${id}-note`} className="block text-sm font-semibold">Note to the member · needed to deny
      <textarea id={`${id}-note`} name="note" maxLength={DECISION_NOTE_LIMIT} className="field-control mt-2 min-h-16 py-3 text-sm" />
    </label>
    <div className="flex flex-wrap gap-3">
      <button type="submit" className="button-primary" aria-disabled={submit.pending} onClick={() => { step.current = "APPROVE"; }}>Approve<span className="sr-only"> {request.title}</span></button>
      <button type="submit" className="button-secondary" aria-disabled={submit.pending} onClick={() => { step.current = "DENY"; }}>Deny<span className="sr-only"> {request.title}</span></button>
    </div>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function PaidForm({ request, announce }: { request: BudgetRequest; announce: Announce }) {
  const id = useId();
  const submit = useSubmit(() => announce(`“${request.title}” recorded as paid.`));
  function send(form: HTMLFormElement) {
    const data = new FormData(form);
    void submit.run("/api/member/budget/actions", { id: request.id, revision: request.revision, action: "MARK_PAID", payload: { paidOn: String(data.get("paidOn") ?? ""), paymentNote: String(data.get("paymentNote") ?? "") } });
  }
  return <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); send(event.currentTarget); }}>
    <p className="text-xs leading-5 text-muted">Record a payment someone already made. This site does not send money.</p>
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <label htmlFor={`${id}-paid`} className="block text-sm font-semibold">Paid on
        <input id={`${id}-paid`} name="paidOn" type="date" required className={field} />
      </label>
      <label htmlFor={`${id}-ref`} className="block text-sm font-semibold">How it was paid · optional
        <input id={`${id}-ref`} name="paymentNote" maxLength={PAYMENT_NOTE_LIMIT} placeholder="Club Venmo, check 1042" className={field} />
      </label>
    </div>
    <button type="submit" className="button-primary" aria-disabled={submit.pending}>{submit.pending ? "Saving…" : "Record as paid"}<span className="sr-only"> {request.title}</span></button>
    <p role="alert" className="text-sm leading-6 text-danger">{submit.error}</p>
  </form>;
}

function RequestCard({ request, viewer, announce }: { request: BudgetRequest; viewer: "member" | "board"; announce: Announce }) {
  const steps = availableActions(request, viewer);
  const editable = viewer === "member" && request.isMine && (request.status === "SUBMITTED" || request.status === "APPROVED");
  const has = (action: BudgetAction) => steps.includes(action);
  return <article className="space-y-3 rounded-xl bg-paper p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted">{kindLabels[request.kind]}{viewer === "board" ? ` · ${request.isMine ? "your request" : request.requesterName ?? "Former member"}` : ""}</p>
        <h3 className="mt-1 break-words text-lg font-semibold text-mecg-navy">{request.title}</h3>
      </div>
      <p className="tabular text-xl font-semibold text-mecg-navy">{formatCents(request.amountCents)}</p>
    </header>
    <div className="flex flex-wrap gap-2">
      <StatusPill tone={statusTone(request.status)}>{statusLabels[request.status]}</StatusPill>
      <StatusPill tone="neutral">{categoryLabels[request.category]}</StatusPill>
    </div>
    {request.notes && <p className="whitespace-pre-line break-words text-sm leading-6">{request.notes}</p>}
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-muted">{request.kind === "REIMBURSEMENT" ? "Paid by member" : "Planned for"}</dt><dd className="tabular">{request.spentOn ? <time dateTime={request.spentOn}>{formatDay(request.spentOn)}</time> : "No date"}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted">Receipt</dt><dd className="break-all">{request.receiptUrl
        ? <a href={request.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-mecg-blue underline underline-offset-4">Open receipt<span className="sr-only"> for {request.title} (opens in a new tab)</span></a>
        : "Not added yet"}</dd></div>
      <div><dt className="text-xs text-muted">Sent</dt><dd className="tabular">{formatEasternDateTime(request.createdAt)}</dd></div>
    </dl>
    {request.decidedAt && <p className="break-words text-sm leading-6">
      <span className="font-semibold">{request.status === "DENIED" ? "Denied" : "Approved"}</span> {formatEasternDateTime(request.decidedAt)}{request.decidedByName ? ` by ${request.decidedByName}` : ""}{request.decisionNote ? `: ${request.decisionNote}` : "."}
    </p>}
    {request.paidOn && <p className="break-words text-sm leading-6">
      <span className="font-semibold">Paid</span> <time dateTime={request.paidOn}>{formatDay(request.paidOn)}</time>{request.paymentNote ? ` · ${request.paymentNote}` : ""}{request.paidRecordedByName ? ` · recorded by ${request.paidRecordedByName}` : ""}
    </p>}
    {viewer === "board" && request.isMine && (request.status === "SUBMITTED" || request.status === "APPROVED") &&
      <p className="text-xs leading-5 text-muted">This is your own request. Another board member approves it and records the payment.</p>}
    {(editable || steps.length > 0) && <details className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        {viewer === "board" ? (has("MARK_PAID") ? "Record payment" : "Decide") : request.status === "APPROVED" ? "Add receipt or withdraw" : "Edit or withdraw"}
        <span className="sr-only"> {request.title}</span>
      </summary>
      <div className="mt-4 space-y-6">
        {editable && <RequestForm key={request.revision} request={request} onSaved={() => announce(request.status === "APPROVED" ? `Receipt link saved for “${request.title}”.` : `Changes to “${request.title}” saved.`)} />}
        {has("WITHDRAW") && <WithdrawForm key={`w${request.revision}`} request={request} announce={announce} />}
        {has("APPROVE") && <DecideForm key={`d${request.revision}`} request={request} announce={announce} />}
        {has("MARK_PAID") && <PaidForm key={`p${request.revision}`} request={request} announce={announce} />}
      </div>
    </details>}
  </article>;
}

function Unavailable({ what }: { what: string }) {
  return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="alert">
    <h2 className="text-lg font-semibold">{what} unavailable</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load budget requests. Reload to try again. If this is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
}

export function MyBudgetRequests({ list }: { list: BudgetRequestList | null }) {
  const [formKey, setFormKey] = useState(0);
  const saved = useSavedNotice();
  if (!list) return <Unavailable what="Your budget requests are" />;
  return <>
    <section aria-labelledby="new-request-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <div>
        <h2 id="new-request-heading" className="text-xl font-semibold text-mecg-navy">Ask for money</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Ask to be paid back for something you bought for the club, or to have a purchase approved before you buy. The board sees your request and decides. Payment happens outside this site.</p>
      </div>
      <RequestForm key={formKey} request={null} onSaved={() => { setFormKey((key) => key + 1); saved.announce("Request sent. It is in your list below."); }} />
    </section>
    <SavedNotice text={saved.text} focusRef={saved.ref} />
    <section aria-labelledby="my-requests-heading" className="space-y-4">
      <h2 id="my-requests-heading" className="text-xl font-semibold text-mecg-navy">Your requests</h2>
      {list.requests.length === 0
        ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">You haven’t sent any requests. The first one you send above appears here.</p>
        : list.requests.map((request) => <RequestCard key={request.id} request={request} viewer="member" announce={saved.announce} />)}
    </section>
  </>;
}

function Figure({ label, tally }: { label: string; tally: Tally }) {
  return <div className="min-w-0">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="tabular mt-1 text-2xl font-semibold text-mecg-navy">{formatCents(tally.cents)}</dd>
    <dd className="tabular text-xs text-muted">{tally.count} {tally.count === 1 ? "request" : "requests"}</dd>
  </div>;
}

export function BudgetRequestLog({ list }: { list: BudgetRequestList | null }) {
  const id = useId();
  const [status, setStatus] = useState<RequestStatus | "">("");
  const saved = useSavedNotice();
  if (!list) return <Unavailable what="The budget log is" />;
  const summary = summarizeRequests(list.requests);
  const ordered = orderForBoard(list.requests);
  const shown = status ? ordered.filter((request) => request.status === status) : ordered;
  return <>
    <section aria-labelledby="totals-heading" className="space-y-3 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <h2 id="totals-heading" className="text-xl font-semibold text-mecg-navy">All requests to date</h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Figure label="Waiting for a decision" tally={summary.waiting} />
        <Figure label="Approved, not paid yet" tally={summary.approvedUnpaid} />
        <Figure label="Paid" tally={summary.paid} />
      </dl>
      <p className="text-xs leading-5 text-muted">An approval log only. Payments happen outside this site; record them here once made. Nobody approves or records payment on their own request.</p>
    </section>
    <SavedNotice text={saved.text} focusRef={saved.ref} />
    <section aria-labelledby="requests-heading" className="space-y-4">
      <h2 id="requests-heading" className="text-xl font-semibold text-mecg-navy">Requests</h2>
      {list.requests.length === 0
        ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No requests yet. Members send them from Budget requests in their workspace.</p>
        : <>
          <div className="space-y-2">
            <label htmlFor={`${id}-status`} className="block text-sm font-semibold sm:max-w-xs">Show
              <select id={`${id}-status`} value={status} onChange={(event) => setStatus(event.target.value as RequestStatus | "")} className={field}>
                <option value="">All requests</option>
                {requestStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
              </select>
            </label>
            <p role="status" aria-live="polite" className="tabular text-xs text-muted">{shown.length === list.requests.length ? `${list.requests.length} ${list.requests.length === 1 ? "request" : "requests"}` : `Showing ${shown.length} of ${list.requests.length}`}</p>
          </div>
          {shown.length === 0
            ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No requests with this status.</p>
            : shown.map((request) => <RequestCard key={request.id} request={request} viewer="board" announce={saved.announce} />)}
        </>}
    </section>
  </>;
}
