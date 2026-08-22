"use client";

import { useState } from "react";

export default function InterestForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
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
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? "You're on the list. We'll email cycle updates." : body?.error ?? "Could not save that.");
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Full name" className="min-h-12 rounded-xl bg-white px-4 text-mecg-navy" />
      <input name="email" type="email" required placeholder="Email" className="min-h-12 rounded-xl bg-white px-4 text-mecg-navy" />
      <input name="uniqname" placeholder="Uniqname" className="min-h-12 rounded-xl bg-white px-4 text-mecg-navy" />
      <input name="howHeard" placeholder="How you heard about MECG" className="min-h-12 rounded-xl bg-white px-4 text-mecg-navy sm:col-span-2" />
      <button disabled={pending} className="button-primary sm:col-span-2">{pending ? "Saving…" : "Join the interest list"}</button>
      {message && <p className="sm:col-span-2 text-sm text-white/70">{message}</p>}
    </form>
  );
}
