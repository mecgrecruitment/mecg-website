"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import {
  describeAccess, DETAIL_LIMIT, handoffStatuses, ITEM_LIMIT, itemKinds, kindLabels, LABEL_LIMIT, NOTES_LIMIT, progress, ROLE_LIMIT,
  starterItems, statusLabels,
  type Handoff, type HandoffBoard, type HandoffStatus, type ItemKind, type Person, type PersonAccess,
} from "@/lib/officer-handoff/model";

const field = "field-control mt-2 min-h-11";
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

// A due date is a calendar day, so format it without a time zone shift.
export function formatDueDate(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function statusTone(status: HandoffStatus): "navy" | "orange" | "neutral" {
  if (status === "COMPLETE") return "navy";
  if (status === "OPEN") return "orange";
  return "neutral";
}

type DraftItem = { key: string; id: string | null; kind: ItemKind; label: string; detail: string; done: boolean; doneNote: string };

function draftItems(handoff: Handoff | null): DraftItem[] {
  // Keys feed element ids, so they must be the same on the server and the client.
  if (!handoff) return starterItems.map((item, index) => ({ ...item, key: `starter-${index}`, id: null, done: false, doneNote: "" }));
  return handoff.items.map((item) => ({
    key: item.id, id: item.id, kind: item.kind, label: item.label, detail: item.detail, done: item.done,
    doneNote: item.done && item.doneAt ? `Ticked ${formatEasternDateTime(item.doneAt)}${item.doneByName ? ` by ${item.doneByName}` : ""}` : "",
  }));
}

// Each successful save remounts its form with fresh values, so the success
// message and the focus live in a status region the parent owns.
function SavedNotice({ text, focusRef }: { text: string; focusRef: RefObject<HTMLParagraphElement | null> }) {
  return <p ref={focusRef} tabIndex={-1} role="status" aria-live="polite" className="min-h-6 text-sm leading-6 text-success">{text}</p>;
}

function useSavedNotice() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLParagraphElement>(null);
  return { text, ref, announce(message: string) { setText(message); requestAnimationFrame(() => ref.current?.focus()); } };
}

