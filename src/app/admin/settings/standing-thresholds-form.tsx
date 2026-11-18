"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import { parseThresholdInput, type StoredThresholds } from "@/lib/standing/model";

export default function StandingThresholdsForm({ cycleId, thresholds }: { cycleId: string; thresholds: StoredThresholds | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const locked = useRef(false);

  async function submit(form: HTMLFormElement) {
    if (locked.current || !thresholds) return;
    const data = new FormData(form);
    const parsed = parseThresholdInput({
      minAttendancePct: Number(data.get("minAttendancePct")),
      minProjects: Number(data.get("minProjects")),
      requireOnboarding: data.get("requireOnboarding") === "on",
    });
    if (!parsed.ok) { setNotice({ error: true, text: parsed.error }); return; }
    locked.current = true; setPending(true); setNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/admin/standing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, revision: thresholds.revision, thresholds: parsed.value }),
      }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Save could not be confirmed. Reload to check before retrying.";
        setNotice({ error: true, text: message });
        return;
      }
      setNotice({ error: false, text: "Standing thresholds saved." });
      router.refresh();
    } catch {
      setNotice({ error: true, text: "Save could not be confirmed. Reload to check before retrying." });
    } finally { locked.current = false; setPending(false); }
  }

  return (
    <section id="member-standing" className="workspace-panel rounded-xl bg-paper p-5">
      <p className="text-sm font-semibold text-muted">Member standing thresholds</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        Member standing flags a member as at risk when they miss any of these for this cycle. Set a value to 0, or untick onboarding, to stop checking it.
      </p>
      {!thresholds ? (
        <p role="alert" className="mt-3 rounded-xl bg-white p-4 text-sm text-muted inset-ring inset-ring-line">
          The current thresholds could not be loaded, so they cannot be changed right now.
        </p>
      ) : (
        <form
          // Remount after a save so the inputs show the stored values and revision.
          key={thresholds.revision}
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}
        >
          <FormField label="Minimum attendance (% of held events)" name="minAttendancePct" type="number" min={0} max={100} step={1} required defaultValue={String(thresholds.minAttendancePct)} disabled={pending} />
          <FormField label="Minimum projects staffed" name="minProjects" type="number" min={0} max={10} step={1} required defaultValue={String(thresholds.minProjects)} disabled={pending} />
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" name="requireOnboarding" defaultChecked={thresholds.requireOnboarding} disabled={pending} className="h-5 w-5" />
            Onboarding must be complete
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="button-primary" disabled={pending}>{pending ? "Saving…" : "Save thresholds"}</button>
            {!thresholds.configured && <span className="text-sm text-muted">Using the defaults until saved.</span>}
          </div>
          {notice && <p role={notice.error ? "alert" : "status"} className={`text-sm leading-6 sm:col-span-2 ${notice.error ? "text-danger" : "text-success"}`}>{notice.text}</p>}
        </form>
      )}
    </section>
  );
}
