"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { fieldsFor, tools, verificationStates, sharingStates, type ToolKind, type ToolRecord } from "@/lib/member-tools/model";

type Props = { kind: ToolKind; cycleId: string; userId: string; records: ToolRecord[]; canReview: boolean; canManageAccess: boolean };
function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const locked = useRef(false);
  async function save(payload: Record<string, unknown>) {
    if (locked.current) return false;
    locked.current = true; setPending(true); setNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/member/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Save could not be confirmed. Reload to check before retrying.";
        setNotice({ error: true, text: message }); return false;
      }
      setNotice({ error: false, text: "Saved. Your records are up to date." }); router.refresh(); return true;
    } catch { setNotice({ error: true, text: "Save could not be confirmed. Your form is still here. Reload to check before retrying." }); return false; }
    finally { locked.current = false; setPending(false); }
  }
  return { pending, save, notice: notice && <p role={notice.error ? "alert" : "status"} className={`text-sm leading-6 ${notice.error ? "text-danger" : "text-success"}`}>{notice.text}</p> };
}
function RecordForm({ kind, cycleId, record }: Pick<Props, "kind" | "cycleId"> & { record?: ToolRecord }) {
  const { pending, save, notice } = useSave();
  const formId = useId();
  const id = useRef<string | null>(null);
  const [created, setCreated] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id.current) id.current = record?.id ?? crypto.randomUUID();
    const content = Object.fromEntries(new FormData(event.currentTarget));
    const saved = await save({ action: "save", cycleId, kind, id: id.current, revision: record?.revision ?? 0, content });
    if (saved && !record) setCreated(true);
  }
  if (created) return <div className="space-y-3"><p role="status" className="text-sm text-success">Saved privately. Find it in the record list below.</p><button className="button-secondary" onClick={() => { id.current = null; setCreated(false); }}>Add another</button></div>;
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-5 sm:grid-cols-2">{fieldsFor(kind).map((field) => {
      const fieldId = `${formId}-${field.key}`; const value = record?.content[field.key] ?? "";
      if (field.options || field.type === "textarea") return <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
        <label htmlFor={fieldId} className="block text-sm font-semibold text-mecg-navy">{field.label}{field.required ? " · Required" : ""}</label>
        {field.options ? <select id={fieldId} name={field.key} required={field.required} defaultValue={value} disabled={pending} className="field-control mt-2 min-h-12"><option value="">Choose…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <textarea id={fieldId} name={field.key} required={field.required} defaultValue={value} disabled={pending} maxLength={4000} className="field-control mt-2 min-h-28 py-3 text-sm" aria-describedby={field.hint ? `${fieldId}-hint` : undefined} />}
        {field.hint && <p id={`${fieldId}-hint`} className="mt-2 text-xs leading-5 text-muted">{field.hint}</p>}
      </div>;
      return <FormField key={field.key} id={fieldId} name={field.key} label={field.label} type={field.type ?? "text"} required={field.required} defaultValue={value} maxLength={1000} disabled={pending} hint={field.hint} />;
    })}</div>
    {record && kind !== "pipeline" && <p className="text-sm text-muted">Editing content resets verification and sharing clearance for a fresh review.</p>}
    <button disabled={pending} className="button-primary">{pending ? "Saving…" : record ? "Save changes" : tools[kind].action}</button>
    {notice}
  </form>;
}
function ReviewForm({ record, cycleId }: { record: ToolRecord; cycleId: string }) {
  const { pending, save, notice } = useSave(); const id = useId();
  return <form className="space-y-4 border-t border-line pt-5" onSubmit={async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    await save({ action: "review", kind: record.kind, cycleId, id: record.id, revision: record.revision, review: data });
  }}>
    <h3 className="text-lg font-semibold">Independent review</h3>
    <p className="text-sm leading-6 text-muted">Record what you checked. Clearance records an existing permission for the specified use; it does not publish or broaden access.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-verification`} className="text-sm font-semibold">Verification<select id={`${id}-verification`} name="verification" defaultValue={record.review.verification} disabled={pending} className="field-control mt-2 min-h-12">{verificationStates.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label htmlFor={`${id}-sharing`} className="text-sm font-semibold">Sharing permission<select id={`${id}-sharing`} name="sharing" defaultValue={record.review.sharing} disabled={pending} className="field-control mt-2 min-h-12">{sharingStates.map((v) => <option key={v}>{v}</option>)}</select></label>
    </div>
    <label htmlFor={`${id}-note`} className="block text-sm font-semibold">Review findings and rubric scores<textarea id={`${id}-note`} name="note" maxLength={4000} defaultValue={record.review.note} disabled={pending} className="field-control mt-2 min-h-28 py-3 text-sm" /></label>
    <FormField id={`${id}-source`} name="source" type="url" label="Permission source link" maxLength={1000} defaultValue={record.review.source} disabled={pending} />
    <label htmlFor={`${id}-scope`} className="block text-sm font-semibold">Exact allowed use and restrictions<textarea id={`${id}-scope`} name="scope" maxLength={4000} defaultValue={record.review.scope} disabled={pending} className="field-control mt-2 min-h-28 py-3 text-sm" /></label>
    <button className="button-secondary" disabled={pending}>{pending ? "Saving…" : "Save review"}</button>{notice}
  </form>;
}
function AccessForm({ cycleId, kind }: Pick<Props, "cycleId" | "kind">) {
  const { pending, save, notice } = useSave(); const id = useId();
  return <details className="rounded-xl bg-wash p-5"><summary className="cursor-pointer text-sm font-semibold">Owner controls · reviewer access</summary>
    <p className="my-4 text-sm leading-6 text-muted">Grant only to the agreed operating reviewer. This permits viewing and editing every {kind} record in this cycle. Use the member’s internal profile UUID, not their Clerk ID. Revocation removes broader access immediately.</p>
    <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await save({ action: "access", cycleId, kind, userId: data.get("userId"), enabled: data.get("mode") === "grant" }); }}>
      <FormField id={`${id}-user`} name="userId" label="Member profile UUID" required disabled={pending} />
      <label className="block text-sm font-semibold" htmlFor={`${id}-mode`}>Action<select id={`${id}-mode`} name="mode" disabled={pending} className="field-control mt-2 min-h-12"><option value="grant">Grant reviewer access</option><option value="revoke">Revoke reviewer access</option></select></label>
      <button className="button-secondary" disabled={pending}>{pending ? "Saving…" : "Update access"}</button>{notice}
    </form>
  </details>;
}
export default function ToolWorkspace({ kind, cycleId, userId, records, canReview, canManageAccess }: Props) {
  const [query, setQuery] = useState(""); const [track, setTrack] = useState("All"); const [stage, setStage] = useState("All stages"); const searchId = useId();
  const visible = records.filter((record) => `${record.content.title} ${record.content.problem} ${record.content.nextAction ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (track === "All" || record.content.track === track) && (stage === "All stages" || record.content.stage === stage));
  return <>
    <p className="text-sm leading-6 text-muted">{canReview ? "Reviewer view: your records and submissions from members in this cycle." : "Private view: only your records are shown. An explicitly assigned tool reviewer can help review them."} Saving does not send outreach, publish work or grant access to linked files.</p>
    <section className="rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-6"><h2 className="mb-5 text-xl font-semibold">{tools[kind].action}</h2><RecordForm kind={kind} cycleId={cycleId} /></section>
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{canReview ? "Records to work on" : "Your records"}</h2>
      <div className="grid gap-4 sm:grid-cols-2"><FormField id={`${searchId}-search`} type="search" label="Find a record" value={query} onChange={(event) => setQuery(event.target.value)} />{kind === "pipeline" && <label htmlFor={`${searchId}-track`} className="text-sm font-semibold">Opportunity type<select id={`${searchId}-track`} className="field-control mt-2 min-h-12" value={track} onChange={(event) => setTrack(event.target.value)}><option>All</option><option>Client</option><option>Sponsor</option></select></label>}{kind === "pipeline" && <label htmlFor={`${searchId}-stage`} className="text-sm font-semibold">Filter by stage<select id={`${searchId}-stage`} className="field-control mt-2 min-h-12" value={stage} onChange={(event) => setStage(event.target.value)}>{["All stages", "Research", "Qualified", "Conversation", "Proposal", "Agreed", "Dormant", "Closed"].map((value) => <option key={value}>{value}</option>)}</select></label>}</div>
      {!visible.length && <p className="rounded-xl bg-wash p-6 text-sm leading-6 text-muted">{records.length ? "No records match. Try another search or opportunity type." : "No records yet. Add the first one above; it will stay here across visits."}</p>}
      {visible.map((record) => <article key={record.id} className="rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-6">
        <p className="text-xs text-muted">{record.ownerId === userId ? "Your record" : `Owner: ${record.ownerName}`} · Updated {new Date(record.updatedAt).toLocaleDateString("en-US", { timeZone: "America/Detroit" })}</p>
        <h3 className="mt-2 break-words text-xl font-semibold">{record.content.title}</h3>
        <p className="mt-2 text-sm font-semibold text-mecg-navy">{kind === "pipeline" ? `${record.content.track} · ${record.content.stage}` : `${record.review.verification} · ${record.review.sharing}`}</p>
        {kind === "pipeline" && <p className="mt-3 break-words text-sm leading-6 text-muted">Next: {record.content.nextAction}{record.content.nextDate ? ` · ${record.content.nextDate}` : ""}</p>}
        <a href={record.content.source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-mecg-blue underline">Open {kind === "pipeline" ? "source" : kind === "evidence" ? "deliverable" : "demo"}</a>
        {record.review.note && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">Review: {record.review.note}</p>}
        {record.review.scope && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">Allowed use: {record.review.scope}</p>}
        <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold">View or edit details</summary><div className="mt-5"><RecordForm key={record.revision} kind={kind} cycleId={cycleId} record={record} /></div></details>
        {canReview && record.ownerId !== userId && kind !== "pipeline" && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Review submission</summary><div className="mt-4"><ReviewForm key={record.revision} record={record} cycleId={cycleId} /></div></details>}
      </article>)}
    </section>
    <p className="break-all text-xs text-muted">Your internal profile ID: {userId}. Share it with the cycle Owner only if you need an agreed reviewer assignment.</p>
    {canManageAccess && <AccessForm cycleId={cycleId} kind={kind} />}
  </>;
}
