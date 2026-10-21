"use client";

import { useMemo, useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import { ONBOARDING_LABELS } from "@/app/applicant/onboarding-data";

export type BoardOnboardingItem = { applicationId: string; applicantName: string; contact: string; key: string; ownerId: string | null; ownerName: string | null; completedAt: string | null; completedByName: string | null };
type OnboardingState = "NEEDS_OWNER" | "IN_PROGRESS" | "COMPLETE";

function groupState(group: BoardOnboardingItem[]): OnboardingState {
  if (group.every((item) => item.completedAt)) return "COMPLETE";
  if (group.some((item) => !item.completedAt && !item.ownerId)) return "NEEDS_OWNER";
  return "IN_PROGRESS";
}

const STATE_COPY: Record<OnboardingState, string> = {
  NEEDS_OWNER: "Needs owner",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
};

function OnboardingTask({ cycleId, applicantName, item, owners, onSaved }: {
  cycleId: string;
  applicantName: string;
  item: BoardOnboardingItem;
  owners: Array<{ id: string; name: string }>;
  onSaved: (item: BoardOnboardingItem) => void;
}) {
  const { pending, error, success, run } = useAction("/admin/people/onboarding", "Could not update onboarding. Try again.");
  const complete = Boolean(item.completedAt);
  const copy = ONBOARDING_LABELS[item.key] ?? { title: item.key, detail: "" };

  async function update(action: "SET_OWNER" | "SET_COMPLETION", value: string | boolean) {
    const result = await run({ action, cycleId, applicationId: item.applicationId, itemKey: item.key, value }, { successMessage: `${copy.title} saved.` });
    if (!result.ok) return;
    onSaved(action === "SET_OWNER"
      ? { ...item, ownerId: String(value) || null, ownerName: owners.find((owner) => owner.id === value)?.name ?? null }
      : { ...item, completedAt: value ? new Date().toISOString() : null, completedByName: value ? "Board" : null });
  }

  return (
    <div className={`rounded-xl p-3.5 inset-ring inset-ring-line ${complete ? "bg-success-wash" : "bg-white"}`}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-mecg-navy"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${complete ? "bg-success text-white" : "bg-mecg-navy/10 text-muted"}`} aria-hidden="true">{complete ? "✓" : ""}</span>{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{copy.detail}{item.completedByName ? ` Completed by ${item.completedByName}.` : ""}</p>
        </div>
        <label className="text-xs font-semibold text-muted">Owner<span className="sr-only"> for {copy.title}, {applicantName}</span><select value={item.ownerId ?? ""} disabled={pending || complete} onChange={(event) => void update("SET_OWNER", event.target.value)} className="select-control mt-1 min-h-11 w-full text-base sm:text-sm"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
        <button type="button" disabled={pending} onClick={() => void update("SET_COMPLETION", !complete)} className={complete ? "button-secondary min-h-11" : "button-primary min-h-11"}>{pending ? "Saving…" : complete ? "Reopen" : "Complete"}</button>
      </div>
      <div className="mt-2 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
    </div>
  );
}

export default function BoardOnboarding({ cycleId, initialItems, owners, loadError = false }: { cycleId: string; initialItems: BoardOnboardingItem[]; owners: Array<{ id: string; name: string }>; loadError?: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"ALL" | OnboardingState>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const grouped = new Map<string, BoardOnboardingItem[]>();
    for (const item of items) grouped.set(item.applicationId, [...(grouped.get(item.applicationId) ?? []), item]);
    return [...grouped.values()];
  }, [items]);
  const filteredGroups = groups.filter((group) => filter === "ALL" || groupState(group) === filter);
  const needsOwnerCount = groups.filter((group) => groupState(group) === "NEEDS_OWNER").length;
  const completeCount = groups.filter((group) => groupState(group) === "COMPLETE").length;

  function saveItem(next: BoardOnboardingItem) {
    setItems((current) => current.map((item) => item.applicationId === next.applicationId && item.key === next.key ? next : item));
  }

  return (
    <section aria-labelledby="accepted-onboarding-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[13px] font-semibold text-muted">Accepted applicants</p><h2 id="accepted-onboarding-heading" className="mt-1 text-xl font-semibold">Onboarding handoff</h2></div>
        <p className="max-w-md text-pretty text-sm text-muted">This checklist prepares the applicant. Membership access is managed separately in Access.</p>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-xl bg-danger-wash p-4 text-sm text-danger inset-ring inset-ring-danger/15"><p className="font-semibold">Onboarding could not be loaded</p><p className="mt-1">Refresh the page before making onboarding decisions.</p></div>
      ) : !groups.length ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-success-wash p-4 inset-ring inset-ring-success/15"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-sm font-semibold text-white" aria-hidden="true">✓</span><div><p className="text-sm font-semibold text-mecg-navy">Onboarding is clear</p><p className="mt-0.5 text-sm text-muted">New checklists appear when applicants accept an offer.</p></div></div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[[groups.length, "awaiting onboarding"], [needsOwnerCount, "need an owner"], [completeCount, "completed"]].map(([value, label]) => <div key={String(label)} className="rounded-xl bg-paper px-4 py-3"><p className="tabular-nums text-xl font-semibold">{value}</p><p className="mt-0.5 text-xs text-muted">{label}</p></div>)}
          </div>
          <div className="scroll-cue mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter onboarding">
            {(["ALL", "NEEDS_OWNER", "IN_PROGRESS", "COMPLETE"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-[background-color,color,scale] active:scale-[0.96] ${filter === value ? "bg-mecg-navy text-white" : "bg-wash text-muted hover:bg-mecg-blue/10"}`}>{value === "ALL" ? "Everyone" : STATE_COPY[value]}</button>)}
          </div>
          <div className="mt-3 grid gap-3">
            {filteredGroups.map((group) => {
              const first = group[0]!;
              const done = group.filter((item) => item.completedAt).length;
              const state = groupState(group);
              const open = expandedId === first.applicationId;
              const ownerNames = [...new Set(group.flatMap((item) => item.ownerName ? [item.ownerName] : []))];
              return (
                <article key={first.applicationId} className="overflow-hidden rounded-xl bg-paper inset-ring inset-ring-line">
                  <button type="button" onClick={() => setExpandedId(open ? null : first.applicationId)} aria-expanded={open} className="task-row grid min-h-24 w-full gap-3 p-4 text-left sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center sm:p-5">
                    <div><p className="font-semibold text-mecg-navy">{first.applicantName}</p><p className="mt-0.5 text-xs text-muted">{ownerNames.length ? `Owned by ${ownerNames.join(", ")}` : "No owners assigned yet"}</p></div>
                    <div><div className="flex items-center justify-between text-xs font-semibold text-muted"><span>{STATE_COPY[state]}</span><span className="tabular-nums">{done}/{group.length}</span></div><div className="progress-track mt-2" aria-label={`${done} of ${group.length} onboarding tasks complete`}><div className="progress-fill" style={{ transform: `scaleX(${group.length ? done / group.length : 0})` }} /></div></div>
                    <span className={`disclosure-chevron justify-self-end text-lg text-muted ${open ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
                  </button>
                  {open && <div className="grid gap-2 border-t border-line p-3 sm:p-4">{group.map((item) => <OnboardingTask key={item.key} cycleId={cycleId} applicantName={first.applicantName} item={item} owners={owners} onSaved={saveItem} />)}</div>}
                </article>
              );
            })}
            {!filteredGroups.length && <div className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-center text-sm text-muted">No applicants match this onboarding filter.</div>}
          </div>
        </>
      )}
    </section>
  );
}
