"use client";

import { useRouter } from "next/navigation";

export default function BuddySlotForm({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  return (
    <form
      className="rounded-xl border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void fetch("/api/member/buddy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleId,
            startsAt: new Date(String(data.get("startsAt"))).toISOString(),
            endsAt: new Date(String(data.get("endsAt"))).toISOString(),
          }),
        }).then(() => router.refresh());
      }}
    >
      <h2 className="font-semibold">Offer a 20-minute member chat</h2>
      <p className="mt-1 text-sm text-gray-600">Unscored. Applicants book one slot from their portal.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input name="startsAt" type="datetime-local" required className="rounded border px-2 py-1" />
        <input name="endsAt" type="datetime-local" required className="rounded border px-2 py-1" />
        <button className="rounded border px-3 py-1">Publish slot</button>
      </div>
    </form>
  );
}
