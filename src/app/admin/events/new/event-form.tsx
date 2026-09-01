"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { EVENT_KINDS } from "@/lib/workflow";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";

function Select({ label, name, value, onChange, children }: { label: string; name: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="relative mt-2">
        <select name={name} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full appearance-none rounded-xl bg-mecg-navy/[0.035] px-4 pr-10 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]">
          {children}
        </select>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mecg-navy/40" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
      </div>
    </label>
  );
}

export default function EventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("MIXER");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const utc = (value: string) => new Date(value).toISOString();
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date: utc(date), endsAt: utc(endsAt), checkinOpensAt: utc(opensAt), checkinClosesAt: utc(closesAt), kind, location, visibility }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id || !data?.checkinToken) {
        setError(data?.error ?? "Could not create event.");
        return;
      }
      router.push(`/admin/events/${data.id}?token=${encodeURIComponent(data.checkinToken)}`);
    } catch {
      setError("Could not create event. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <div className="flex flex-col gap-2.5">
        <FormField label="Name" name="name" type="text" required value={name} onChange={(event) => setName(event.target.value)} />
        <Select label="Kind" name="kind" value={kind} onChange={setKind}>{EVENT_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label="Visibility" name="visibility" value={visibility} onChange={setVisibility}><option value="PUBLIC">Public (shows on /join)</option><option value="INVITE">Invite only</option><option value="INTERNAL">Internal / check-in only</option></Select>
        <FormField label="Location" name="location" type="text" value={location} onChange={(event) => setLocation(event.target.value)} />
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
