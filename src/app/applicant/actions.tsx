"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setApplicantActionPending } from "./status-refresh";

function replaceWithActionStatus(router: ReturnType<typeof useRouter>, action: "rsvp" | "buddy") {
  const params = new URLSearchParams(window.location.search);
  params.set("action", action);
  router.replace(`/applicant?${params.toString()}`, { scroll: false });
}

function responseError(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

export function SlotButton({ id }: { id: string }) {
  const router = useRouter();
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Once confirmed, this button is replaced by the message below — move focus onto it so it
    // doesn't silently fall back to <body>, matching application-form.tsx's step-change pattern.
    if (confirmed) confirmationRef.current?.focus();
  }, [confirmed]);

  async function rsvp() {
    if (inFlight.current) return;
    inFlight.current = true;
    setApplicantActionPending(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/applicant/rsvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: id }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(body, "Could not RSVP"));
        return;
      }
      replaceWithActionStatus(router, "rsvp");
      setConfirmed(true);
    } catch {
      setError("Could not RSVP");
    } finally {
      inFlight.current = false;
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (confirmed) {
    return <p ref={confirmationRef} tabIndex={-1} role="status" className="text-sm font-semibold text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-mecg-orange focus-visible:ring-offset-2">RSVP confirmed.</p>;
  }

  return (
    <div className="shrink-0">
      <button type="button" className="button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => void rsvp()}>
        {pending ? "Saving…" : "RSVP"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function BuddyButton({ id }: { id: string }) {
  const router = useRouter();
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (confirmed) confirmationRef.current?.focus();
  }, [confirmed]);

  async function book() {
    if (inFlight.current) return;
    inFlight.current = true;
    setApplicantActionPending(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/applicant/buddy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: id }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(body, "Could not book"));
        return;
      }
      replaceWithActionStatus(router, "buddy");
      setConfirmed(true);
    } catch {
      setError("Could not book");
    } finally {
      inFlight.current = false;
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (confirmed) {
    return <p ref={confirmationRef} tabIndex={-1} role="status" className="text-sm font-semibold text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-mecg-orange focus-visible:ring-offset-2">Member chat booked.</p>;
  }

  return (
    <div className="shrink-0">
      <button type="button" className="button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={() => void book()}>
        {pending ? "Saving…" : "Book 20 min"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function initialOfferResponse(initialResponse: "ACCEPTED" | "DECLINED" | null): "accept" | "decline" | null {
  if (initialResponse === "ACCEPTED") return "accept";
  if (initialResponse === "DECLINED") return "decline";
  return null;
}

export function OfferButtons({ applicationId, initialResponse }: { applicationId: string; initialResponse: "ACCEPTED" | "DECLINED" | null }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const declineRef = useRef<HTMLButtonElement>(null);
  const initiatorRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);
  const [selected, setSelected] = useState<"accept" | "decline" | null>(null);
  const [pending, setPending] = useState(false);
  const [responded, setResponded] = useState<"accept" | "decline" | null>(initialOfferResponse(initialResponse));
  const [error, setError] = useState("");

  useEffect(() => {
    if (selected) headingRef.current?.focus();
  }, [selected]);

  function choose(action: "accept" | "decline") {
    initiatorRef.current = action === "accept" ? acceptRef.current : declineRef.current;
    setSelected(action);
  }

  function cancel() {
    const initiator = initiatorRef.current;
    setSelected(null);
    setError("");
    requestAnimationFrame(() => initiator?.focus());
  }

  async function respond() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setApplicantActionPending(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/applicant/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, accept: selected === "accept" }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(body, "Could not record your response"));
        return;
      }
      setResponded(selected);
      router.refresh();
    } catch {
      setError("Could not record your response");
    } finally {
      inFlight.current = false;
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (responded === "accept") {
    return (
      <div className="mt-4 rounded-xl bg-mecg-orange/10 p-4 shadow-[inset_0_0_0_1px_rgba(254,144,77,0.35)]">
        <p className="text-sm font-semibold text-mecg-navy">You&rsquo;re in.</p>
        <p className="mt-1 text-sm leading-6 text-mecg-navy/75">{"We've recorded your acceptance. Onboarding details will follow from the Board."}</p>
      </div>
    );
  }
  if (responded === "decline") {
    return (
      <div className="mt-4 rounded-xl bg-mecg-navy/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
        <p className="text-sm leading-6 text-mecg-navy/75">{"We've recorded your decision to decline. Thank you for considering MECG."}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {selected ? (
        <div className="rounded-xl bg-mecg-navy/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-mecg-orange focus-visible:ring-offset-2">
            Confirm {selected === "accept" ? "acceptance" : "decline"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-mecg-navy/75">
            You selected <strong>{selected === "accept" ? "Accept offer" : "Decline offer"}</strong>. This response cannot be changed in the portal.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={selected === "accept" ? "button-primary" : "button-secondary"} disabled={pending} onClick={() => void respond()}>
              {pending ? "Saving…" : "Confirm"}
            </button>
            <button type="button" className="button-secondary" disabled={pending} onClick={cancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button ref={acceptRef} type="button" className="button-primary" onClick={() => choose("accept")}>Accept offer</button>
          <button ref={declineRef} type="button" className="button-secondary" onClick={() => choose("decline")}>Decline</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

const SCORE_OPTIONS = [
  { value: 5, label: "5 · Excellent" },
  { value: 4, label: "4 · Good" },
  { value: 3, label: "3 · Fair" },
  { value: 2, label: "2 · Poor" },
  { value: 1, label: "1 · Very poor" },
];

export function SurveyForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setApplicantActionPending(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/applicant/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, score: Number(score), note }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(body, "Could not send feedback"));
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      setError("Could not send feedback");
    } finally {
      inFlight.current = false;
      setPending(false);
      setApplicantActionPending(false);
    }
  }

  if (sent) {
    return <p className="mt-4 text-sm text-mecg-navy/70">{"Thanks for the feedback. It's anonymous and goes straight to the Board."}</p>;
  }

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
      <label className="block text-sm font-medium">
        Anonymous process rating
        <select
          name="score"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          required
          className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        >
          <option value="" disabled>Select a rating</option>
          {SCORE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        What should MECG change?
        <textarea
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional"
          maxLength={2000}
          aria-describedby="survey-note-counter"
          className="mt-2 min-h-24 w-full rounded-xl bg-mecg-navy/[0.035] p-4 text-sm font-normal shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
        <span id="survey-note-counter" className="mt-1 block text-xs font-normal text-mecg-navy/60" aria-live="polite">{note.length}/2000 characters</span>
      </label>
      <button className="button-secondary w-fit disabled:cursor-not-allowed disabled:opacity-50" disabled={pending}>
        {pending ? "Sending…" : "Send feedback"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
