"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { detroitDateTimeToIso, formatDetroitDateTime } from "@/lib/detroit-date-time";
import { cycleStatusLabel } from "@/lib/labels";
import { authorizedFetch } from "@/lib/client-fetch";

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
      const opens = detroitDateTimeToIso(String(data.get("opensAt") ?? ""), opensAt ?? undefined);
      const closes = detroitDateTimeToIso(String(data.get("closesAt") ?? ""), closesAt ?? undefined);
      if (new Date(closes).getTime() <= new Date(opens).getTime()) {
        throw new Error("Applications must close after they open.");
      }
      const response = await authorizedFetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_CYCLE_WINDOW", cycleId, opensAt: opens, closesAt: closes }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not save the application window.");
      }
      setNotice("Application window saved in Detroit time.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the application window.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="workspace-panel rounded-xl bg-paper p-5">
      <p className="text-[13px] font-semibold text-muted">Application window</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        Times are entered and displayed in Detroit time. The public form also opens only once the cycle status is Applications open.
      </p>
      {locked ? (
        <p className="mt-3 rounded-xl bg-white p-3.5 text-sm text-muted inset-ring inset-ring-line">
          The application window is locked once the cycle moves into process. Current status: {cycleStatusLabel(cycleStatus)}.
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
            defaultValue={opensAt ? formatDetroitDateTime(opensAt) : ""}
            disabled={pending}
          />
          <FormField
            label="Applications close"
            name="closesAt"
            type="datetime-local"
            required
            defaultValue={closesAt ? formatDetroitDateTime(closesAt) : ""}
            disabled={pending}
          />
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="button-primary">
              {pending ? "Saving…" : "Save application window"}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
    </section>
  );
}
