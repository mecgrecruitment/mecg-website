"use client";

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

  async function change(status: string) {
    if (status === current) return;
    await run({ referralId, status }, { successMessage: "Saved.", fallbackError: "Could not update the referral" });
  }

  return (
    <div className="flex min-w-44 flex-col gap-2">
      <label className="sr-only" htmlFor={`referral-status-${referralId}`}>Status for {referralName}</label>
      <select
        id={`referral-status-${referralId}`}
        value={current}
        disabled={pending}
        onChange={(event) => void change(event.target.value)}
        className="select-control text-[13px]"
      >
        {REFERRAL_STATUSES.map((value) => (
          <option key={value} value={value}>{referralStatusLabel(value)}</option>
        ))}
      </select>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </div>
  );
}
