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
    const startsAt = new Date(String(data.get("startsAt")));
    if (Number.isNaN(startsAt.getTime())) {
      setError("Choose a valid start time");
      setPending(false);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + 20 * 60 * 1000);
    const response = await fetch("/api/member/buddy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
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
    <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mecg-navy/45">Applicant conversations</p>
      <h3 className="mt-2 text-lg font-semibold">Offer a member chat</h3>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">Choose a start time. The hub publishes a 20-minute slot for applicants to book.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={submit}>
        <label className="text-sm font-medium text-mecg-navy">
          Start time
          <input name="startsAt" type="datetime-local" required min={now} className="field-control mt-2" />
        </label>
        <button disabled={pending} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Publishing..." : "Publish slot"}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {slots.length > 0 && (
        <div className="mt-5 border-t border-mecg-navy/10 pt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mecg-navy/45">Published slots</p>
          <ul className="mt-2 space-y-2 text-sm text-mecg-navy/60">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center gap-3 rounded-xl bg-mecg-navy/[0.035] px-3.5 py-2.5">
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white font-mono text-[10px] font-bold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                  {new Date(slot.startsAt).toLocaleDateString([], { day: "2-digit" })}
                </span>
                <span>
                  {new Date(slot.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {" to "}
                  {new Date(slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
