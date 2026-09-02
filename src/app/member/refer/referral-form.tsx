"use client";

import { useRef, useState } from "react";
import { useAction } from "@/lib/use-action";
import OperationNotice from "@/components/operation-notice";
import FormField from "@/components/form-field";

const REASON_LIMIT = 2000;

export default function ReferralForm({ cycleId }: { cycleId: string }) {
  const { pending, error, run } = useAction("/api/member/referrals", "Could not send the referral. Check your connection and try again.");
  const [reason, setReason] = useState("");
  const [sentName, setSentName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await run(
      {
        cycleId,
        name: data.get("name"),
        email: data.get("email"),
        yearMajor: data.get("yearMajor"),
        reason: data.get("reason"),
      },
      { fallbackError: "Could not send the referral" },
    );
    if (!result.ok) return;
    setSentName(String(data.get("name") ?? "").trim());
    formRef.current?.reset();
    setReason("");
  }

  if (sentName) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl bg-emerald-50 p-5 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)] sm:p-6">
        <p className="text-[15px] font-semibold">Referral received</p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-950/75">
          {sentName} is now waiting for Board review. You do not need to do anything else; their status appears below.
        </p>
        <button type="button" onClick={() => setSentName("")} className="button-secondary mt-4 min-h-11">
          Refer another person
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 rounded-2xl bg-paper p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="referral-name" name="name" label="Name" required maxLength={120} disabled={pending} placeholder="Who should we know about?" />
        <FormField id="referral-email" name="email" type="email" label="Email" required maxLength={255} disabled={pending} placeholder="them@umich.edu" />
      </div>
      <FormField id="referral-year-major" name="yearMajor" label="Year and major" maxLength={120} disabled={pending} placeholder="Sophomore, Economics" hint="Optional. Helpful if you know it." />
      <div className="text-sm font-semibold text-mecg-navy">
        <span className="flex items-baseline justify-between gap-3">
          <label htmlFor="referral-reason">Why they&rsquo;d be a good fit</label>
          <span className="tabular text-[12px] font-medium text-mecg-navy/60">{reason.length}/{REASON_LIMIT}</span>
        </span>
        <textarea
          id="referral-reason"
          name="reason"
          required
          maxLength={REASON_LIMIT}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
          placeholder="What have you seen them do? A specific example beats adjectives."
          className="field-control mt-2 min-h-28 py-3 text-[14px] font-normal leading-6 text-mecg-navy placeholder:text-mecg-navy/35 disabled:opacity-60"
        />
      </div>
      <button type="submit" disabled={pending} className="button-primary self-start">{pending ? "Sending…" : "Send referral"}</button>
      <OperationNotice kind="error">{error}</OperationNotice>
    </form>
  );
}
