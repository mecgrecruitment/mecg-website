"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusPill from "@/components/status-pill";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { formatEasternDateTime } from "@/lib/date-time";
import {
  deliveryStatuses, healthFlags, healthIsStale, healthLabels, openBlockers, overdueMilestones, statusLabels,
  LIST_LIMIT, NOTE_LIMIT, type Milestone, type ProjectDelivery, type Risk, type Tracker,
} from "@/lib/engagement/model";

const field = "field-control mt-2 min-h-11";

function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const locked = useRef(false);
  async function save(payload: Record<string, unknown>, success: string) {
    if (locked.current) return;
    locked.current = true; setPending(true); setNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/projects/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Save could not be confirmed. Reload to check before retrying.";
        setNotice({ error: true, text: message });
        return;
      }
      setNotice({ error: false, text: success });
      router.refresh();
    } catch {
      setNotice({ error: true, text: "Save could not be confirmed. Your changes are still here. Reload to check before retrying." });
    } finally { locked.current = false; setPending(false); }
  }
  return { pending, save, notice: notice && <p role={notice.error ? "alert" : "status"} className={`text-sm leading-6 ${notice.error ? "text-danger" : "text-success"}`}>{notice.text}</p> };
}

function HealthBadge({ project, now }: { project: ProjectDelivery; now: Date }) {
  const stale = healthIsStale(project.healthSetAt, now);
  const label = project.health ? healthLabels[project.health] : "No health flag";
  const tone = project.health === "ON_TRACK" && !stale ? "navy" : project.health ? "orange" : "neutral";
  return <StatusPill tone={tone}>{label}{project.health && stale ? " · over a week old" : ""}</StatusPill>;
}

function Summary({ projects, now, today }: { projects: ProjectDelivery[]; now: Date; today: string }) {
  const open = projects.filter((project) => project.status !== "CLOSED");
  const flagged = open.filter((project) => project.health === "AT_RISK" || project.health === "OFF_TRACK").length;
  const stale = open.filter((project) => healthIsStale(project.healthSetAt, now)).length;
  const blocked = open.filter((project) => openBlockers(project.risks).length > 0).length;
  const late = open.filter((project) => overdueMilestones(project.milestones, today).length > 0).length;
  const items: [string, number][] = [
    ...deliveryStatuses.map((status) => [statusLabels[status], projects.filter((project) => project.status === status).length] as [string, number]),
    ["At risk or off track", flagged], ["Health not set this week", stale], ["With open blockers", blocked], ["With overdue milestones", late],
  ];
  return <dl className="grid grid-cols-2 gap-4 rounded-xl bg-wash p-5 sm:grid-cols-4">
    {items.map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="tabular mt-1 text-2xl font-semibold text-mecg-navy">{value}</dd></div>)}
  </dl>;
}

function newId() { return crypto.randomUUID(); }

