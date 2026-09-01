"use client";

import type { ReactNode } from "react";
import { useAction } from "@/lib/use-action";
import FormField from "@/components/form-field";
import StatTile from "@/components/stat-tile";
import { initials } from "@/lib/initials";

function ChevronSelect({ id, name, label, children }: { id: string; name: string; label: string; children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
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
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mecg-navy/60"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  );
}

function AssignForm({ cycleId, group, applications }: { cycleId: string; group: { id: string; name: string }; applications: { id: string; name: string }[] }) {
  const { pending, error, run } = useAction("/api/admin/rush", "Could not assign applicant");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run({ cycleId, action: "ASSIGN_GROUP", groupId: group.id, applicationId: data.get("applicationId") });
  }

  return (
    <form className="mt-3.5 flex flex-col gap-2" onSubmit={submit}>
      <div className="flex gap-2">
        <ChevronSelect id={`application-${group.id}`} name="applicationId" label={`Assign applicant to ${group.name}`}>
          {applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </ChevronSelect>
        <button type="submit" disabled={pending} className="button-secondary text-sm disabled:opacity-50">
          {pending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}

function GroupActionButton({
  cycleId,
  payload,
  children,
  danger = false,
}: {
  cycleId: string;
  payload: Record<string, unknown>;
  children: ReactNode;
  danger?: boolean;
}) {
  const { pending, error, run } = useAction("/api/admin/rush", "Could not update the team");

  async function handleClick() {
    if (danger && !window.confirm("Delete this empty team?")) return;
    await run({ cycleId, ...payload });
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={`text-xs font-semibold disabled:opacity-50 ${danger ? "text-red-700" : "text-mecg-navy/60 hover:text-mecg-orange-ink"}`}
      >
        {pending ? "Working…" : children}
      </button>
      {error && <span role="alert" className="mt-1 text-right text-[11px] text-red-700">{error}</span>}
    </span>
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
  const { pending, error, run } = useAction("/api/admin/rush", "Could not create team");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await run({ cycleId, action: "CREATE_GROUP", name: data.get("name"), prompt: data.get("prompt") });
    if (result.ok) form.reset();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [String(groups.length), "teams"],
          [String(members.length), "assigned applicants"],
          [String(Math.max(0, applications.length - new Set(members.map((member) => member.application_id)).size)), "unassigned applicants"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl bg-mecg-navy px-4 py-3">
            <StatTile value={value} label={label} tone="dark" />
          </div>
        ))}
      </div>
      <form
        className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
        onSubmit={submit}
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
          <button type="submit" disabled={pending} className="button-primary mt-1 w-full disabled:opacity-50">
            {pending ? "Creating…" : "Create"}
          </button>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const groupMembers = members.filter((member) => member.group_id === group.id);
          return (
            <section key={group.id} className="rounded-2xl bg-mecg-navy/[0.025] p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{group.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-mecg-orange/15 px-2 py-0.5 font-mono text-[11px] font-bold text-mecg-orange-ink">
                    {groupMembers.length}
                  </span>
                  {groupMembers.length === 0 && (
                    <GroupActionButton cycleId={cycleId} payload={{ action: "DELETE_GROUP", groupId: group.id }} danger>Delete</GroupActionButton>
                  )}
                </div>
              </div>
              {group.prompt && <p className="mt-1.5 text-sm text-mecg-navy/55">{group.prompt}</p>}
              <div className="mt-3 flex flex-col gap-1.5">
                {groupMembers.length === 0 ? (
                  <p className="text-[12.5px] text-mecg-navy/60">No members yet</p>
                ) : (
                  groupMembers.map((member) => {
                    const applicant = applications.find((application) => application.id === member.application_id);
                    return (
                      <div key={member.application_id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy font-mono text-[10px] font-semibold text-white">
                            {initials(applicant?.name ?? member.application_id)}
                          </span>
                          <span className="text-[13px] font-medium text-mecg-navy">{applicant?.name ?? member.application_id}</span>
                        </div>
                        <GroupActionButton cycleId={cycleId} payload={{ action: "UNASSIGN_GROUP", groupId: group.id, applicationId: member.application_id }}>Remove</GroupActionButton>
                      </div>
                    );
                  })
                )}
              </div>
              <AssignForm cycleId={cycleId} group={group} applications={applications} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
