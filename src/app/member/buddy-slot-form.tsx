"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";

type BuddySlot = { id: string; startsAt: string; endsAt: string };

function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function subscribeToClock() {
  return () => {};
}

function localTimeSnapshot() {
  const now = new Date();
  return `${toLocalDateTimeValue(now)}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}

export default function BuddySlotForm({ cycleId, slots = [] }: { cycleId: string; slots?: BuddySlot[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const localTime = useSyncExternalStore(subscribeToClock, localTimeSnapshot, () => "");
  const [minimum = "", timeZone = ""] = localTime.split("|");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    const startsAt = new Date(String(data.get("startsAt")));
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setError("Choose a valid start time");
      setPending(false);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + 20 * 60 * 1000);
    try {
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
        event.currentTarget.reset();
        setMessage("Your 20-minute slot is published.");
        router.refresh();
      }
    } catch {
      setError("Could not publish slot. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
      <p className="text-[13px] font-semibold text-mecg-navy/60">Applicant conversations</p>
      <h3 className="mt-2 text-lg font-semibold">Offer a member chat</h3>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">Choose a local start time. The hub publishes a 20-minute slot for applicants to book.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={submit}>
        <label className="text-sm font-medium text-mecg-navy">
          Start time{timeZone ? ` (${timeZone})` : ""}
          <input name="startsAt" type="datetime-local" required min={minimum || undefined} className="field-control mt-2" aria-describedby="buddy-slot-help" />
        </label>
        <button type="submit" disabled={pending} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Publishing…" : "Publish slot"}</button>
      </form>
      <p id="buddy-slot-help" className="mt-2 text-xs leading-5 text-mecg-navy/60">Times are shown in your current time zone and saved with the correct offset.</p>
      <div className="mt-3 space-y-2">
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{message}</OperationNotice>
      </div>
      {slots.length > 0 && (
        <div className="mt-5 border-t border-mecg-navy/10 pt-4">
          <p className="text-[13px] font-semibold text-mecg-navy/60">Published slots</p>
          <ul className="mt-2 space-y-2 text-sm text-mecg-navy/60">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center gap-3 rounded-xl bg-mecg-navy/[0.035] px-3.5 py-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white tabular text-[10px] font-bold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                  {new Date(slot.startsAt).toLocaleDateString([], { day: "2-digit" })}
                </span>
                <span>
                  {new Date(slot.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
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
