"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizedFetch } from "@/lib/client-fetch";

type Option = { id: string; label: string };

export default function RoundAssignmentForm({
  cycleId,
  roundId,
  applicants,
  evaluators,
}: {
  cycleId: string;
  roundId: string;
  applicants: Option[];
  evaluators: Option[];
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
    try {
      const response = await authorizedFetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN",
          cycleId,
          roundId,
          applicationId: data.get("applicationId"),
          evaluatorId: data.get("evaluatorId"),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not create assignment");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Could not create assignment");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-paper p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end lg:gap-3">
        <label className="min-w-0 text-sm font-medium">
          Applicant
          <select name="applicationId" required defaultValue="" className="select-control mt-2 text-sm">
            <option value="" disabled>Select an applicant</option>
            {applicants.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          Evaluator
          <select name="evaluatorId" required defaultValue="" className="select-control mt-2 text-sm">
            <option value="" disabled>Select an evaluator</option>
            {evaluators.map((evaluator) => <option key={evaluator.id} value={evaluator.id}>{evaluator.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending || !applicants.length || !evaluators.length} className="button-primary min-h-11 w-full sm:col-span-2 lg:col-span-1 lg:w-auto disabled:opacity-50">
          {pending ? "Assigning…" : "Add assignment"}
        </button>
      </div>
      <p className="mt-3 text-pretty text-xs leading-5 text-muted">Aim for two independent evaluations per applicant. Conflicts are blocked when the assignment is saved.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
