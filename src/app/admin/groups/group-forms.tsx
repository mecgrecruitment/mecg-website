"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import FormField from "@/components/form-field";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function ChevronSelect({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <select
        name={name}
        className="min-h-10 w-full appearance-none rounded-xl bg-mecg-navy/[0.035] px-3.5 pr-9 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
      >
        {children}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mecg-navy/40"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  );
}

export default function GroupForms({
  cycleId,
  groups,
  applications,
  members,
}: {
  cycleId: string;
  groups: { id: string; name: string; prompt: string }[];
  applications: { id: string; name: string }[];
  members: { group_id: string; application_id: string }[];
}) {
  const router = useRouter();
  function act(payload: Record<string, unknown>) {
    void fetch("/api/admin/rush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId, ...payload }) }).then(() => router.refresh());
  }
  return (
    <div className="grid gap-6">
      <form
        className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
        onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act({ action: "CREATE_GROUP", name: data.get("name"), prompt: data.get("prompt") }); }}
      >
        <h2 className="text-base font-semibold">New team</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          <FormField label="Team name" name="name" required placeholder="Team A" />
          <label className="block text-sm font-medium">
            Prompt
            <textarea
              name="prompt"
              placeholder="Engineering-flavored prompt"
              rows={3}
              className="mt-2 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
            />
          </label>
          <button className="button-primary mt-1 w-full">Create</button>
        </div>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const groupMembers = members.filter((member) => member.group_id === group.id);
          return (
            <section key={group.id} className="rounded-2xl bg-mecg-navy/[0.025] p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{group.name}</h3>
                <span className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-mecg-orange/15 px-2 py-0.5 font-mono text-[11px] font-bold text-mecg-orange-ink">
                  {groupMembers.length}
                </span>
              </div>
              {group.prompt && <p className="mt-1.5 text-sm text-mecg-navy/55">{group.prompt}</p>}
              <div className="mt-3 flex flex-col gap-1.5">
                {groupMembers.length === 0 ? (
                  <p className="text-[12.5px] text-mecg-navy/40">No members yet</p>
                ) : (
                  groupMembers.map((member) => {
                    const applicant = applications.find((application) => application.id === member.application_id);
                    return (
                      <div key={member.application_id} className="flex items-center gap-2">
                        <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">
                          {initials(applicant?.name ?? member.application_id)}
                        </span>
                        <span className="text-[13px] font-medium text-mecg-navy">{applicant?.name ?? member.application_id}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                className="mt-3.5 flex gap-2"
                onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act({ action: "ASSIGN_GROUP", groupId: group.id, applicationId: data.get("applicationId") }); }}
              >
                <ChevronSelect name="applicationId">
                  {applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
                </ChevronSelect>
                <button className="button-secondary text-sm">Assign</button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
