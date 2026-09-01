"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

export default function SlotForm({ cycleId, eventId }: { cycleId: string; eventId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_SLOT", cycleId, eventId, startsAt: new Date(String(data.get("startsAt"))).toISOString(), endsAt: new Date(String(data.get("endsAt"))).toISOString(), capacity: Number(data.get("capacity") ?? 8) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not create slot");
        return;
      }
      form.reset();
      setSuccess("RSVP slot saved.");
      router.refresh();
    } catch {
      setError("Could not create slot. Check the times and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]" onSubmit={submit}>
      <p className="text-sm font-medium">Add RSVP slot</p>
      <label className="text-sm">
        Starts at
        <input name="startsAt" type="datetime-local" required disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <label className="text-sm">
        Ends at
        <input name="endsAt" type="datetime-local" required disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <label className="text-sm">
        Capacity
        <input name="capacity" type="number" min={1} defaultValue={8} disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <button disabled={pending} className="button-secondary self-start text-sm">
        {pending ? "Saving…" : "Save slot"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
