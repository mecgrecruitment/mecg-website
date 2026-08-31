"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BuddySlot = { id: string; startsAt: string; endsAt: string };

export default function BuddySlotForm({ cycleId, slots = [] }: { cycleId: string; slots?: BuddySlot[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const now = new Date().toISOString().slice(0, 16);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/member/buddy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleId,
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not publish slot");
    } else {
      router.refresh();
    }
    setPending(false);
  }

  return (
    <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
      <h2 className="font-semibold">Offer a 20-minute member chat</h2>
      <p className="mt-1 text-sm text-mecg-navy/55">Unscored. Applicants book one slot from their portal.</p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <input name="startsAt" type="datetime-local" required min={now} className="min-h-11 rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <input name="endsAt" type="datetime-local" required min={now} className="min-h-11 rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]" />
        <button disabled={pending} className="button-secondary disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Publishing…" : "Publish slot"}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {slots.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-mecg-navy/60">
          {slots.map((slot) => (
            <li key={slot.id}>
              {new Date(slot.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {" – "}
              {new Date(slot.endsAt).toLocaleString([], { hour: "numeric", minute: "2-digit" })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
