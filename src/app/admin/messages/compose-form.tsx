"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STATUSES } from "@/lib/workflow";

// Bulk send to a pipeline segment. Deliberately plain text rather than a rich
// editor: the wrapper supplies the layout, and an editor here would be a second
// place for HTML to go wrong in an email client.
export default function ComposeForm({ cycleId, counts }: { cycleId: string; counts: Record<string, number> }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const recipients = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  async function send(form: HTMLFormElement) {
    const data = new FormData(form);
    if (!window.confirm(`Send this to ${recipients} applicant${recipients === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, statuses, subject: data.get("subject"), body: data.get("body") }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Could not send the message");
        return;
      }
      setNotice(result?.failed
        ? `Sent ${result.sent}. ${result.failed} could not be delivered; the log shows which.`
        : `Sent ${result?.sent ?? 0} message${result?.sent === 1 ? "" : "s"}.`);
      form.reset();
      setStatuses([]);
      router.refresh();
    } catch {
      setError("Could not send the message");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="rounded-2xl bg-paper p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void send(event.currentTarget);
      }}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Send to a segment</p>
      <p className="mt-1 text-sm text-mecg-navy/55">Every send is recorded on the applicant&rsquo;s dossier, delivered or not.</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Pipeline status</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PIPELINE_STATUSES.map((status) => {
            const checked = statuses.includes(status);
            const count = counts[status] ?? 0;
            return (
              <label
                key={status}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${checked ? "bg-mecg-navy text-white" : "text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"} ${count ? "" : "opacity-45"}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={!count}
                  onChange={(event) => setStatuses((current) => event.target.checked ? [...current, status] : current.filter((item) => item !== status))}
                />
                {status.replaceAll("_", " ")} · {count}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-medium">
        Subject
        <input
          name="subject"
          required
          maxLength={200}
          placeholder="Your Group Case time is confirmed"
          className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
      </label>
      <label className="mt-3 block text-sm font-medium">
        Message
        <textarea
          name="body"
          required
          rows={7}
          maxLength={5000}
          placeholder={"Each applicant is greeted by name automatically.\n\nBlank lines start a new paragraph."}
          className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !recipients} className="button-primary">
          {pending ? "Sending…" : `Send to ${recipients} applicant${recipients === 1 ? "" : "s"}`}
        </button>
        {!recipients && <p className="text-sm text-mecg-navy/45">Pick at least one status with applicants in it.</p>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    </form>
  );
}
