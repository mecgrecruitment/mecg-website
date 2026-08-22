"use client";

import { useRouter } from "next/navigation";
import { PIPELINE_STATUSES } from "@/lib/workflow";

export default function PipelineStatusForm({
  applicationId,
  cycleId,
  status,
}: {
  applicationId: string;
  cycleId: string;
  status: string;
}) {
  const router = useRouter();
  return (
    <form
      className="mt-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void fetch("/api/admin/rush", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SET_APPLICATION_STATUS",
            cycleId,
            applicationId,
            status: data.get("status"),
          }),
        }).then(() => router.refresh());
      }}
    >
      <select name="status" defaultValue={status} className="rounded border px-2 py-1 text-xs">
        {PIPELINE_STATUSES.filter((item) => !["OFFERED", "WAITLISTED", "REJECTED"].includes(item)).map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <button className="ml-2 rounded border px-2 py-1 text-xs">Move</button>
    </form>
  );
}
