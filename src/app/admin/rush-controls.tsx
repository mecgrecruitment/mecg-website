"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { canTransitionCycle, canTransitionRound } from "@/lib/workflow";

type Option = { id: string; label: string };
type MemberRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";
type MemberAccount = { id: string; name: string; role: MemberRole };

const CYCLE_STATUSES = ["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"];
const ROUND_STATUSES = ["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED"];
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
      <div className="relative mt-2">
        <select
          name={name}
          defaultValue={defaultValue}
          required={required}
          className="min-h-12 w-full appearance-none rounded-xl bg-mecg-navy/[0.035] px-4 pr-10 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        >
          {children}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mecg-navy/40"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    </label>
  );
}

export default function RushControls({
  cycleId,
  cycleStatus,
  canOperate,
  canManageCycle,
  canManageMemberships,
  currentUserId,
  rounds,
  memberAccounts,
  applications,
}: {
  cycleId: string;
  cycleStatus: string;
  canOperate: boolean;
  canManageCycle: boolean;
  canManageMemberships: boolean;
  currentUserId: string;
  rounds: (Option & { status: string })[];
  memberAccounts: MemberAccount[];
  applications: Option[];
}) {
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

  return (
    <section className="flex flex-col gap-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Quick actions</p>
      <div className="-mt-2 grid gap-5 lg:grid-cols-3">
      {canManageMemberships && (
        <form
          className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
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
            <FormField label="Temporary password" name="password" type="password" minLength={8} required placeholder="At least 8 characters" />
            <Select label="Role" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Member</option>
              <option value="BOARD">Board operations</option>
              <option value="PANEL">Hash decision panel</option>
              <option value="RECRUITMENT_COMMITTEE">Recruitment committee</option>
            </Select>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Create account</button>
          </div>
        </form>
      )}

      {canManageMemberships && (
        <form
          className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "ADD_EXISTING_USER", email: data.get("email"), role: data.get("role") }, event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Existing account</h2>
          <p className="mt-1 text-xs leading-5 text-mecg-navy/50">Give an existing Supabase user access to this cycle.</p>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField label="Email" name="email" type="email" required placeholder="name@umich.edu" />
            <Select label="Role" name="role" defaultValue="MEMBER">
              {MEMBER_ROLES.filter((role) => role.value !== "OWNER").map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
            <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Add to cycle</button>
          </div>
        </form>
      )}

      {canOperate && (
        <form
        className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void act({ action: "ADD_APPLICANT", name: data.get("name"), contact: data.get("contact") }, event.currentTarget);
        }}
      >
        <h2 className="text-base font-semibold">Add applicant</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          <FormField label="Full name" name="name" required placeholder="Jordan Lee" />
          <FormField label="Email or phone" name="contact" required placeholder="jlee@umich.edu" />
          <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Add to cycle</button>
        </div>
      </form>
      )}

      {canOperate && (
        <form
        className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
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
            {memberAccounts.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}
          </Select>
          <button type="submit" disabled={pending} className="button-primary mt-1 w-full">Create assignment</button>
        </div>
      </form>
      )}
      </div>

      {canManageMemberships && (
        <div className="rounded-2xl bg-paper p-5">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Member roles</p>
            <p className="mt-1 text-sm text-mecg-navy/55">Role changes apply to this recruitment cycle and are recorded in the audit log.</p>
          </div>
          <div className="mt-4 grid gap-2">
            {memberAccounts.map((member) => {
              const isCurrentUser = member.id === currentUserId;
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
                    <p className="text-[13px] font-semibold text-mecg-navy">{member.name}{isCurrentUser ? " · You" : ""}</p>
                    {isCurrentUser && <p className="mt-0.5 text-[11px] text-mecg-navy/45">Ask another owner to change your role.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      name="role"
                      defaultValue={member.role}
                      disabled={pending || isCurrentUser}
                      aria-label={`Role for ${member.name}`}
                      className="min-h-10 rounded-full bg-white px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16)] outline-none disabled:opacity-55"
                    >
                      {MEMBER_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                    <button
                      type="submit"
                      disabled={pending || isCurrentUser}
                      className="inline-flex min-h-10 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:opacity-45"
                    >
                      Save
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {canManageCycle && <div className="rounded-2xl bg-paper p-5">
        <div className="grid gap-6 sm:grid-cols-[220px_1fr] sm:divide-x sm:divide-mecg-navy/10">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Cycle status</p>
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
                className="min-h-10 flex-1 rounded-full bg-white px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
              >
                {CYCLE_STATUSES.filter((status) => canTransitionCycle(cycleStatus, status)).map((status) => <option key={status}>{status}</option>)}
              </select>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-10 items-center rounded-full px-3.5 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]"
              >
                Save
              </button>
            </form>
          </div>

          <div className="sm:pl-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Round controls</p>
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
                      className="h-[30px] rounded-full px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] outline-none"
                    >
                      {ROUND_STATUSES.filter((status) => canTransitionRound(round.status, status)).map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full px-3 py-1 text-[11px] font-semibold text-mecg-navy hover:bg-mecg-blue/[0.12]"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ))}
              {!rounds.length && <p className="text-sm text-mecg-navy/45">No rounds configured yet.</p>}
            </div>
          </div>
        </div>
      </div>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
