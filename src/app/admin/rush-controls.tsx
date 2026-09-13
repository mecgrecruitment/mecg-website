"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FormField from "@/components/form-field";
import { CLERK_PASSWORD_MIN_LENGTH } from "@/lib/clerk-password";
import { canTransitionCycle, canTransitionRound } from "@/lib/workflow";
import { cycleStatusLabel, memberRoleLabel, roundStatusLabel } from "@/lib/labels";

type Option = { id: string; label: string };
type MemberRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";
type MemberAccount = { id: string; name: string; role: MemberRole; roles: MemberRole[]; active?: boolean };
const NO_DUPLICATE_ACCOUNT_IDS: string[] = [];

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
        return false;
      }
      form?.reset();
      router.refresh();
      return true;
    } catch {
      setError("Request failed");
      return false;
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

function JsonActionForm({ className, onSubmitData, children }: {
  className?: string;
  onSubmitData: (data: FormData, form: HTMLFormElement) => void;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitData(new FormData(event.currentTarget), event.currentTarget);
  }

  return <form className={className} onSubmit={handleSubmit}>{children}</form>;
}

export function AddApplicantForm({ cycleId }: ControlProps) {
  const { act, pending, error } = useRushAction(cycleId);
  return (
    <section className="flex flex-col gap-3">
      <JsonActionForm
        className={CARD}
        onSubmitData={(data, form) => void act({ action: "ADD_APPLICANT", name: data.get("name"), contact: data.get("contact") }, form)}
      >
        <h2 className="text-base font-semibold">Add applicant</h2>
        <p className="mt-1 text-xs leading-5 text-mecg-navy/60">For someone who could not use the public application.</p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <div className="flex-1"><FormField label="Full name" name="name" required placeholder="Jordan Lee" /></div>
          <div className="flex-1"><FormField label="Email or phone" name="contact" required placeholder="jlee@umich.edu" /></div>
          <button type="submit" disabled={pending} className="button-primary sm:w-auto">Add to cycle</button>
        </div>
      </JsonActionForm>
      <ErrorNotice error={error} />
    </section>
  );
}

export function PeopleControls({
  cycleId,
  currentUserId,
  memberAccounts,
  duplicateAccountIds = NO_DUPLICATE_ACCOUNT_IDS,
}: ControlProps & { currentUserId: string; memberAccounts: MemberAccount[]; duplicateAccountIds?: string[] }) {
  const { act, pending, error } = useRushAction(cycleId);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | MemberRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const duplicateIds = useMemo(() => new Set(duplicateAccountIds), [duplicateAccountIds]);
  const visibleAccounts = memberAccounts.filter((member) => {
    if (query && !member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) return false;
    if (roleFilter !== "ALL" && member.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && member.active === false) return false;
    if (statusFilter === "INACTIVE" && member.active !== false) return false;
    return true;
  });

  return (
    <section aria-labelledby="access-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[13px] font-semibold text-mecg-navy/55">Owner controls</p><h2 id="access-heading" className="mt-1 text-xl font-semibold">Membership access</h2><p className="mt-1 text-sm text-mecg-navy/60">Roles are exclusive for this cycle. Every change is recorded in Activity.</p></div>
        <div className="flex gap-2"><Link href="/admin/audit" className="button-secondary">View activity</Link><button type="button" onClick={() => setShowAdd((value) => !value)} aria-expanded={showAdd} className="button-primary">{showAdd ? "Close" : "Add person"}</button></div>
      </div>

      {duplicateAccountIds.length > 0 && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 shadow-[inset_0_0_0_1px_rgba(180,83,9,0.18)]"><p className="font-semibold">Possible duplicate accounts need review</p><p className="mt-1 leading-6">{duplicateAccountIds.length} account records share an exact verified email with another profile. They remain separate so no history or permissions are silently merged.</p></div>}

      {showAdd && <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <JsonActionForm className={CARD} onSubmitData={(data, form) => void act({ action: "ADD_USER", name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role") }, form)}>
          <h3 className="text-base font-semibold">Create a new account</h3><p className="mt-1 text-xs leading-5 text-mecg-navy/60">Use this only when the person does not already have a Clerk account.</p>
          <div className="mt-3 flex flex-col gap-2.5"><FormField label="Full name" name="name" required placeholder="Full name" /><FormField label="Email" name="email" type="email" required placeholder="Email" /><FormField label="Temporary password" name="password" type="password" minLength={CLERK_PASSWORD_MIN_LENGTH} required placeholder={`At least ${CLERK_PASSWORD_MIN_LENGTH} characters`} /><Select label="Role" name="role" defaultValue="MEMBER">{MEMBER_ROLES.filter((role) => role.value !== "OWNER").map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select><button type="submit" disabled={pending} className="button-primary mt-1 w-full">Create account</button></div>
        </JsonActionForm>
        <JsonActionForm className={CARD} onSubmitData={(data, form) => void act({ action: "ADD_EXISTING_USER", email: data.get("email"), role: data.get("role") }, form)}>
          <h3 className="text-base font-semibold">Add an existing account</h3><p className="mt-1 text-xs leading-5 text-mecg-navy/60">Give an existing account access to this recruitment cycle.</p>
          <div className="mt-3 flex flex-col gap-2.5"><FormField label="Email" name="email" type="email" required placeholder="name@umich.edu" /><Select label="Role" name="role" defaultValue="MEMBER">{MEMBER_ROLES.filter((role) => role.value !== "OWNER").map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select><button type="submit" disabled={pending} className="button-primary mt-1 w-full">Add to cycle</button></div>
        </JsonActionForm>
        <ErrorNotice error={error} />
      </div>}

      <div className="mt-5 rounded-2xl bg-paper p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_13rem_11rem]">
          <label><span className="sr-only">Search accounts</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-control text-base sm:text-sm" placeholder="Search member name" /></label>
          <label><span className="sr-only">Filter accounts by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "ALL" | MemberRole)} className="select-control text-base sm:text-sm"><option value="ALL">Every role</option>{MEMBER_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <label><span className="sr-only">Filter accounts by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")} className="select-control text-base sm:text-sm"><option value="ALL">Every status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        </div>
        <p className="mt-3 text-xs text-mecg-navy/60" aria-live="polite">Showing <span className="tabular-nums">{visibleAccounts.length}</span> of <span className="tabular-nums">{memberAccounts.length}</span> accounts</p>
        <div className="mt-3 grid gap-2">
          {visibleAccounts.map((member) => <MemberAccessRow key={`${member.id}:${member.role}:${member.active}`} cycleId={cycleId} member={member} isCurrentUser={member.id === currentUserId} possibleDuplicate={duplicateIds.has(member.id)} />)}
          {!visibleAccounts.length && <div className="rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center text-sm text-mecg-navy/60">{memberAccounts.length ? "No accounts match these filters." : "Nobody has access to this cycle yet."}</div>}
        </div>
      </div>
    </section>
  );
}

function DeactivateMembershipDialog({ member, pending, onCancel, onConfirm }: { member: MemberAccount; pending: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return (
    <dialog ref={dialogRef} aria-labelledby="deactivate-membership-title" onClose={onCancel} onCancel={onCancel} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-mecg-navy shadow-2xl backdrop:bg-mecg-navy/50">
      <div className="p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-red-700">Remove cycle access</p>
        <h3 id="deactivate-membership-title" className="mt-1 text-xl font-semibold">Deactivate {member.name}?</h3>
        <p className="mt-2 text-sm leading-6 text-mecg-navy/65">This removes every active role for this cycle. Their saved work and audit history remain intact.</p>
        <label className="mt-4 block text-sm font-semibold">Reason
          <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="field-control mt-2 min-h-24 py-3 text-sm" placeholder="Why is access being removed?" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="button-secondary">Cancel</button>
          <button type="button" disabled={pending || !reason.trim()} onClick={() => onConfirm(reason.trim())} className="inline-flex min-h-11 items-center rounded-full bg-red-700 px-4 text-sm font-semibold text-white transition-[background-color,scale] hover:bg-red-800 active:scale-[0.96] disabled:opacity-45">{pending ? "Deactivating…" : "Deactivate access"}</button>
        </div>
      </div>
    </dialog>
  );
}

function MemberAccessSummary({ member, isCurrentUser, possibleDuplicate, isActive }: {
  member: MemberAccount;
  isCurrentUser: boolean;
  possibleDuplicate: boolean;
  isActive: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-mecg-navy">{member.name}{isCurrentUser ? " · You" : ""}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? "bg-emerald-50 text-emerald-800" : "bg-mecg-navy/[0.06] text-mecg-navy/60"}`}>{isActive ? "Active" : "Inactive"}</span>
        {possibleDuplicate && <span className="text-[11px] font-semibold text-amber-800">Possible duplicate</span>}
        {member.roles.length > 1 && <span className="text-[11px] text-mecg-navy/55">Currently has {member.roles.length} role records</span>}
      </div>
      {isCurrentUser && <p className="mt-1 text-[11px] text-mecg-navy/60">Ask another owner to change your role.</p>}
    </div>
  );
}

function MemberAccessActions({ pending, isCurrentUser, isActive, roleChanged, onSave, onDeactivate, onRestore }: {
  pending: boolean;
  isCurrentUser: boolean;
  isActive: boolean;
  roleChanged: boolean;
  onSave: () => void;
  onDeactivate: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex gap-2 md:justify-end">
      <button type="button" disabled={pending || isCurrentUser || !isActive || !roleChanged} onClick={onSave} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:opacity-40">{pending ? "Saving…" : "Save"}</button>
      {isActive
        ? <button type="button" disabled={pending || isCurrentUser} onClick={onDeactivate} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-red-700 shadow-[inset_0_0_0_1px_rgba(185,28,28,0.25)] disabled:opacity-40">Deactivate</button>
        : <button type="button" disabled={pending || isCurrentUser} onClick={onRestore} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] disabled:opacity-40">Restore</button>}
    </div>
  );
}

function MemberAccessRow({ cycleId, member, isCurrentUser, possibleDuplicate }: { cycleId: string; member: MemberAccount; isCurrentUser: boolean; possibleDuplicate: boolean }) {
  const { act, pending, error } = useRushAction(cycleId);
  const roleRef = useRef<HTMLSelectElement>(null);
  const [roleChanged, setRoleChanged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isActive = member.active !== false;

  async function saveRole() {
    const role = roleRef.current?.value as MemberRole | undefined;
    if (!role) return;
    if (await act({ action: "SET_MEMBER_ROLE", userId: member.id, role })) setRoleChanged(false);
  }

  return (
    <div className={`rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] ${possibleDuplicate ? "ring-1 ring-amber-500/35" : ""}`}>
      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_11rem_auto] md:items-center">
        <MemberAccessSummary member={member} isCurrentUser={isCurrentUser} possibleDuplicate={possibleDuplicate} isActive={isActive} />
        <select ref={roleRef} defaultValue={member.role} onChange={(event) => setRoleChanged(event.target.value !== member.role)} disabled={pending || isCurrentUser || !isActive} aria-label={`Role for ${member.name}`} className="select-control w-full text-base sm:text-sm">{MEMBER_ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <MemberAccessActions
          pending={pending}
          isCurrentUser={isCurrentUser}
          isActive={isActive}
          roleChanged={roleChanged}
          onSave={() => void saveRole()}
          onDeactivate={() => setConfirming(true)}
          onRestore={() => void act({ action: "RESTORE_MEMBERSHIP", userId: member.id })}
        />
      </div>
      <ErrorNotice error={error} />
      {confirming && <DeactivateMembershipDialog member={member} pending={pending} onCancel={() => setConfirming(false)} onConfirm={(reason) => { void act({ action: "DEACTIVATE_MEMBERSHIP", userId: member.id, reason }).then((ok) => { if (ok) setConfirming(false); }); }} />}
    </div>
  );
}

export function RoundControls({
  cycleId,
  rounds,
  memberAccounts,
  applications,
  assignments,
  assignable = true,
}: ControlProps & {
  rounds: (Option & { status: string })[];
  memberAccounts: MemberAccount[];
  applications: Option[];
  assignments: Array<Option & { evaluatorId: string; evaluatorName: string; applicationName: string }>;
  // Speed Dating has no pre-assignment: graders pick their own tables, so
  // the assign and reassign panels are hidden and only round status remains.
  assignable?: boolean;
}) {
  const { act, pending, error } = useRushAction(cycleId);
  const activeMemberAccounts = memberAccounts.filter((member) => member.active !== false);
  return (
    <section className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {assignable && <JsonActionForm
          className={CARD}
          onSubmitData={(data) => void act({ action: "ASSIGN", roundId: data.get("roundId"), applicationId: data.get("applicationId"), evaluatorId: data.get("evaluatorId") })}
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
        </JsonActionForm>}

        <div className="rounded-2xl bg-paper p-5">
          <p className="text-[13px] font-semibold text-mecg-navy/50">Round status</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Evaluation forms open when a round is open and lock when it is closed to edits.</p>
          <div className="mt-3 flex flex-col gap-2">
            {rounds.map((round) => (
              <JsonActionForm
                key={round.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
                onSubmitData={(data) => void act({ action: "SET_ROUND_STATUS", roundId: round.id, status: data.get("status") })}
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
              </JsonActionForm>
            ))}
            {!rounds.length && <p className="text-sm text-mecg-navy/45">No rounds configured yet.</p>}
          </div>
        </div>
      </div>
      {assignable && <div className="rounded-2xl bg-paper p-5">
        <p className="text-[13px] font-semibold text-mecg-navy/50">Open assignments</p>
        <p className="mt-1 text-sm text-mecg-navy/55">Only untouched assignments appear here. Submitted or draft evaluation evidence cannot be removed or transferred.</p>
        <div className="mt-3 grid gap-2">
          {assignments.map((assignment) => (
            <JsonActionForm key={assignment.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]" onSubmitData={(data) => void act({ action: "REASSIGN", assignmentId: assignment.id, evaluatorId: data.get("evaluatorId") })}>
              <div className="min-w-48 flex-1"><p className="text-[13px] font-semibold">{assignment.applicationName}</p><p className="text-xs text-mecg-navy/55">{assignment.label} · {assignment.evaluatorName}</p></div>
              <select name="evaluatorId" defaultValue={assignment.evaluatorId} aria-label={`Evaluator for ${assignment.applicationName}`} className="select-control w-48 text-xs">
                {activeMemberAccounts.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <button type="submit" disabled={pending} className="min-h-10 rounded-full px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)]">Reassign</button>
              <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Remove the assignment for ${assignment.applicationName}?`)) void act({ action: "UNASSIGN", assignmentId: assignment.id }); }} className="min-h-10 rounded-full px-3 text-xs font-semibold text-red-700 shadow-[inset_0_0_0_1px_rgba(185,28,28,0.25)]">Unassign</button>
            </JsonActionForm>
          ))}
          {!assignments.length && <p className="text-sm text-mecg-navy/55">No untouched assignments are available to change.</p>}
        </div>
      </div>}
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
        <JsonActionForm
          className="mt-3 flex items-center gap-2"
          onSubmitData={(data) => void act({ action: "SET_CYCLE_STATUS", status: data.get("status") })}
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
        </JsonActionForm>
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
      <JsonActionForm
        className="rounded-2xl bg-paper p-5"
        onSubmitData={(data, form) => void act({ action: "CLONE_CYCLE", name: data.get("name") }, form)}
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
      </JsonActionForm>
      <ErrorNotice error={error} />
    </section>
  );
}