function DeliveryForm({ project }: { project: ProjectDelivery }) {
  const { pending, save, notice } = useSave();
  const id = useId();
  const [milestones, setMilestones] = useState<Milestone[]>(project.milestones);
  const [risks, setRisks] = useState<Risk[]>(project.risks);
  const updateMilestone = (index: number, patch: Partial<Milestone>) => setMilestones((list) => list.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateRisk = (index: number, patch: Partial<Risk>) => setRisks((list) => list.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save({
      action: "save", projectId: project.projectId, revision: project.revision,
      delivery: {
        status: String(data.get("status") ?? ""),
        milestones: milestones.map((item) => ({ ...item, title: item.title.trim() })),
        risks: risks.map((item) => ({ ...item, text: item.text.trim() })),
        lastContactOn: String(data.get("lastContactOn") ?? ""),
        lastContactNote: String(data.get("lastContactNote") ?? ""),
      },
    }, "Delivery saved.");
  }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-status`} className="block text-sm font-semibold">Status
        <select id={`${id}-status`} name="status" defaultValue={project.status} disabled={pending} className={field}>
          {deliveryStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-contact`} className="block text-sm font-semibold">Last client contact
        <input id={`${id}-contact`} name="lastContactOn" type="date" defaultValue={project.lastContactOn} disabled={pending} className={field} />
      </label>
      <label htmlFor={`${id}-contact-note`} className="block text-sm font-semibold sm:col-span-2">What was agreed or asked
        <textarea id={`${id}-contact-note`} name="lastContactNote" maxLength={NOTE_LIMIT} defaultValue={project.lastContactNote} disabled={pending} className="field-control mt-2 min-h-20 py-3 text-sm" />
      </label>
    </div>

    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Milestones</legend>
      {milestones.length === 0 && <p className="text-sm text-muted">No milestones yet.</p>}
      {milestones.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl bg-wash p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="block text-xs font-semibold">Milestone<input required maxLength={200} value={item.title} disabled={pending} onChange={(event) => updateMilestone(index, { title: event.target.value })} className={field} /></label>
        <label className="block text-xs font-semibold">Due<input required type="date" value={item.due} disabled={pending} onChange={(event) => updateMilestone(index, { due: event.target.value })} className={field} /></label>
        <label className="block text-xs font-semibold">Done on<input type="date" value={item.done} disabled={pending} onChange={(event) => updateMilestone(index, { done: event.target.value })} className={field} /></label>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => setMilestones((list) => list.filter((_, i) => i !== index))}>Remove<span className="sr-only"> {item.title || "milestone"}</span></button>
      </div>)}
      {milestones.length < LIST_LIMIT && <button type="button" className="button-secondary" disabled={pending} onClick={() => setMilestones((list) => [...list, { id: newId(), title: "", due: "", done: "" }])}>Add milestone</button>}
    </fieldset>

    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Risks and blockers</legend>
      {risks.length === 0 && <p className="text-sm text-muted">Nothing recorded.</p>}
      {risks.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl bg-wash p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
        <label className="block text-xs font-semibold">Type<select value={item.kind} disabled={pending} onChange={(event) => updateRisk(index, { kind: event.target.value === "BLOCKER" ? "BLOCKER" : "RISK" })} className={field}><option value="RISK">Risk</option><option value="BLOCKER">Blocker</option></select></label>
        <label className="block text-xs font-semibold">Description<input required maxLength={NOTE_LIMIT} value={item.text} disabled={pending} onChange={(event) => updateRisk(index, { text: event.target.value })} className={field} /></label>
        <label className="block text-xs font-semibold">State<select value={item.status} disabled={pending} onChange={(event) => updateRisk(index, { status: event.target.value === "RESOLVED" ? "RESOLVED" : "OPEN" })} className={field}><option value="OPEN">Open</option><option value="RESOLVED">Resolved</option></select></label>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => setRisks((list) => list.filter((_, i) => i !== index))}>Remove<span className="sr-only"> {item.text || "risk"}</span></button>
      </div>)}
      {risks.length < LIST_LIMIT && <button type="button" className="button-secondary" disabled={pending} onClick={() => setRisks((list) => [...list, { id: newId(), kind: "RISK", text: "", status: "OPEN" }])}>Add risk or blocker</button>}
    </fieldset>

    <button className="button-primary" disabled={pending}>{pending ? "Saving…" : "Save delivery"}</button>
    {notice}
  </form>;
}

function HealthForm({ project }: { project: ProjectDelivery }) {
  const { pending, save, notice } = useSave();
  const id = useId();
  return <form className="space-y-4 border-t border-line pt-5" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save({ action: "health", projectId: project.projectId, revision: project.revision, health: String(data.get("health") ?? ""), note: String(data.get("note") ?? "") }, "Weekly health recorded.");
  }}>
    <h4 className="text-base font-semibold">Weekly health</h4>
    <p className="text-sm leading-6 text-muted">As lead, confirm this once a week even when nothing changed. The board sees when it was last set.</p>
    <label htmlFor={`${id}-health`} className="block text-sm font-semibold">This week
      <select id={`${id}-health`} name="health" required defaultValue={project.health ?? ""} disabled={pending} className={field}>
        <option value="">Choose…</option>
        {healthFlags.map((flag) => <option key={flag} value={flag}>{healthLabels[flag]}</option>)}
      </select>
    </label>
    <label htmlFor={`${id}-health-note`} className="block text-sm font-semibold">Why · required unless on track
      <textarea id={`${id}-health-note`} name="note" maxLength={NOTE_LIMIT} defaultValue={project.healthNote} disabled={pending} className="field-control mt-2 min-h-20 py-3 text-sm" />
    </label>
    <button className="button-secondary" disabled={pending}>{pending ? "Saving…" : "Record weekly health"}</button>
    {notice}
  </form>;
}

