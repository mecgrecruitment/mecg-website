"use client";

import { useState } from "react";
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

async function act(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/rush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, error: body?.error as string | undefined };
}

function ChevronSelect({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <div className="relative flex-1">
      <label className="sr-only" htmlFor={`${name}-select`}>
        {label}
      </label>
      <select
        id={`${name}-select`}
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

function AssignForm({ cycleId, group, applications }: { cycleId: string; group: { id: string; name: string }; applications: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await act({ cycleId, action: "ASSIGN_GROUP", groupId: group.id, applicationId: data.get("applicationId") });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not assign applicant");
    } else {
      router.refresh();
    }
  }

  return (
    <form className="mt-3.5 flex flex-col gap-2" onSubmit={submit}>
      <div className="flex gap-2">
        <ChevronSelect name={`applicationId-${group.id}`} label={`Assign applicant to ${group.name}`}>
          {applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </ChevronSelect>
        <button disabled={pending} className="button-secondary text-sm disabled:opacity-50">
          {pending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act({ cycleId, action: "CREATE_GROUP", name: data.get("name"), prompt: data.get("prompt") });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create team");
    } else {
      form.reset();
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
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
          <button disabled={pending} className="button-primary mt-1 w-full disabled:opacity-50">
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
              <AssignForm cycleId={cycleId} group={group} applications={applications} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
