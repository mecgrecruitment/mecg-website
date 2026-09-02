"use client";

import { useAction } from "@/lib/use-action";
import { detroitDateTimeToIso } from "@/lib/detroit-date-time";
import OperationNotice from "@/components/operation-notice";

export default function SlotForm({ cycleId, eventId }: { cycleId: string; eventId: string }) {
  const { pending, error, success, run, setError } = useAction("/api/admin/rush", "Could not create slot. Check the times and try again.");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    let result;
    try {
      result = await run(
        {
          action: "CREATE_SLOT",
          cycleId,
          eventId,
          startsAt: detroitDateTimeToIso(String(data.get("startsAt"))),
          endsAt: detroitDateTimeToIso(String(data.get("endsAt"))),
          capacity: Number(data.get("capacity") ?? 8),
        },
        { successMessage: "RSVP slot saved.", fallbackError: "Could not create slot" },
      );
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "Could not create slot");
      return;
    }
    if (result.ok) form.reset();
  }

  return (
    <form className="mt-4 flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]" onSubmit={submit}>
      <p className="text-sm font-medium">Add RSVP slot</p>
      <p className="text-xs text-mecg-navy/60">Times are entered in Detroit time.</p>
      <label className="text-sm">
        Starts at
        <input name="startsAt" type="datetime-local" required disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <label className="text-sm">
        Ends at
        <input name="endsAt" type="datetime-local" required disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <label className="text-sm">
        Capacity
        <input name="capacity" type="number" min={1} defaultValue={8} disabled={pending} className="field-control mt-1 block text-sm disabled:opacity-60" />
      </label>
      <button type="submit" disabled={pending} className="button-secondary self-start text-sm">
        {pending ? "Saving…" : "Save slot"}
      </button>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
    </form>
  );
}
