"use client";

import { useRouter } from "next/navigation";

export function SlotButton({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-sm underline" onClick={() => void fetch("/api/applicant/rsvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: id }) }).then(() => router.refresh())}>RSVP</button>;
}

export function BuddyButton({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-sm underline" onClick={() => void fetch("/api/applicant/buddy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: id }) }).then(() => router.refresh())}>Book 20 min</button>;
}

export function OfferButtons() {
  const router = useRouter();
  return (
    <div className="mt-3 flex gap-3">
      <button className="button-primary" onClick={() => void fetch("/api/applicant/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept: true }) }).then(() => router.refresh())}>Accept offer</button>
      <button className="button-secondary" onClick={() => void fetch("/api/applicant/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept: false }) }).then(() => router.refresh())}>Decline</button>
    </div>
  );
}

export function SurveyForm() {
  const router = useRouter();
  return (
    <form className="mt-4 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void fetch("/api/applicant/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: Number(data.get("score")), note: data.get("note") }) }).then(() => router.refresh()); }}>
      <label className="text-sm">Anonymous process rating
        <select name="score" className="ml-2 rounded border px-2 py-1"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
      </label>
      <textarea name="note" placeholder="What should MECG change?" className="rounded border p-2 text-sm" />
      <button className="button-secondary w-fit">Send feedback</button>
    </form>
  );
}
