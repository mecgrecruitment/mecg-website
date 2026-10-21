"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { postMemberAction } from "@/lib/member-action";

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
  const [unknown, setUnknown] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const localTime = useSyncExternalStore(subscribeToClock, localTimeSnapshot, () => "");
  const [minimum = "", timeZone = ""] = localTime.split("|");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || unknown) return;
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setPending(true);
    const data = new FormData(form);
    const startsAt = new Date(String(data.get("startsAt")));
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setError("Choose a valid start time");
      setPending(false);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + 20 * 60 * 1000);
    inFlight.current = true;
    const result = await postMemberAction({ path: "/api/member/buddy", payload: {
      cycleId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
    } });
    inFlight.current = false;
    setPending(false);
    if (result.kind === "saved") {
      form.reset(); setMessage("Your 20-minute slot is published."); router.refresh();
    } else if (result.kind === "rejected") setError(result.message);
    else { setUnknown(true); setError("Publishing could not be confirmed. The slot may already exist. Reload to check your published slots before trying again."); }
  }

  return (
    <section className="rounded-xl p-5 inset-ring inset-ring-line sm:p-6">
      <p className="text-[13px] font-semibold text-muted">Applicant conversations</p>
      <h3 className="mt-2 text-lg font-semibold">Offer a member chat</h3>
      <p className="mt-1 text-sm leading-6 text-muted">Choose a local start time. The hub publishes a 20-minute slot for applicants to book.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={submit}>
        <label className="text-sm font-medium text-mecg-navy">
          Start time{timeZone ? ` (${timeZone})` : ""}
          <input name="startsAt" type="datetime-local" required disabled={pending || unknown} min={minimum || undefined} className="field-control mt-2" aria-describedby="buddy-slot-help" />
        </label>
        <button type="submit" disabled={pending || unknown} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Publishing…" : "Publish slot"}</button>
      </form>
      <p id="buddy-slot-help" className="mt-2 text-xs leading-5 text-muted">Times are shown in your current time zone and saved with the correct offset.</p>
      <div className="mt-3 space-y-2">
        <OperationNotice kind="error">{error}</OperationNotice>
        <OperationNotice kind="success">{message}</OperationNotice>
      </div>
      {unknown && <button type="button" className="button-secondary mt-3" onClick={() => window.location.reload()}>Reload to check published slots</button>}
      {slots.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13px] font-semibold text-muted">Published slots</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center gap-3 rounded-xl bg-wash px-3.5 py-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white tabular text-xs font-bold text-mecg-navy inset-ring inset-ring-line">
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
