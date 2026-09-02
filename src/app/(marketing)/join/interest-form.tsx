"use client";

import { useState } from "react";
import { CLASS_YEAR_LABELS, CLASS_YEARS } from "@/lib/workflow";

const FIELD_CLASS =
  "mt-2 min-h-12 w-full rounded-sm border border-white/15 bg-white px-4 text-mecg-navy placeholder:text-mecg-navy/45 disabled:cursor-not-allowed disabled:opacity-60";
// The form sits on the navy section, so the select takes a solid white fill and
// the same square corners and hairline as its sibling inputs above.
const SELECT_CLASS = "select-control mt-2 rounded-sm border border-white/15 bg-white";

export default function InterestForm() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setPending(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          uniqname: data.get("uniqname"),
          classYear: data.get("classYear"),
          howHeard: data.get("howHeard"),
        }),
      });

      if (response.ok) {
        form.reset();
        setMessage("You're on the list. We'll email you when cycle details change.");
      } else {
        const body = await response.json().catch(() => null);
        setIsError(true);
        setMessage(body?.error ?? "We couldn't save your information. Please try again.");
      }
    } catch {
      setIsError(true);
      setMessage("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-white/80">
        Full name
        <input
          name="name"
          autoComplete="name"
          required
          placeholder="Your name"
          disabled={pending}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block text-sm font-medium text-white/80">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@umich.edu"
          disabled={pending}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block text-sm font-medium text-white/80">
        Uniqname <span className="font-normal text-white/45">optional</span>
        <input
          name="uniqname"
          autoComplete="username"
          placeholder="uniqname"
          disabled={pending}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block text-sm font-medium text-white/80">
        Class year <span className="font-normal text-white/45">optional</span>
        <select name="classYear" defaultValue="" disabled={pending} className={SELECT_CLASS}>
          <option value="">Prefer not to say</option>
          {CLASS_YEARS.map((year) => (
            <option key={year} value={year}>{CLASS_YEAR_LABELS[year]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-white/80 sm:col-span-2">
        How did you hear about MECG? <span className="font-normal text-white/45">optional</span>
        <input
          name="howHeard"
          placeholder="A friend, an event, Instagram…"
          disabled={pending}
          className={FIELD_CLASS}
        />
      </label>
      <div className="mt-1 flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending} className="button-primary disabled:cursor-wait disabled:opacity-60">
          {pending ? "Saving…" : "Join the interest list"}
        </button>
        <p className="text-xs leading-5 text-white/45">Updates only. Joining this list is not an application.</p>
      </div>
      <p role={isError ? "alert" : "status"} className={`min-h-5 text-sm sm:col-span-2 ${isError ? "text-mecg-orange" : "text-white/70"}`}>{message}</p>
    </form>
  );
}
