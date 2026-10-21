"use client";

import { useState, type ReactNode } from "react";
import { useAction } from "@/lib/use-action";
import FormField from "@/components/form-field";
import StatTile from "@/components/stat-tile";
import { initials } from "@/lib/initials";

function ChevronSelect({ id, name, label, children }: { id: string; name: string; label: string; children: ReactNode }) {
  return (
    <div className="flex-1">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="select-control text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function AssignForm({ cycleId, group, applications, memberIds }: { cycleId: string; group: { id: string; name: string }; applications: { id: string; name: string }[]; memberIds: string[] }) {
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
          {applications.filter((application) => !memberIds.includes(application.id)).map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </ChevronSelect>
        <button type="submit" disabled={pending} className="button-secondary text-sm disabled:opacity-50">
          {pending ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
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
        className={`text-xs font-semibold disabled:opacity-50 ${danger ? "text-danger" : "text-muted hover:text-mecg-orange-ink"}`}
      >
        {pending ? "Working…" : children}
      </button>
      {error && <span role="alert" className="mt-1 text-right text-xs text-danger">{error}</span>}
    </span>
  );
}

export default function GroupForms({
  cycleId,
  groups,
  applications,
  members,
  gradersByGroup,
}: {
  cycleId: string;
  groups: { id: string; name: string; prompt: string }[];
  applications: { id: string; name: string }[];
  members: { group_id: string; application_id: string }[];
  gradersByGroup?: Record<string, number>;
}) {
  const { pending, error, run } = useAction("/api/admin/rush", "Could not create team");
  const forming = useAction("/api/admin/rush", "Could not form teams");
  const [groupSize, setGroupSize] = useState(3);
  const unassigned = Math.max(0, applications.length - new Set(members.map((member) => member.application_id)).size);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await run({ cycleId, action: "CREATE_GROUP", name: data.get("name"), prompt: data.get("prompt") });
    if (result.ok) form.reset();
  }

  async function formTeams(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await forming.run({ cycleId, action: "FORM_GROUPS", groupSize: Number(data.get("groupSize")) });
  }

  return (
    <div className="grid gap-6">
      {unassigned > 0 && (
        <form
          className="rounded-xl p-[18px] inset-ring inset-ring-line"
          onSubmit={formTeams}
        >
          <h2 className="text-base font-semibold">Form teams</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField
              label="Team size"
              name="groupSize"
              type="number"
              min={2}
              max={10}
              required
              value={groupSize}
              onChange={(event) => setGroupSize(Number(event.currentTarget.value))}
              hint="Unplaced applicants are dealt at random into new lettered teams; existing teams are left alone."
            />
            <button type="submit" disabled={forming.pending} className="button-primary mt-1 w-full disabled:opacity-50">
              {forming.pending ? "Forming…" : `Form teams of ${groupSize} from ${unassigned} unplaced`}
            </button>
            {forming.error && <p role="alert" className="text-sm text-danger">{forming.error}</p>}
          </div>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [String(groups.length), "teams"],
          [String(members.length), "assigned applicants"],
          [String(unassigned), "unassigned applicants"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl bg-mecg-navy px-4 py-3">
            <StatTile value={value} label={label} tone="dark" />
          </div>
        ))}
      </div>
      <details className="rounded-xl p-[18px] inset-ring inset-ring-line">
        <summary className="cursor-pointer text-sm font-semibold text-muted">Add a team by hand</summary>
        <form onSubmit={submit}>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField label="Team name" name="name" required placeholder="Team A" />
            <label className="block text-sm font-medium">
              Prompt
              <textarea
                name="prompt"
                placeholder="Engineering-flavored prompt"
                rows={3}
                className="mt-2 w-full rounded-xl bg-wash px-4 py-3 text-sm inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              />
            </label>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full disabled:opacity-50">
              {pending ? "Creating…" : "Create"}
            </button>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        </form>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const groupMembers = members.filter((member) => member.group_id === group.id);
          const graders = gradersByGroup?.[group.id] ?? 0;
          return (
            <section key={group.id} className="rounded-xl bg-wash p-4 inset-ring inset-ring-line">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{group.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-mecg-orange/15 px-2 py-0.5 tabular text-xs font-bold text-mecg-orange-ink">
                    {groupMembers.length}
                  </span>
                  {gradersByGroup && graders > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-wash px-2 py-0.5 tabular text-xs font-bold text-muted">
                      {graders} grading
                    </span>
                  )}
                  {gradersByGroup && graders === 0 && groupMembers.length > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-mecg-orange/15 px-2 py-0.5 text-xs font-bold text-mecg-orange-ink">
                      No grader yet
                    </span>
                  )}
                  {groupMembers.length === 0 && (
                    <GroupActionButton cycleId={cycleId} payload={{ action: "DELETE_GROUP", groupId: group.id }} danger>Delete</GroupActionButton>
                  )}
                </div>
              </div>
              {group.prompt && <p className="mt-1.5 text-sm text-muted">{group.prompt}</p>}
              <div className="mt-3 flex flex-col gap-1.5">
                {groupMembers.length === 0 ? (
                  <p className="text-[13px] text-muted">No members yet</p>
                ) : (
                  groupMembers.map((member) => {
                    const applicant = applications.find((application) => application.id === member.application_id);
                    return (
                      <div key={member.application_id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-mecg-navy text-xs font-semibold text-white">
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
              <AssignForm cycleId={cycleId} group={group} applications={applications} memberIds={groupMembers.map((member) => member.application_id)} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