function PersonSelect({ id, name, label, people, value, keptName, optional }: {
  id: string; name: string; label: string; people: readonly Person[]; value: string | null; keptName: string | null; optional?: boolean;
}) {
  // An officer who has since left stays selectable on the handoff that already names them.
  const kept = value && !people.some((person) => person.id === value) ? [{ id: value, name: `${keptName ?? "Former member"} (no longer active)` }] : [];
  return <label htmlFor={id} className="block text-sm font-semibold">{label}
    <select id={id} name={name} required={!optional} defaultValue={value ?? ""} className={field}>
      <option value="" disabled={!optional}>{optional ? "Not chosen yet" : "Choose…"}</option>
      {[...kept, ...people].map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select>
  </label>;
}

function Checklist({ items, setItems, idPrefix }: { items: DraftItem[]; setItems: (items: DraftItem[]) => void; idPrefix: string }) {
  const [newKind, setNewKind] = useState<ItemKind>("ACCOUNT");
  const [newLabel, setNewLabel] = useState("");
  const added = useRef(0);
  const update = (key: string, patch: Partial<DraftItem>) => setItems(items.map((item) => item.key === key ? { ...item, ...patch } : item));
  const { done, total } = progress(items);
  function add() {
    const label = newLabel.trim();
    if (!label || items.length >= ITEM_LIMIT) return;
    setItems([...items, { key: `new-${++added.current}`, id: null, kind: newKind, label, detail: "", done: false, doneNote: "" }]);
    setNewLabel("");
  }
  return <fieldset className="space-y-4">
    <legend className="text-sm font-semibold">Checklist <span className="tabular font-normal text-muted">· {done} of {total} done</span></legend>
    {itemKinds.map((kind) => {
      const group = items.filter((item) => item.kind === kind);
      if (group.length === 0) return null;
      return <div key={kind} className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted">{kindLabels[kind]}</h4>
        <ul className="space-y-2">
          {group.map((item) => <li key={item.key} className="space-y-2 rounded-xl bg-wash p-3">
            <div className="flex items-start gap-3">
              <input id={`${idPrefix}-${item.key}-done`} type="checkbox" checked={item.done} onChange={(event) => update(item.key, { done: event.target.checked, doneNote: "" })} className="mt-3 size-5 shrink-0" />
              <label htmlFor={`${idPrefix}-${item.key}-done`} className="flex min-h-11 min-w-0 flex-1 items-center break-words text-sm font-semibold">{item.label}</label>
              <button type="button" onClick={() => setItems(items.filter((other) => other.key !== item.key))} className="button-secondary min-h-11 shrink-0 px-3 text-xs">
                Remove<span className="sr-only"> {item.label}</span>
              </button>
            </div>
            <div className="space-y-2 sm:pl-8">
              <label htmlFor={`${idPrefix}-${item.key}-detail`} className="block text-xs font-semibold text-muted">Notes · optional
                <input id={`${idPrefix}-${item.key}-detail`} value={item.detail} maxLength={DETAIL_LIMIT} onChange={(event) => update(item.key, { detail: event.target.value })} className={`${field} text-sm font-normal text-foreground`} />
              </label>
              {item.doneNote && <p className="text-xs text-muted">{item.doneNote}</p>}
            </div>
          </li>)}
        </ul>
      </div>;
    })}
    {items.length === 0 && <p className="text-sm text-muted">No items yet. Add what the incoming officer needs below.</p>}
    <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <label htmlFor={`${idPrefix}-new-kind`} className="block text-xs font-semibold">Type
        <select id={`${idPrefix}-new-kind`} value={newKind} onChange={(event) => setNewKind(event.target.value as ItemKind)} className={field}>
          {itemKinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-new-label`} className="block text-xs font-semibold">New item
        <input id={`${idPrefix}-new-label`} value={newLabel} maxLength={LABEL_LIMIT} onChange={(event) => setNewLabel(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Transfer the domain registrar account" className={field} />
      </label>
      <button type="button" onClick={add} className="button-secondary min-h-11" aria-disabled={!newLabel.trim() || items.length >= ITEM_LIMIT}>Add item</button>
    </div>
    <p className="text-xs leading-5 text-muted">Never write passwords or recovery codes here. Note where a login lives (for example the club password manager), not the login itself.</p>
  </fieldset>;
}

function HandoffForm({ handoff, people, onSaved }: { handoff: Handoff | null; people: readonly Person[]; onSaved: (status: HandoffStatus) => void }) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState(() => draftItems(handoff));
  const locked = useRef(false);

  async function submit(form: HTMLFormElement) {
    if (locked.current) return;
    const data = new FormData(form);
    const optional = (name: string) => String(data.get(name) ?? "") || null;
    const status = String(data.get("status") ?? "OPEN") as HandoffStatus;
    const payload = {
      id: handoff?.id ?? null,
      revision: handoff?.revision ?? 0,
      handoff: {
        roleTitle: String(data.get("roleTitle") ?? ""),
        outgoingId: String(data.get("outgoingId") ?? ""),
        incomingId: optional("incomingId"),
        dueOn: optional("dueOn"),
        status,
        notes: String(data.get("notes") ?? ""),
        // Saved grouped by type, the order the checklist shows.
        items: itemKinds.flatMap((kind) => items.filter((item) => item.kind === kind))
          .map(({ id: itemId, kind, label, detail, done }) => ({ id: itemId, kind, label, detail, done })),
      },
    };
    locked.current = true; setPending(true); setNotice("");
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/board/handoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        setNotice(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Save could not be confirmed. Reload to check before retrying.");
        return;
      }
      onSaved(status);
      router.refresh();
    } catch {
      setNotice("Save could not be confirmed. Your changes are still here. Reload to check before retrying.");
    } finally { locked.current = false; setPending(false); }
  }

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-role`} className="block text-sm font-semibold">Role
        <input id={`${id}-role`} name="roleTitle" required maxLength={ROLE_LIMIT} defaultValue={handoff?.roleTitle ?? ""} placeholder="Treasurer" className={field} />
      </label>
      <label htmlFor={`${id}-due`} className="block text-sm font-semibold">Hand over by · optional
        <input id={`${id}-due`} name="dueOn" type="date" defaultValue={handoff?.dueOn ?? ""} className={field} />
      </label>
      <PersonSelect id={`${id}-out`} name="outgoingId" label="Outgoing officer" people={people} value={handoff?.outgoingId ?? null} keptName={handoff?.outgoingName ?? null} />
      <PersonSelect id={`${id}-in`} name="incomingId" label="Incoming officer" people={people} value={handoff?.incomingId ?? null} keptName={handoff?.incomingName ?? null} optional />
      <label htmlFor={`${id}-status`} className="block text-sm font-semibold">Status
        <select id={`${id}-status`} name="status" defaultValue={handoff?.status ?? "OPEN"} className={field}>
          {handoffStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        <span className="mt-1 block text-xs font-normal text-muted">Complete needs an incoming officer and every item ticked.</span>
      </label>
      <label htmlFor={`${id}-notes`} className="block text-sm font-semibold sm:col-span-2">Notes · optional
        <textarea id={`${id}-notes`} name="notes" maxLength={NOTES_LIMIT} defaultValue={handoff?.notes ?? ""} className="field-control mt-2 min-h-20 py-3 text-sm" />
      </label>
    </div>
    <Checklist items={items} setItems={setItems} idPrefix={id} />
    <button type="submit" className="button-primary" aria-disabled={pending}>{pending ? "Saving…" : handoff ? "Save handoff" : "Start handoff"}</button>
    <p role="alert" className="text-sm leading-6 text-danger">{notice}</p>
  </form>;
}

function AccessList({ title, access, empty }: { title: string; access: PersonAccess | null; empty: string }) {
  const lines = access ? describeAccess(access) : [];
  return <div className="min-w-0">
    <h4 className="text-xs text-muted">{title}</h4>
    {lines.length === 0
      ? <p className="mt-1 text-sm">{empty}</p>
      : <ul className="mt-1 space-y-1 text-sm">{lines.map((line) => <li key={line} className="break-words">{line}</li>)}</ul>}
  </div>;
}

// Saving can move a card between In progress and Finished, which remounts it,
// so its saved notice lives in the page and not in the card.
function HandoffCard({ handoff, people, onSaved }: { handoff: Handoff; people: readonly Person[]; onSaved: (status: HandoffStatus) => void }) {
  const { done, total } = progress(handoff.items);
  const open = handoff.status === "OPEN";
  const form = <HandoffForm key={handoff.revision} handoff={handoff} people={people} onSaved={onSaved} />;
  return <article className="space-y-4 rounded-xl bg-paper p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="break-words text-lg font-semibold text-mecg-navy">{handoff.roleTitle}</h3>
        <p className="mt-1 break-words text-sm">
          {handoff.outgoingName ?? "Former member"} <span aria-hidden="true">→</span><span className="sr-only"> to </span> {handoff.incomingName ?? "incoming officer not chosen"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill tone={statusTone(handoff.status)}>{statusLabels[handoff.status]}</StatusPill>
        <StatusPill tone="neutral"><span className="tabular">{done} of {total} done</span></StatusPill>
      </div>
    </header>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted">Hand over by</dt><dd className="tabular">{handoff.dueOn ? <time dateTime={handoff.dueOn}>{formatDueDate(handoff.dueOn)}</time> : "No date set"}</dd></div>
      {handoff.completedAt && <div><dt className="text-xs text-muted">Completed</dt><dd className="tabular">{formatEasternDateTime(handoff.completedAt)}</dd></div>}
    </dl>
    {handoff.notes && <p className="whitespace-pre-line break-words text-sm leading-6">{handoff.notes}</p>}
    <section aria-label={`Current access for ${handoff.roleTitle}`} className="grid gap-4 rounded-xl bg-white p-4 inset-ring inset-ring-line sm:grid-cols-2">
      <AccessList title="Outgoing officer still holds" access={handoff.access.outgoing} empty="No elevated roles or reviewer grants." />
      <AccessList title="Incoming officer holds" access={handoff.access.incoming} empty={handoff.incomingId ? "No elevated roles or reviewer grants yet." : "Choose the incoming officer to see their access."} />
      <p className="text-xs leading-5 text-muted sm:col-span-2">Live from Settings and the member tools. Change roles in Settings and reviewer grants with the Owner controls in each member tool; this page does not change access.</p>
    </section>
    {open
      ? form
      : <details className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Edit<span className="sr-only"> {handoff.roleTitle} handoff</span></summary>
        <div className="mt-4">{form}</div>
      </details>}
    <p className="text-xs text-muted">
      Started {formatEasternDateTime(handoff.createdAt)}{handoff.createdByName ? ` by ${handoff.createdByName}` : ""}
      {handoff.revision > 1 ? ` · updated ${formatEasternDateTime(handoff.updatedAt)}${handoff.updatedByName ? ` by ${handoff.updatedByName}` : ""}` : ""}
    </p>
  </article>;
}

export default function OfficerHandoffs({ board }: { board: HandoffBoard | null }) {
  const [formKey, setFormKey] = useState(0);
  const created = useSavedNotice();
  const updated = useSavedNotice();
  if (!board) return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="alert">
    <h2 className="text-lg font-semibold">Officer handoffs are unavailable</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load handoffs. Reload to try again. If this page is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
  const open = board.handoffs.filter((handoff) => handoff.status === "OPEN");
  const finished = board.handoffs.filter((handoff) => handoff.status !== "OPEN");
  const cardSaved = (role: string) => (status: HandoffStatus) => updated.announce(
    status === "OPEN" ? `${role} handoff saved.` : `${role} handoff saved as ${statusLabels[status].toLowerCase()}. It is listed under Finished.`);
  return <>
    <SavedNotice text={updated.text} focusRef={updated.ref} />
    <section aria-labelledby="open-heading" className="space-y-4">
      <h2 id="open-heading" className="text-xl font-semibold text-mecg-navy">In progress</h2>
      {open.length === 0
        ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">No handoffs in progress. Start one below when an officer is changing.</p>
        : open.map((handoff) => <HandoffCard key={handoff.id} handoff={handoff} people={board.people} onSaved={cardSaved(handoff.roleTitle)} />)}
    </section>
    <section aria-labelledby="start-heading" className="space-y-4 rounded-xl bg-white p-5 inset-ring inset-ring-line">
      <div>
        <h2 id="start-heading" className="text-xl font-semibold text-mecg-navy">Start a handoff</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Starts with a suggested checklist you can edit. Visible to active board members and owners only.</p>
      </div>
      <HandoffForm key={formKey} handoff={null} people={board.people} onSaved={() => { setFormKey((key) => key + 1); created.announce("Handoff started. It is listed above."); }} />
      <SavedNotice text={created.text} focusRef={created.ref} />
    </section>
    {finished.length > 0 && <section aria-labelledby="finished-heading" className="space-y-4">
      <h2 id="finished-heading" className="text-xl font-semibold text-mecg-navy">Finished</h2>
      {finished.map((handoff) => <HandoffCard key={handoff.id} handoff={handoff} people={board.people} onSaved={cardSaved(handoff.roleTitle)} />)}
    </section>}
  </>;
}
