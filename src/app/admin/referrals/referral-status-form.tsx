"use client";

import { useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import { REFERRAL_STATUSES, referralStatusLabel } from "@/lib/labels";

export default function ReferralStatusForm({
  referralId,
  referralName,
  current,
}: {
  referralId: string;
  referralName: string;
  current: string;
}) {
  const { pending, error, success, run } = useAction("/api/admin/referrals", "Could not update the referral. Check your connection and try again.");
  const [status, setStatus] = useState(current);

  const nextAction = {
    NEW: "Read the note, then mark it Reviewed.",
    REVIEWED: "Contact them, then record Invited—or close it for this cycle.",
    INVITED: "Follow up outside MECG. This status does not send an invitation.",
    PASSED: "Complete for this cycle. Change only to correct the record.",
  }[status] ?? "Choose the status that matches the Board's latest action.";

  async function change(nextStatus: string) {
    if (nextStatus === status) return;
    const previousStatus = status;
    setStatus(nextStatus);
    const result = await run(
      { referralId, status: nextStatus },
      {
        successMessage: nextStatus === "INVITED"
          ? "Status saved. Send the invitation outside this workspace."
          : "Status saved.",
        fallbackError: "Could not update the referral",
      },
    );
    if (!result.ok) setStatus(previousStatus);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px] font-semibold text-mecg-navy/60" htmlFor={`referral-status-${referralId}`}>
        Current status
        <span className="sr-only"> for {referralName}</span>
      </label>
      <select
        id={`referral-status-${referralId}`}
        value={status}
        disabled={pending}
        onChange={(event) => void change(event.target.value)}
        aria-describedby={`referral-next-${referralId}`}
        className="select-control min-h-11 text-[13px]"
      >
        {REFERRAL_STATUSES.map((value) => (
          <option key={value} value={value}>{referralStatusLabel(value)}</option>
        ))}
      </select>
      <p id={`referral-next-${referralId}`} className="text-[12px] leading-5 text-mecg-navy/60">
        <span className="font-semibold text-mecg-navy/70">Next: </span>{nextAction}
      </p>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