function LeadForm({ project }: { project: ProjectDelivery }) {
  const { pending, save, notice } = useSave();
  const id = useId();
  return <form className="space-y-3 border-t border-line pt-5" onSubmit={(event) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("leadId") ?? "");
    void save({ action: "lead", projectId: project.projectId, revision: project.revision, leadId: value || null }, "Project lead saved.");
  }}>
    <label htmlFor={`${id}-lead`} className="block text-sm font-semibold">Project lead
      <select id={`${id}-lead`} name="leadId" defaultValue={project.leadStaffed ? project.leadId ?? "" : ""} disabled={pending} className={field}>
        <option value="">No lead</option>
        {project.staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </label>
    <p className="text-xs leading-5 text-muted">Only members staffed on this project can lead it. The lead can edit this project’s delivery record and sets its weekly health.</p>
    <button className="button-secondary" disabled={pending || project.staff.length === 0}>{pending ? "Saving…" : "Save lead"}</button>
    {notice}
  </form>;
}

function ProjectCard({ project, canManage, now, today }: { project: ProjectDelivery; canManage: boolean; now: Date; today: string }) {
  const late = overdueMilestones(project.milestones, today);
  const blockers = openBlockers(project.risks);
  const next = project.milestones.filter((item) => !item.done).sort((a, b) => a.due.localeCompare(b.due))[0];
  return <article className="space-y-4 rounded-xl bg-paper p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-mecg-navy">{project.title}</h3>
        <p className="text-sm text-muted">{[project.clientLabel, project.semester].filter(Boolean).join(" · ") || "No client label"}</p>
      </div>
      <div className="flex flex-wrap gap-2"><StatusPill tone="neutral">{statusLabels[project.status]}</StatusPill><HealthBadge project={project} now={now} /></div>
    </header>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted">Lead</dt><dd>{project.leadName ? `${project.leadName}${project.leadStaffed ? "" : " · no longer staffed, reassign"}` : "Not assigned"}</dd></div>
      <div><dt className="text-xs text-muted">Last client contact</dt><dd>{project.lastContactOn || "Not recorded"}</dd></div>
      <div><dt className="text-xs text-muted">Next milestone</dt><dd>{next ? `${next.title} · due ${next.due}` : "None open"}{late.length ? ` · ${late.length} overdue` : ""}</dd></div>
      <div><dt className="text-xs text-muted">Open blockers</dt><dd>{blockers.length ? blockers.map((item) => item.text).join("; ") : "None"}</dd></div>
      {project.health && <div className="sm:col-span-2"><dt className="text-xs text-muted">Health note</dt><dd>{[project.healthNote, project.healthSetAt ? `Set ${formatEasternDateTime(project.healthSetAt)}${project.healthSetByName ? ` by ${project.healthSetByName}` : ""}` : ""].filter(Boolean).join(" · ")}</dd></div>}
    </dl>
    <details className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
      <summary className="cursor-pointer text-sm font-semibold">Edit delivery</summary>
      <div className="mt-4 space-y-5">
        <DeliveryForm key={project.revision} project={project} />
        {project.isLead && <HealthForm key={`health-${project.revision}`} project={project} />}
        {canManage && <LeadForm key={`lead-${project.revision}`} project={project} />}
      </div>
    </details>
  </article>;
}

export default function EngagementTracker({ tracker, now, today }: { tracker: Tracker | null; now: string; today: string }) {
  if (!tracker) return <section className="rounded-xl bg-warning-wash p-6 text-warning" role="status">
    <h2 className="text-lg font-semibold">Delivery tracking is unavailable</h2>
    <p className="mt-2 text-sm leading-6">We couldn’t load delivery records. Reload to try again. If the tracker is newly installed, ask the website maintainer to finish its database setup. Nothing is shown while access can’t be checked.</p>
  </section>;
  const clock = new Date(now);
  return <section aria-labelledby="delivery-heading" className="space-y-5">
    <div>
      <h2 id="delivery-heading" className="text-xl font-semibold text-mecg-navy">Delivery</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{tracker.canManage ? "Every engagement’s status, milestones, risks and the lead’s weekly health flag. Visible to the board and each project’s lead only." : "Projects you lead. The board can see these records too."}</p>
    </div>
    {tracker.canManage && tracker.projects.length > 0 && <Summary projects={tracker.projects} now={clock} today={today} />}
    {tracker.projects.length === 0
      ? <p className="rounded-xl bg-wash p-5 text-sm text-muted">{tracker.canManage ? "No projects yet. Add one below, staff it, then pick a lead." : "You don’t lead a project right now. The board assigns leads from each project’s staff."}</p>
      : tracker.projects.map((project) => <ProjectCard key={project.projectId} project={project} canManage={tracker.canManage} now={clock} today={today} />)}
  </section>;
}
