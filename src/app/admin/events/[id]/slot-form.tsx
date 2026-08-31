"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SlotForm({ cycleId, eventId }: { cycleId: string; eventId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/rush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_SLOT",
        cycleId,
        eventId,
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        capacity: Number(data.get("capacity") ?? 8),
      }),
    });
    const body = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "Could not create slot");
    } else {
      form.reset();
      router.refresh();
    }
  }

  return (
    <form className="mt-4 flex flex-col gap-2 rounded border p-3" onSubmit={submit}>
      <p className="text-sm font-medium">Add RSVP slot</p>
      <label className="text-sm">
        Starts at
        <input name="startsAt" type="datetime-local" required className="mt-1 block rounded border px-2 py-1 text-sm" />
      </label>
      <label className="text-sm">
        Ends at
        <input name="endsAt" type="datetime-local" required className="mt-1 block rounded border px-2 py-1 text-sm" />
      </label>
      <label className="text-sm">
        Capacity
        <input name="capacity" type="number" min={1} defaultValue={8} className="mt-1 block rounded border px-2 py-1 text-sm" />
      </label>
      <button disabled={pending} className="rounded border px-2 py-1 text-sm disabled:opacity-50">
        {pending ? "Saving…" : "Save slot"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
