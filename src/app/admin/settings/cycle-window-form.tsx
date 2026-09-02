"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { eventDateTimeToIso, formatEventDateTime } from "../events/[id]/event-datetime";

export default function CycleWindowForm({
  cycleId,
  cycleStatus,
  opensAt,
  closesAt,
}: {
  cycleId: string;
  cycleStatus: string;
  opensAt: string | null;
  closesAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const locked = !["DRAFT", "OPEN"].includes(cycleStatus);

  async function submit(form: HTMLFormElement) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData(form);
      const opens = eventDateTimeToIso(String(data.get("opensAt") ?? ""), opensAt ?? undefined);
      const closes = eventDateTimeToIso(String(data.get("closesAt") ?? ""), closesAt ?? undefined);
      if (new Date(closes).getTime() <= new Date(opens).getTime()) {
        throw new Error("Applications must close after they open.");
      }
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_CYCLE_WINDOW", cycleId, opensAt: opens, closesAt: closes }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not save the application window.");
      setNotice("Application window saved in Detroit time.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the application window.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-paper p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Application window</p>
      <p className="mt-1 text-sm leading-6 text-mecg-navy/55">
        Times are entered and displayed in Detroit time. The public form also requires the cycle status to be OPEN.
      </p>
      {locked ? (
        <p className="mt-3 rounded-xl bg-white p-3.5 text-sm text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          The application window is locked once the cycle moves into process. Current status: {cycleStatus.replaceAll("_", " ")}.
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <FormField
            label="Applications open"
            name="opensAt"
            type="datetime-local"
            required
            defaultValue={opensAt ? formatEventDateTime(opensAt) : ""}
            disabled={pending}
          />
          <FormField
            label="Applications close"
            name="closesAt"
            type="datetime-local"
            required
            defaultValue={closesAt ? formatEventDateTime(closesAt) : ""}
            disabled={pending}
          />
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="button-primary">
              {pending ? "Saving…" : "Save application window"}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    </section>
  );
}
