"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { legalManualApplicationStatuses } from "@/lib/workflow";

export default function PipelineStatusForm({
  applicationId,
  cycleId,
  status,
}: {
  applicationId: string;
  cycleId: string;
  status: string;
  nonTerminalOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/rush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_APPLICATION_STATUS",
        cycleId,
        applicationId,
        status: data.get("status"),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not update status");
      setPending(false);
    } else {
      router.refresh();
      setPending(false);
    }
  }

  return (
    <form className="mt-1 flex flex-col items-start gap-1" onSubmit={submit}>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`status-${applicationId}`}>
          Pipeline status
        </label>
        <select
          id={`status-${applicationId}`}
          name="status"
          defaultValue={status}
          className="h-6 rounded-md bg-mecg-navy/[0.035] px-1.5 text-[10px] font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
        >
          {legalManualApplicationStatuses(status).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          disabled={pending}
          className="h-6 rounded-md px-2 text-[10px] font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Moving…" : "Move"}
        </button>
      </div>
      {error && <p role="alert" className="text-[10px] text-red-700">{error}</p>}
    </form>
  );
}
