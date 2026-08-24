"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";

type Option = { id: string; label: string };

const CYCLE_STATUSES = ["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"];
const ROUND_STATUSES = ["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED"];

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
  canManageUsers,
  rounds,
  members,
  applications,
}: {
  cycleId: string;
  cycleStatus: string;
  canManageUsers: boolean;
  rounds: (Option & { status: string })[];
  members: Option[];
  applications: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function act(payload: Record<string, unknown>, form?: HTMLFormElement) {
    setPending(true);
    setError("");
    const response = await fetch("/api/admin/rush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId, ...payload }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Request failed");
    else { form?.reset(); router.refresh(); }
    setPending(false);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-3">
      {canManageUsers && (
        <form
          className="rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void act({ action: "ADD_USER", name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role") }, event.currentTarget);
          }}
        >
          <h2 className="text-base font-semibold">Add Member</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <FormField label="Full name" name="name" required placeholder="Full name" />
            <FormField label="Email" name="email" type="email" required placeholder="Email" />
            <FormField label="Temporary password" name="password" type="password" minLength={8} required placeholder="At least 8 characters" />
            <Select label="Role" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Member</option>
              <option value="BOARD">Board operations</option>
              <option value="PANEL">Hash decision panel</option>
            </Select>
            <button disabled={pending} className="button-primary mt-1 w-full">Add account or role</button>
          </div>
        </form>
      )}

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
          <button disabled={pending} className="button-primary mt-1 w-full">Add to cycle</button>
        </div>
      </form>

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
            {members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
          </Select>
          <button disabled={pending} className="button-primary mt-1 w-full">Create assignment</button>
        </div>
      </form>

      <div className="rounded-2xl bg-paper p-4 sm:p-5 lg:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-[240px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Cycle status</p>
            <form
              className="mt-2.5 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void act({ action: "SET_CYCLE_STATUS", status: data.get("status") });
              }}
            >
              <select
                name="status"
                defaultValue={cycleStatus}
                className="min-h-[30px] rounded-full bg-white px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
              >
                {CYCLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
              <button
                disabled={pending}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]"
              >
                Save
              </button>
            </form>
          </div>

          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Round controls</p>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {rounds.map((round) => (
                <form
                  key={round.id}
                  className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void act({ action: "SET_ROUND_STATUS", roundId: round.id, status: data.get("status") });
                  }}
                >
                  <span className="text-[13px] font-semibold">{round.label}</span>
                  <select
                    name="status"
                    defaultValue={round.status}
                    className="h-[26px] rounded-full px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] outline-none"
                  >
                    {ROUND_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <button
                    disabled={pending}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-mecg-navy hover:bg-mecg-blue/[0.12]"
                  >
                    Save
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-700 lg:col-span-3">{error}</p>}
    </section>
  );
}
