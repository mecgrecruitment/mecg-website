"use client";

import { useId, useState, type FormEvent } from "react";
import FormField from "@/components/form-field";

const textareaClass = "mt-2 min-h-12 w-full rounded-xl bg-white px-4 py-3 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-blue)]";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const messageId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus("error");
        setMessage(result?.error ?? "Your message could not be sent.");
        return;
      }
      form.reset();
      setStatus("sent");
      setMessage("Your message was sent. The MECG board will reply by email.");
    } catch {
      setStatus("error");
      setMessage("Your message could not be sent. Email mecg-board@umich.edu instead.");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-paper p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Name" name="name" autoComplete="name" required maxLength={100} />
        <FormField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="mt-5">
        <FormField label="Subject" name="subject" required maxLength={150} />
      </div>
      <label htmlFor={messageId} className="mt-5 block text-sm font-medium">Message<textarea id={messageId} name="message" required minLength={10} maxLength={5000} rows={6} className={textareaClass} /></label>
      <label className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={status === "sending"} className="button-primary">{status === "sending" ? "Sending..." : "Send message"}</button>
        <p role={status === "error" ? "alert" : "status"} className={`text-sm ${status === "error" ? "text-red-700" : "text-mecg-navy/65"}`}>{message}</p>
      </div>
    </form>
  );
}
