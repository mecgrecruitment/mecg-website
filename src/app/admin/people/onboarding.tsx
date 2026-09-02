"use client";

import { useMemo, useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import { ONBOARDING_LABELS } from "@/app/applicant/onboarding-data";

export type BoardOnboardingItem = { applicationId: string; applicantName: string; contact: string; key: string; ownerId: string | null; ownerName: string | null; completedAt: string | null; completedByName: string | null };

export default function BoardOnboarding({ cycleId, initialItems, owners }: { cycleId: string; initialItems: BoardOnboardingItem[]; owners: Array<{ id: string; name: string }> }) {
  const { pending, error, success, run } = useAction("/admin/people/onboarding", "Could not update onboarding. Try again.");
  const [items, setItems] = useState(initialItems);
  const groups = useMemo(() => {
    const grouped = new Map<string, BoardOnboardingItem[]>();
    for (const item of items) grouped.set(item.applicationId, [...(grouped.get(item.applicationId) ?? []), item]);
    return [...grouped.values()];
  }, [items]);

  async function update(item: BoardOnboardingItem, action: "SET_OWNER" | "SET_COMPLETION", value: string | boolean) {
    const result = await run({ action, cycleId, applicationId: item.applicationId, itemKey: item.key, value }, { successMessage: "Onboarding saved." });
    if (!result.ok) return;
    setItems((current) => current.map((row) => row.applicationId === item.applicationId && row.key === item.key
      ? action === "SET_OWNER"
        ? { ...row, ownerId: String(value) || null, ownerName: owners.find((owner) => owner.id === value)?.name ?? null }
        : { ...row, completedAt: value ? new Date().toISOString() : null, completedByName: value ? "Board" : null }
      : row));
  }

  return (
    <section aria-labelledby="accepted-onboarding-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[13px] font-semibold text-mecg-navy/50">Accepted applicants</p><h2 id="accepted-onboarding-heading" className="mt-1 text-xl font-semibold">Onboarding handoff</h2></div>
        <p className="text-sm text-mecg-navy/55">No membership is granted here.</p>
      </div>
      <div className="mt-3 grid gap-3">
        {groups.map((group) => {
          const first = group[0]!;
          const done = group.filter((item) => item.completedAt).length;
          return (
            <article key={first.applicationId} className="rounded-2xl bg-paper p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-mecg-navy">{first.applicantName}</p><p className="mt-0.5 text-xs text-mecg-navy/55">{first.contact}</p></div><span className="tabular text-sm font-semibold text-mecg-navy/60">{done}/{group.length} complete</span></div>
              <div className="mt-4 grid gap-2">
                {group.map((item) => {
                  const copy = ONBOARDING_LABELS[item.key] ?? { title: item.key, detail: "" };
                  const complete = Boolean(item.completedAt);
                  return (
                    <div key={item.key} className="grid gap-3 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)] sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
                      <div><p className="text-sm font-semibold text-mecg-navy">{complete ? "✓ " : ""}{copy.title}</p><p className="mt-0.5 text-xs leading-5 text-mecg-navy/55">{copy.detail}{item.completedByName ? ` Completed by ${item.completedByName}.` : ""}</p></div>
                      <label className="text-xs font-semibold text-mecg-navy/55">Owner<span className="sr-only"> for {copy.title}, {first.applicantName}</span><select value={item.ownerId ?? ""} disabled={pending} onChange={(event) => void update(item, "SET_OWNER", event.target.value)} className="select-control mt-1 min-h-11 w-full text-[13px]"><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
                      <button type="button" disabled={pending} onClick={() => void update(item, "SET_COMPLETION", !complete)} className={complete ? "button-secondary min-h-11" : "button-primary min-h-11"}>{complete ? "Reopen" : "Complete"}</button>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
        {!groups.length && <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6"><p className="text-sm font-semibold text-mecg-navy">No accepted applicants awaiting onboarding</p><p className="mt-1 text-sm text-mecg-navy/55">A checklist appears automatically when an applicant accepts an offer.</p></div>}
      </div>
      <div className="mt-3 space-y-2"><OperationNotice kind="error">{error}</OperationNotice><OperationNotice kind="success">{success}</OperationNotice></div>
    </section>
  );
}
