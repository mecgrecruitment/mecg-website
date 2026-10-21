"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";
import { detroitDateTimeToIso, formatDetroitDateTime } from "@/lib/detroit-date-time";
import { EVENT_KINDS } from "@/lib/workflow";
import { eventStatusLabel } from "@/lib/labels";
import { authorizedFetch } from "@/lib/client-fetch";

type EventData = {
  id: string; name: string; kind: string; location: string | null; visibility: string;
  startsAt: string; endsAt: string; checkinOpensAt: string; checkinClosesAt: string; status: string;
};

export default function EventControls({ event }: { event: EventData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const locked = event.status === "CLOSED" || event.status === "CANCELLED";

  async function update(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true); setError("");
    try {
      const response = await authorizedFetch(`/api/admin/events/${event.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), kind: data.get("kind"), location: data.get("location"), visibility: data.get("visibility"),
          startsAt: detroitDateTimeToIso(String(data.get("startsAt")), event.startsAt),
          endsAt: detroitDateTimeToIso(String(data.get("endsAt")), event.endsAt),
          checkinOpensAt: detroitDateTimeToIso(String(data.get("checkinOpensAt")), event.checkinOpensAt),
          checkinClosesAt: detroitDateTimeToIso(String(data.get("checkinClosesAt")), event.checkinClosesAt),
        }),
      });
      if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? "Could not update event"); return; }
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update event");
    } finally { setPending(false); }
  }

  async function cancel() {
    if (!reason.trim() || !window.confirm("Cancel this event? Existing RSVPs will remain in the audit history.")) return;
    setPending(true); setError("");
    try {
      const response = await authorizedFetch(`/api/admin/events/${event.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? "Could not cancel event"); return; }
      router.refresh();
    } catch { setError("Could not cancel event"); } finally { setPending(false); }
  }

  return (
    <section className="rounded-xl p-5 inset-ring inset-ring-line">
      <p className="text-[13px] font-semibold text-muted">Event settings</p>
      <p className="mt-2 text-sm text-muted">Status: {eventStatusLabel(event.status)}</p>
      {!locked && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(submission) => { submission.preventDefault(); void update(submission.currentTarget); }}>
        <FormField label="Name" name="name" required defaultValue={event.name} />
        <label className="block text-sm font-medium">Kind<select name="kind" defaultValue={event.kind} className="select-control mt-2">{EVENT_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <FormField label="Location" name="location" defaultValue={event.location ?? ""} />
        <label className="block text-sm font-medium">Visibility<select name="visibility" defaultValue={event.visibility} className="select-control mt-2"><option value="PUBLIC">Public</option><option value="INVITE">Invite only</option><option value="INTERNAL">Internal</option></select></label>
        <FormField label="Starts (Detroit time)" name="startsAt" type="datetime-local" required defaultValue={formatDetroitDateTime(event.startsAt)} />
        <FormField label="Ends (Detroit time)" name="endsAt" type="datetime-local" required defaultValue={formatDetroitDateTime(event.endsAt)} />
        <FormField label="Check-in opens (Detroit time)" name="checkinOpensAt" type="datetime-local" required defaultValue={formatDetroitDateTime(event.checkinOpensAt)} />
        <FormField label="Check-in closes (Detroit time)" name="checkinClosesAt" type="datetime-local" required defaultValue={formatDetroitDateTime(event.checkinClosesAt)} />
        <button type="submit" disabled={pending} className="button-primary sm:col-span-2">{pending ? "Saving…" : "Save event"}</button>
      </form>}
      {!locked && <div className="mt-6 border-t border-line pt-4">
        <FormField label="Cancellation reason" name="cancellationReason" value={reason} onChange={(change) => setReason(change.target.value)} />
        <button type="button" disabled={pending || !reason.trim()} onClick={() => void cancel()} className="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-danger inset-ring inset-ring-danger/30 disabled:opacity-45">Cancel event</button>
      </div>}
      <OperationNotice kind="error">{error}</OperationNotice>
    </section>
  );
}
