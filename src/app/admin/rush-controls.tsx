"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

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
      {canManageUsers && <form className="rounded-xl border p-5" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "ADD_USER", name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role") }, event.currentTarget); }}>
        <h2 className="font-semibold">Add Member</h2>
        <div className="mt-3 flex flex-col gap-2"><input name="name" required placeholder="Full name" className="rounded border px-3 py-2" /><input name="email" type="email" required placeholder="Email" className="rounded border px-3 py-2" /><input name="password" type="password" minLength={10} required placeholder="Temporary password" className="rounded border px-3 py-2" /><select name="role" className="rounded border px-3 py-2"><option value="MEMBER">Member</option><option value="BOARD">Board operations</option><option value="PANEL">Hash decision panel</option></select><button disabled={pending} className="rounded bg-slate-950 px-3 py-2 text-white">Add account or role</button></div>
      </form>}

      <form className="rounded-xl border p-5" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "ADD_APPLICANT", name: data.get("name"), contact: data.get("contact") }, event.currentTarget); }}>
        <h2 className="font-semibold">Add applicant</h2>
        <div className="mt-3 flex flex-col gap-2"><input name="name" required placeholder="Full name" className="rounded border px-3 py-2" /><input name="contact" required placeholder="Email or phone" className="rounded border px-3 py-2" /><button disabled={pending} className="rounded bg-slate-950 px-3 py-2 text-white">Add to cycle</button></div>
      </form>

      <form className="rounded-xl border p-5" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "ASSIGN", roundId: data.get("roundId"), applicationId: data.get("applicationId"), evaluatorId: data.get("evaluatorId") }); }}>
        <h2 className="font-semibold">Assign evaluator</h2>
        <div className="mt-3 flex flex-col gap-2"><select name="roundId" required className="rounded border px-3 py-2"><option value="">Round</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.label}</option>)}</select><select name="applicationId" required className="rounded border px-3 py-2"><option value="">Applicant</option>{applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}</select><select name="evaluatorId" required className="rounded border px-3 py-2"><option value="">Evaluator</option>{members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}</select><button disabled={pending} className="rounded bg-slate-950 px-3 py-2 text-white">Create assignment</button></div>
      </form>

      <div className="rounded-xl border p-5 lg:col-span-3">
        <form className="mb-4 flex flex-wrap items-center gap-2 border-b pb-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "SET_CYCLE_STATUS", status: data.get("status") }); }}><span className="font-medium">Cycle status</span><select name="status" defaultValue={cycleStatus} className="rounded border px-2 py-1 text-sm">{["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"].map((status) => <option key={status}>{status}</option>)}</select><button className="rounded border bg-white px-2 py-1 text-sm" disabled={pending}>Save</button></form>
        <h2 className="font-semibold">Round controls</h2>
        <div className="mt-3 flex flex-wrap gap-3">{rounds.map((round) => <form key={round.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act({ action: "SET_ROUND_STATUS", roundId: round.id, status: data.get("status") }); }}><span className="text-sm font-medium">{round.label}</span><select name="status" defaultValue={round.status} className="rounded border px-2 py-1 text-sm">{["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED"].map((status) => <option key={status}>{status}</option>)}</select><button className="rounded border bg-white px-2 py-1 text-sm" disabled={pending}>Save</button></form>)}</div>
      </div>
      {error && <p className="text-sm text-red-700 lg:col-span-3">{error}</p>}
    </section>
  );
}
