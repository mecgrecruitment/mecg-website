"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { legalManualApplicationStatuses } from "@/lib/workflow";
import OperationNotice from "@/components/operation-notice";

export default function PipelineStatusForm({
  applicationId,
  cycleId,
  status,
  controlId,
}: {
  applicationId: string;
  cycleId: string;
  status: string;
  nonTerminalOnly?: boolean;
  controlId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
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
        return;
      }
      setSuccess("Pipeline status updated.");
      router.refresh();
    } catch {
      setError("Could not update status. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-1 flex flex-col items-start gap-2" onSubmit={submit}>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`status-${controlId ?? applicationId}`}>
          Pipeline status
        </label>
        <select
          key={status}
          id={`status-${controlId ?? applicationId}`}
          name="status"
          aria-label="Pipeline status"
          defaultValue={status}
          disabled={pending}
          className="operation-control min-h-9 rounded-md bg-mecg-navy/[0.035] px-2 text-[10px] font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none disabled:opacity-60"
        >
          {legalManualApplicationStatuses(status).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="operation-control min-h-9 rounded-md px-2.5 text-[10px] font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Moving…" : "Move"}
        </button>
      </div>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
