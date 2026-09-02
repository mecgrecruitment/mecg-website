"use client";

import { useState, type ReactNode } from "react";
import { EVENT_KINDS } from "@/lib/workflow";
import { useAction } from "@/lib/use-action";
import { detroitDateTimeToIso } from "@/lib/detroit-date-time";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";

function Select({ label, name, value, onChange, children }: { label: string; name: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} className="select-control mt-2 text-sm">
        {children}
      </select>
    </label>
  );
}

export default function EventForm() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("MIXER");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const { pending: submitting, error, run, router, setError } = useAction("/api/admin/events", "Could not create event. Check your connection and try again.");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    let result;
    try {
      result = await run(
        {
          name,
          date: detroitDateTimeToIso(date),
          endsAt: detroitDateTimeToIso(endsAt),
          checkinOpensAt: detroitDateTimeToIso(opensAt),
          checkinClosesAt: detroitDateTimeToIso(closesAt),
          kind,
          location,
          visibility,
        },
        { skipRefresh: true, fallbackError: "Could not create event." },
      );
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "Could not create event.");
      return;
    }
    if (!result.ok) return;
    const data = result.body as { id?: string; checkinToken?: string } | null;
    if (!data?.id || !data?.checkinToken) {
      setError("Could not create event.");
      return;
    }
    router.push(`/admin/events/${data.id}?token=${encodeURIComponent(data.checkinToken)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <div className="flex flex-col gap-2.5">
        <FormField label="Name" name="name" type="text" required value={name} onChange={(event) => setName(event.target.value)} />
        <Select label="Kind" name="kind" value={kind} onChange={setKind}>{EVENT_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label="Visibility" name="visibility" value={visibility} onChange={setVisibility}><option value="PUBLIC">Public (shows on /join)</option><option value="INVITE">Invite only</option><option value="INTERNAL">Internal / check-in only</option></Select>
        <FormField label="Location" name="location" type="text" value={location} onChange={(event) => setLocation(event.target.value)} />
        <p className="text-sm text-mecg-navy/60">Times are entered in Detroit time.</p>
        <FormField label="Date" name="date" type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} />
        <FormField label="Event ends at" name="endsAt" type="datetime-local" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        <p className="rounded-xl bg-mecg-navy/[0.035] p-3 text-sm text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">Attendance is tracked for operations and does not affect applicant rankings.</p>
        <FormField label="Check-in opens at" name="opensAt" type="datetime-local" required value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
        <FormField label="Check-in closes at" name="closesAt" type="datetime-local" required value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
        <OperationNotice kind="error">{error}</OperationNotice>
        <button type="submit" disabled={submitting} className="button-primary mt-1 w-full">{submitting ? "Creating…" : "Create event"}</button>
      </div>
    </form>
  );
}
