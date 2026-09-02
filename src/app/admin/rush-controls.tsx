"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { CLERK_PASSWORD_MIN_LENGTH } from "@/lib/clerk-password";
import { canTransitionCycle, canTransitionRound } from "@/lib/workflow";
import { cycleStatusLabel, memberRoleLabel, roundStatusLabel } from "@/lib/labels";

type Option = { id: string; label: string };
type MemberRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";
type MemberAccount = { id: string; name: string; role: MemberRole; active?: boolean };

const CYCLE_STATUSES = ["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"];
const ROUND_STATUSES = ["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"];
const MEMBER_ROLES: readonly { value: MemberRole; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "BOARD", label: "Board operations" },
  { value: "PANEL", label: "Hash decision panel" },
  { value: "RECRUITMENT_COMMITTEE", label: "Recruitment committee" },
  { value: "OWNER", label: "Owner" },
];

function Select({
  label,
  name,
  defaultValue,
  required,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="select-control mt-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

type ControlProps = { cycleId: string };

// Every control here posts the same shape to the same endpoint, so the
// request plumbing is shared and the components below stay pure markup.
function useRushAction(cycleId: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function act(payload: Record<string, unknown>, form?: HTMLFormElement) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, ...payload }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Request failed");
        return;
      }
      form?.reset();
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setPending(false);
    }
  }

  return { act, pending, error };
}

function ErrorNotice({ error }: { error: string }) {
  return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null;
}

const CARD = "rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]";

export function AddApplicantForm({ cycleId }: ControlProps) {
  const { act, pending, error } = useRushAction(cycleId);
  return (
    <section className="flex flex-col gap-3">
      <form
        className={CARD}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void act({ action: "ADD_APPLICANT", name: data.get("name"), contact: data.get("contact") }, event.currentTarget);
        }}
      >
        <h2 className="text-base font-semibold">Add applicant</h2>
        <p className="mt-1 text-xs leading-5 text-mecg-navy/60">For someone who could not use the public application.</p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <div className="flex-1"><FormField label="Full name" name="name" required placeholder="Jordan Lee" /></div>
          <div className="flex-1"><FormField label="Email or phone" name="contact" required placeholder="jlee@umich.edu" /></div>
          <button type="submit" disabled={pending} className="button-primary sm:w-auto">Add to cycle</button>
        </div>
      </form>
      <ErrorNotice error={error} />
    </section>
  );
}

