"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isPipelineStatus, legalManualApplicationStatuses } from "@/lib/workflow";
import { moveApplicationRequest } from "./pipeline-kanban";
import OperationNotice from "@/components/operation-notice";
import { applicationStatusLabel } from "@/lib/labels";
import { authorizedFetch } from "@/lib/client-fetch";

export default function PipelineStatusForm({
  applicationId,
  cycleId,
  status,
  controlId,
  compact = false,
  disabled = false,
  canAdvance = true,
}: {
  applicationId: string;
  cycleId: string;
  status: string;
  controlId?: string;
  compact?: boolean;
  disabled?: boolean;
  canAdvance?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // INVITED goes through ADVANCE_SPEED_DATING, which needs MANAGE_CYCLE.
  const destinations = legalManualApplicationStatuses(status).filter(
    (item) => item !== status && (canAdvance || item !== "INVITED"),
  );
  const busy = pending || disabled;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const data = new FormData(event.currentTarget);
      const next = data.get("status");
      if (typeof next !== "string" || !isPipelineStatus(next)) {
        setError("Pick a stage first.");
        return;
      }
      // A move into Speed Dating enrolls and staffs the applicant; a plain
      // status flip would leave them invisible to evaluators.
      const response = await authorizedFetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveApplicationRequest(cycleId, applicationId, next)),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not update status");
        return;
      }
      setSuccess("Application status updated.");
      router.refresh();
    } catch {
      setError("Could not update status. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (destinations.length === 0) return null;

  return (
    <form className="mt-1 flex w-full flex-col items-start gap-2" onSubmit={submit}>
      <div className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 ${compact ? "" : "sm:w-auto sm:grid-cols-[10rem_auto]"}`}>
        <label className="sr-only" htmlFor={`status-${controlId ?? applicationId}`}>
          Application status
        </label>
        <select
          key={status}
          id={`status-${controlId ?? applicationId}`}
          name="status"
          aria-label="Application status"
          defaultValue={destinations.length === 1 ? destinations[0] : ""}
          required
          disabled={busy}
          className="select-control min-w-0 w-full text-[10px]"
        >
          {destinations.length > 1 && <option value="" disabled>Move to…</option>}
          {destinations.map((item) => (
            <option key={item} value={item}>{applicationStatusLabel(item)}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="operation-control rounded-md px-2.5 text-[10px] font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Moving…" : "Move"}
        </button>
      </div>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
