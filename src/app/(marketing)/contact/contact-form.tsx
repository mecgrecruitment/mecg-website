"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import FormField from "@/components/form-field";
import { CONTACT_FIELDS, contactErrors, parseContactErrors, type ContactErrors } from "@/lib/contact-validation";

const textareaClass = "mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-blue)]";

export default function ContactForm({ initialSubject = "", initialMessage = "" }: { initialSubject?: string; initialMessage?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const messageId = useId();

  function showErrors(fields: ContactErrors) {
    setErrors(fields);
    setStatus("error");
    setMessage("Check the highlighted fields and try again.");
  }
  useEffect(() => {
    if (status !== "error") return;
    const field = CONTACT_FIELDS.find((name) => errors[name]);
    const control = field ? formRef.current?.elements.namedItem(field) : null;
    // Effects run after the disabled fieldset has been unlocked by the commit.
    if (control instanceof HTMLElement) control.focus();
  }, [errors, status]);
  const submitting = useRef(false);
  const deliveryIntent = useRef<{ fingerprint: string; requestId: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const submitted = Object.fromEntries(new FormData(form));
    const fields = contactErrors({
      name: String(submitted.name ?? ""), email: String(submitted.email ?? ""),
      subject: String(submitted.subject ?? ""), message: String(submitted.message ?? ""),
    });
    if (Object.keys(fields).length) { showErrors(fields); return; }
    const fingerprint = JSON.stringify([...CONTACT_FIELDS, "website"].map((name) => String(submitted[name] ?? "").trim()));
    if (deliveryIntent.current?.fingerprint !== fingerprint) {
      deliveryIntent.current = { fingerprint, requestId: crypto.randomUUID() };
    }
    const requestId = deliveryIntent.current.requestId;
    setErrors({});
    submitting.current = true;
    setStatus("sending");
    setMessage("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submitted, requestId }),
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const fields = parseContactErrors(result && typeof result === "object" && "fields" in result ? result.fields : null);
        if (Object.keys(fields).length) { showErrors(fields); return; }
        setStatus("error");
        setMessage(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Delivery could not be confirmed. Your answers are still here.");
        return;
      }
      if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        setStatus("error");
        setMessage("Delivery could not be confirmed. Your message is still here. Retry without editing to reuse this request, or email mecg-board@umich.edu for help.");
        return;
      }
      deliveryIntent.current = null;
      form.reset();
      setStatus("sent");
      setMessage("Your message was sent. The MECG board will reply by email.");
    } catch {
      setStatus("error");
      setMessage("Delivery could not be confirmed. Your message is still here. Retry without editing to reuse this request, or email mecg-board@umich.edu for help.");
    } finally { window.clearTimeout(timer); submitting.current = false; }
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={status === "sending"}>
      <fieldset disabled={status === "sending"} className="m-0 min-w-0 border-0 p-0">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Name" name="name" error={errors.name} autoComplete="name" required maxLength={100} />
        <FormField label="Email" name="email" error={errors.email} type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="mt-5">
        <FormField label="Subject" name="subject" defaultValue={initialSubject} error={errors.subject} required maxLength={150} />
      </div>
      <label htmlFor={messageId} className="mt-5 block text-sm font-medium">Message</label><textarea id={messageId} name="message" aria-invalid={!!errors.message} aria-describedby={`${messageId}-help${errors.message ? ` ${messageId}-error` : ""}`} required minLength={10} maxLength={5000} rows={5} defaultValue={initialMessage} className={textareaClass} />
      <p id={`${messageId}-help`} className="mt-2 text-sm leading-6 text-mecg-navy/70">For a project, describe the decision, your timing, and who will use the work. Mention any confidentiality needs. For recruitment, tell us what you need help with.</p>
      {errors.message && <p id={`${messageId}-error`} className="mt-2 text-sm text-red-700">{errors.message}</p>}
      <label className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={status === "sending"} className="button-primary">{status === "sending" ? "Sending…" : "Send message"}</button>
        <p role={status === "error" ? "alert" : "status"} className={`text-sm ${status === "error" ? "text-red-700" : "text-mecg-navy/65"}`}>{message}</p>
      </div>
    </form>
  );
}
