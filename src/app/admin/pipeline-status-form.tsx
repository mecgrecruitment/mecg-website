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
      className="mt-1 flex items-center gap-1.5"
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
      <select
        name="status"
        defaultValue={status}
        className="h-6 rounded-md bg-mecg-navy/[0.035] px-1.5 text-[10px] font-medium text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
      >
        {PIPELINE_STATUSES.filter((item) => !["OFFERED", "WAITLISTED", "REJECTED"].includes(item)).map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <button className="h-6 rounded-md px-2 text-[10px] font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.12]">
        Move
      </button>
    </form>
  );
}
