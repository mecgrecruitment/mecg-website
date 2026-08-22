"use client";

import { useRouter } from "next/navigation";

export default function SlotForm({ cycleId, eventId }: { cycleId: string; eventId: string }) {
  const router = useRouter();
  return (
    <form
      className="mt-4 flex flex-col gap-2 rounded border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void fetch("/api/admin/rush", {
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
        }).then(() => router.refresh());
      }}
    >
      <p className="text-sm font-medium">Add RSVP slot</p>
      <input name="startsAt" type="datetime-local" required className="rounded border px-2 py-1 text-sm" />
      <input name="endsAt" type="datetime-local" required className="rounded border px-2 py-1 text-sm" />
      <input name="capacity" type="number" min={1} defaultValue={8} className="rounded border px-2 py-1 text-sm" />
      <button className="rounded border px-2 py-1 text-sm">Save slot</button>
    </form>
  );
}