export function PeopleControls({
  cycleId,
  currentUserId,
  memberAccounts,
}: ControlProps & { currentUserId: string; memberAccounts: MemberAccount[] }) {
  const { act, pending, error } = useRushAction(cycleId);
  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <form
          className={CARD}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "ADD_USER", name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role") }, event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Create account</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField label="Full name" name="name" required placeholder="Full name" />
            <FormField label="Email" name="email" type="email" required placeholder="Email" />
            <FormField label="Temporary password" name="password" type="password" minLength={CLERK_PASSWORD_MIN_LENGTH} required placeholder={`At least ${CLERK_PASSWORD_MIN_LENGTH} characters`} />
            <Select label="Role" name="role" defaultValue="MEMBER">
              {MEMBER_ROLES.filter((role) => role.value !== "OWNER").map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Create account</button>
          </div>
        </form>

        <form
          className={CARD}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "ADD_EXISTING_USER", email: data.get("email"), role: data.get("role") }, event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Existing account</h2>
          <p className="mt-1 text-xs leading-5 text-mecg-navy/60">Give an existing Supabase user access to this cycle.</p>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField label="Email" name="email" type="email" required placeholder="name@umich.edu" />
            <Select label="Role" name="role" defaultValue="MEMBER">
              {MEMBER_ROLES.filter((role) => role.value !== "OWNER").map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Add to cycle</button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-paper p-5">
        <div>
          <p className="text-[13px] font-semibold text-mecg-navy/50">Member roles</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Role changes apply to this recruitment cycle and are recorded in Activity.</p>
        </div>
        <div className="mt-4 grid gap-2">
          {memberAccounts.map((member) => {
            const isCurrentUser = member.id === currentUserId;
            const isActive = member.active !== false;
            return (
              <form
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void act({ action: "SET_MEMBER_ROLE", userId: member.id, role: data.get("role") });
                }}
              >
                <div>
                  <p className="text-[13px] font-semibold text-mecg-navy">{member.name}{isCurrentUser ? " · You" : ""}{!isActive ? " · Inactive" : ""}</p>
                  {isCurrentUser && <p className="mt-0.5 text-[11px] text-mecg-navy/60">Ask another owner to change your role.</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    name="role"
                    defaultValue={member.role}
                    disabled={pending || isCurrentUser || !isActive}
                    aria-label={`Role for ${member.name}`}
                    className="select-control w-44 text-[13px]"
                  >
                    {MEMBER_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                  <button
                    type="submit"
                    disabled={pending || isCurrentUser || !isActive}
                    className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:opacity-45"
                  >
                    Save
                  </button>
                  {isActive ? (
                    <button type="button" disabled={pending || isCurrentUser} onClick={() => {
                      const reason = window.prompt(`Why are you deactivating ${member.name}?`);
                      if (reason?.trim() && window.confirm(`Remove all cycle access for ${member.name}?`)) void act({ action: "DEACTIVATE_MEMBERSHIP", userId: member.id, reason });
                    }} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-red-700 shadow-[inset_0_0_0_1px_rgba(185,28,28,0.25)] disabled:opacity-45">Deactivate</button>
                  ) : (
                    <button type="button" disabled={pending || isCurrentUser} onClick={() => void act({ action: "RESTORE_MEMBERSHIP", userId: member.id })} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] disabled:opacity-45">Restore</button>
                  )}
                </div>
              </form>
            );
          })}
          {!memberAccounts.length && <p className="text-sm text-mecg-navy/60">Nobody has access to this cycle yet.</p>}
        </div>
      </div>
      <ErrorNotice error={error} />
    </section>
  );
}

