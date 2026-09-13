"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";
import { authorizedFetch } from "@/lib/client-fetch";

const REASONS = [
  ["NO_CAMERA", "No camera available"],
  ["CONNECTIVITY_FAILURE", "Applicant connectivity failure"],
  ["QR_FAILURE", "QR code or link failed"],
  ["SIGN_IN_UNAVAILABLE", "Applicant cannot sign in"],
  ["ACCESSIBILITY_SUPPORT", "Accessibility support"],
] as const;

export default function AssistedCheckinForm({ eventId, locked }: { eventId: string; locked: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function checkIn(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch(`/api/admin/events/${eventId}/assisted-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: data.get("identifier"), reasonCode: data.get("reasonCode") }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not check in the applicant");
        return;
      }
      setNotice(body?.duplicate ? "Applicant was already checked in." : "Applicant checked in with staff assistance.");
      if (!body?.duplicate) form.reset();
      router.refresh();
    } catch {
      setError("Could not check in the applicant");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <p className="text-[13px] font-semibold text-mecg-navy/60">Staff-assisted applicant check-in</p>
      <p className="mt-2 text-sm text-mecg-navy/60">
        Verify the applicant in person, then enter their exact applicant code, uniqname, or email. This records attendance only and never changes a score.
      </p>
      {locked ? (
        <p className="mt-3 text-sm text-mecg-navy/60">Assisted check-in is unavailable for a closed or cancelled event.</p>
      ) : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(submission) => { submission.preventDefault(); void checkIn(submission.currentTarget); }}>
          <FormField label="Exact applicant identifier" name="identifier" required maxLength={254} />
          <label className="block text-sm font-medium">
            Reason
            <select name="reasonCode" required defaultValue="" className="select-control mt-2">
              <option value="" disabled>Select a reason</option>
              {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={pending} className="button-primary sm:col-span-2">{pending ? "Checking in…" : "Record assisted check-in"}</button>
        </form>
      )}
      <OperationNotice kind="success">{notice}</OperationNotice>
      <OperationNotice kind="error">{error}</OperationNotice>
    </section>
  );
}
