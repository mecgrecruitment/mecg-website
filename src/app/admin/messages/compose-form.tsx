"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STATUSES } from "@/lib/workflow";
import { applicationStatusLabel } from "@/lib/labels";
import { authorizedFetch } from "@/lib/client-fetch";

// Bulk send to a pipeline segment. Deliberately plain text rather than a rich
// editor: the wrapper supplies the layout, and an editor here would be a second
// place for HTML to go wrong in an email client.
export default function ComposeForm({ cycleId, counts }: { cycleId: string; counts: Record<string, number> }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"subject" | "body" | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const subjectInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const focusSubjectOnEdit = useRef(false);

  const recipients = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  useEffect(() => {
    if (reviewing) {
      reviewHeading.current?.focus();
    } else if (focusSubjectOnEdit.current) {
      focusSubjectOnEdit.current = false;
      subjectInput.current?.focus();
    }
  }, [reviewing]);

  function returnToEdit() {
    focusSubjectOnEdit.current = true;
    setReviewing(false);
  }

  function beginReview() {
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();
    if (!normalizedSubject) {
      setError("Enter a subject before reviewing this message.");
      setErrorField("subject");
      subjectInput.current?.focus();
      return;
    }
    if (!normalizedMessage) {
      setError("Enter a message before reviewing it.");
      setErrorField("body");
      messageInput.current?.focus();
      return;
    }
    setSubject(normalizedSubject);
    setMessage(normalizedMessage);
    setReviewing(true);
  }

  async function send() {
    setPending(true);
    setError("");
    setErrorField(null);
    setNotice("");
    try {
      const response = await authorizedFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, statuses, subject, body: message }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Could not send the message");
        return;
      }
      setNotice(result?.failed
        ? `Sent ${result.sent} to the provider. ${result.failed} sends failed; check History for details.`
        : `Sent ${result?.sent ?? 0} message${result?.sent === 1 ? "" : "s"} to the provider. Inbox delivery is not confirmed.`);
      setStatuses([]);
      setSubject("");
      setMessage("");
      setReviewing(false);
      router.refresh();
    } catch {
      setError("Could not confirm the send. Check History before sending again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="rounded-xl bg-paper p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setErrorField(null);
        setNotice("");
        if (reviewing) void send();
        else beginReview();
      }}
    >
      {reviewing ? (
        <section aria-labelledby="message-review-title">
          <p className="text-[13px] font-semibold text-mecg-orange-ink">Final review</p>
          <h2
            id="message-review-title"
            ref={reviewHeading}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-mecg-navy focus:outline-2 focus:outline-offset-3 focus:outline-mecg-navy"
          >
            Review before sending
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This sends immediately and cannot be undone. Each applicant is greeted by name automatically.
          </p>

          <dl className="mt-5 grid gap-px overflow-hidden rounded-xl bg-mecg-navy/10 sm:grid-cols-2">
            <div className="bg-white p-4">
              <dt className="text-xs font-semibold text-muted">Recipients</dt>
              <dd className="mt-1 text-xl font-semibold text-mecg-navy">{recipients} applicant{recipients === 1 ? "" : "s"}</dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-xs font-semibold text-muted">Selected segments</dt>
              <dd className="mt-1 text-sm font-semibold leading-6 text-mecg-navy">
                {statuses.map((status) => `${applicationStatusLabel(status)} (${counts[status] ?? 0})`).join(", ")}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl bg-white p-4 inset-ring inset-ring-line">
            <p className="text-xs font-semibold text-muted">Subject</p>
            <p className="mt-1 font-semibold text-mecg-navy">{subject}</p>
            <div className="my-4 border-t border-line" />
            <p className="text-xs font-semibold text-muted">Message</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-mecg-navy">{message}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={returnToEdit} disabled={pending} className="button-secondary">Back to edit</button>
            <button type="submit" disabled={pending} aria-busy={pending} className="button-primary">
              {pending ? "Sending…" : `Send ${recipients} message${recipients === 1 ? "" : "s"}`}
            </button>
          </div>
        </section>
      ) : (
        <>
          <p className="text-[13px] font-semibold text-muted">Send to a segment</p>
          <p className="mt-1 text-sm text-muted">Send attempts are recorded on the applicant&rsquo;s dossier. Provider acceptance does not confirm inbox delivery.</p>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Application status</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PIPELINE_STATUSES.map((status) => {
                const checked = statuses.includes(status);
                const count = counts[status] ?? 0;
                return (
                  <label
                    key={status}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold ${checked ? "bg-mecg-navy text-white" : "text-muted inset-ring inset-ring-line-strong"} ${count ? "" : "opacity-45"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={!count}
                      onChange={(event) => setStatuses((current) => event.target.checked ? [...current, status] : current.filter((item) => item !== status))}
                    />
                    {applicationStatusLabel(status)} · {count}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-4 block text-sm font-medium">
            Subject
            <input
              ref={subjectInput}
              name="subject"
              required
              maxLength={200}
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                if (errorField === "subject") {
                  setError("");
                  setErrorField(null);
                }
              }}
              aria-invalid={errorField === "subject"}
              aria-describedby={errorField === "subject" ? "message-compose-error" : undefined}
              placeholder="Your group interview time is confirmed"
              className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Message
            <textarea
              ref={messageInput}
              name="body"
              required
              rows={7}
              maxLength={5000}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                if (errorField === "body") {
                  setError("");
                  setErrorField(null);
                }
              }}
              aria-invalid={errorField === "body"}
              aria-describedby={errorField === "body" ? "message-compose-error" : undefined}
              placeholder={"Each applicant is greeted by name automatically.\n\nBlank lines start a new paragraph."}
              className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm inset-ring inset-ring-line-strong outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy)]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!recipients} className="button-primary">Review message</button>
            {!recipients && <p className="text-sm text-muted">Pick at least one status with applicants in it.</p>}
          </div>
        </>
      )}
      {error && <p id="message-compose-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
    </form>
  );
}