export function RoundControls({
  cycleId,
  rounds,
  memberAccounts,
  applications,
  assignments,
}: ControlProps & {
  rounds: (Option & { status: string })[];
  memberAccounts: MemberAccount[];
  applications: Option[];
  assignments: Array<Option & { evaluatorId: string; evaluatorName: string; applicationName: string }>;
}) {
  const { act, pending, error } = useRushAction(cycleId);
  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <form
          className={CARD}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "ASSIGN", roundId: data.get("roundId"), applicationId: data.get("applicationId"), evaluatorId: data.get("evaluatorId") });
          }}
        >
          <h2 className="text-base font-semibold">Assign evaluator</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <Select label="Round" name="roundId" required>
              <option value="">Round</option>
              {rounds.map((round) => <option key={round.id} value={round.id}>{round.label}</option>)}
            </Select>
            <Select label="Applicant" name="applicationId" required>
              <option value="">Applicant</option>
              {applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}
            </Select>
            <Select label="Evaluator" name="evaluatorId" required>
              <option value="">Evaluator</option>
              {memberAccounts.map((member) => <option key={member.id} value={member.id}>{member.name} · {memberRoleLabel(member.role)}</option>)}
            </Select>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Create assignment</button>
          </div>
        </form>

        <div className="rounded-2xl bg-paper p-5">
          <p className="text-[13px] font-semibold text-mecg-navy/50">Round status</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Evaluation forms open when a round is open and lock when it is closed to edits.</p>
          <div className="mt-3 flex flex-col gap-2">
            {rounds.map((round) => (
              <form
                key={round.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void act({ action: "SET_ROUND_STATUS", roundId: round.id, status: data.get("status") });
                }}
              >
                <span className="text-[13px] font-semibold">{round.label}</span>
                <div className="flex items-center gap-2">
                  <select
                    name="status"
                    aria-label={`Status for ${round.label}`}
                    defaultValue={round.status}
                    className="select-control w-44 text-[13px]"
                  >
                    {ROUND_STATUSES.filter((status) => canTransitionRound(round.status, status)).map((status) => <option key={status} value={status}>{roundStatusLabel(status)}</option>)}
                  </select>
                  <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold text-mecg-navy hover:bg-mecg-blue/[0.12]">Save</button>
                </div>
              </form>
            ))}
            {!rounds.length && <p className="text-sm text-mecg-navy/45">No rounds configured yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-paper p-5">
        <p className="text-[13px] font-semibold text-mecg-navy/50">Open assignments</p>
        <p className="mt-1 text-sm text-mecg-navy/55">Only untouched assignments appear here. Submitted or draft evaluation evidence cannot be removed or transferred.</p>
        <div className="mt-3 grid gap-2">
          {assignments.map((assignment) => (
            <form key={assignment.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void act({ action: "REASSIGN", assignmentId: assignment.id, evaluatorId: data.get("evaluatorId") });
            }}>
              <div className="min-w-48 flex-1"><p className="text-[13px] font-semibold">{assignment.applicationName}</p><p className="text-xs text-mecg-navy/55">{assignment.label} · {assignment.evaluatorName}</p></div>
              <select name="evaluatorId" defaultValue={assignment.evaluatorId} aria-label={`Evaluator for ${assignment.applicationName}`} className="select-control w-48 text-xs">
                {memberAccounts.filter((member) => member.active !== false).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <button type="submit" disabled={pending} className="min-h-10 rounded-full px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)]">Reassign</button>
              <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Remove the assignment for ${assignment.applicationName}?`)) void act({ action: "UNASSIGN", assignmentId: assignment.id }); }} className="min-h-10 rounded-full px-3 text-xs font-semibold text-red-700 shadow-[inset_0_0_0_1px_rgba(185,28,28,0.25)]">Unassign</button>
            </form>
          ))}
          {!assignments.length && <p className="text-sm text-mecg-navy/55">No untouched assignments are available to change.</p>}
        </div>
      </div>
      <ErrorNotice error={error} />
    </section>
  );
}

export function CycleControls({ cycleId, cycleStatus }: ControlProps & { cycleStatus: string }) {
  const { act, pending, error } = useRushAction(cycleId);
  const nextStatuses = CYCLE_STATUSES.filter((status) => canTransitionCycle(cycleStatus, status));
  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-2xl bg-paper p-5">
        <p className="text-[13px] font-semibold text-mecg-navy/50">Cycle status</p>
        <p className="mt-1 text-sm text-mecg-navy/55">
          Currently {cycleStatusLabel(cycleStatus)}. Only the transitions the workflow allows are listed.
        </p>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "SET_CYCLE_STATUS", status: data.get("status") });
          }}
        >
          <select
            name="status"
            aria-label="Cycle status"
            defaultValue={cycleStatus}
            className="select-control flex-1 text-[13px] sm:max-w-xs"
          >
            {nextStatuses.map((status) => <option key={status} value={status}>{cycleStatusLabel(status)}</option>)}
          </select>
          <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]">Save</button>
        </form>
      </div>
      <ErrorNotice error={error} />
    </section>
  );
}

// Cloning is how next semester starts. It carries the rounds, the current
// rubric for each round, the application questions and the roster; it copies
// no applicant data at all. Owner-only, and the RPC re-checks that.
export function CloneCycleForm({ cycleId, cycleName }: ControlProps & { cycleName: string }) {
  const { act, pending, error } = useRushAction(cycleId);
  return (
    <section className="flex flex-col gap-3">
      <form
        className="rounded-2xl bg-paper p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void act({ action: "CLONE_CYCLE", name: data.get("name") }, event.currentTarget);
        }}
      >
        <p className="text-[13px] font-semibold text-mecg-navy/50">Start the next cycle</p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-mecg-navy/55">
          Copies the rounds, each round&rsquo;s current scoring guide, the application questions and everyone&rsquo;s access from
          {" "}{cycleName}. No applicants, evaluations, decisions or events come across. The new cycle starts as a draft.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <FormField label="New cycle name" name="name" required placeholder="Winter 2027" />
          </div>
          <button type="submit" disabled={pending} className="button-primary">
            {pending ? "Cloning\u2026" : "Clone this cycle"}
          </button>
        </div>
      </form>
      <ErrorNotice error={error} />
    </section>
  );
}
