"use client";
// design-owner: client:mecg because the internal workspace follows docs/DESIGN.md tokens and admin patterns

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import { authorizedFetch, fetchJsonWithTimeout } from "@/lib/client-fetch";
import {
  MAX_NOTES_LENGTH, MAX_PREFERRED_PROJECTS, MAX_SKILLS, MAX_WEEKLY_HOURS,
  parseAvailabilityInput, parseSkillsText, type MyAvailability, type ProjectOption,
} from "@/lib/staffing/model";

const RANKS = ["First choice", "Second choice", "Third choice"].slice(0, MAX_PREFERRED_PROJECTS);
const unconfirmed = "Save could not be confirmed. Reload to check before retrying.";

export default function AvailabilityForm({ availability, projects }: { availability: MyAvailability; projects: ProjectOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const locked = useRef(false);
  const known = new Set(projects.map((project) => project.id));
  // A preference whose project was since deleted is dropped from the form.
  const preferred = availability.preferredProjectIds.filter((id) => known.has(id));

  async function submit(form: HTMLFormElement) {
    if (locked.current) return;
    const data = new FormData(form);
    const hours = String(data.get("weeklyHours") ?? "").trim();
    const parsed = parseAvailabilityInput({
      weeklyHours: hours === "" ? Number.NaN : Number(hours),
      skills: parseSkillsText(String(data.get("skills") ?? "")),
      preferredProjectIds: RANKS.map((_, index) => String(data.get(`project-${index}`) ?? "")).filter(Boolean),
      notes: String(data.get("notes") ?? ""),
    });
    if (!parsed.ok) { setNotice({ error: true, text: parsed.error }); return; }
    locked.current = true; setPending(true); setNotice(null);
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/member/staffing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: availability.cycleId, revision: availability.revision, availability: parsed.value }),
      }, 15_000, authorizedFetch);
      if (!response.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : unconfirmed;
        setNotice({ error: true, text: message });
        return;
      }
      setNotice({ error: false, text: "Availability saved. The board will see it when it staffs projects." });
      // The form stays mounted (keeping focus); the refresh brings the new revision in through props.
      router.refresh();
    } catch {
      setNotice({ error: true, text: unconfirmed });
    } finally { locked.current = false; setPending(false); }
  }

  return (
    <>
    <form
      aria-labelledby="availability-title"
      className="workspace-panel grid gap-4 rounded-xl bg-paper p-5 sm:grid-cols-2"
      onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}
    >
      <div className="sm:col-span-2">
        <h2 id="availability-title" className="text-sm font-semibold text-muted">Your availability this cycle</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          The board reads this when it staffs client projects. Only you and the board of this cycle see it. Change it any time.
        </p>
      </div>
      <FormField
        label="Hours a week for client work"
        name="weeklyHours"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_WEEKLY_HOURS}
        step={1}
        required
        defaultValue={availability.weeklyHours === null ? "" : String(availability.weeklyHours)}
        hint="Use 0 if you can't take a project this cycle."
        disabled={pending}
      />
      <FormField
        label="Skills"
        name="skills"
        defaultValue={availability.skills.join(", ")}
        hint={`Separate with commas, up to ${MAX_SKILLS}. For example: Excel modeling, market sizing, SQL.`}
        disabled={pending}
      />
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-mecg-navy">Projects you would most like</legend>
        {RANKS.map((rank, index) => (
          <label key={rank} className="min-w-0 text-sm font-medium">
            {rank}
            <select name={`project-${index}`} defaultValue={preferred[index] ?? ""} disabled={pending || projects.length === 0} className="select-control mt-2 text-sm">
              <option value="">No preference</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.semester ? `${project.title} · ${project.semester}` : project.title}</option>
              ))}
            </select>
          </label>
        ))}
        {projects.length === 0 && <p className="text-sm text-muted sm:col-span-3">No projects are listed yet.</p>}
      </fieldset>
      <div className="text-sm font-semibold text-mecg-navy sm:col-span-2">
        <label htmlFor="staffing-notes">Notes for the board</label>
        <textarea
          id="staffing-notes"
          aria-describedby="staffing-notes-hint"
          name="notes"
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          defaultValue={availability.notes}
          disabled={pending}
          className="mt-2 w-full rounded-xl bg-white p-3 text-sm font-normal inset-ring inset-ring-line-strong outline-none focus:inset-ring-2 focus:inset-ring-mecg-navy"
        />
        <span id="staffing-notes-hint" className="mt-2 block text-xs font-normal leading-5 text-muted">Optional. Exams, travel or anything else the board should plan around.</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="button-primary" disabled={pending}>{pending ? "Saving…" : "Save availability"}</button>
        {!availability.submitted && <span className="text-sm text-muted">Not submitted yet.</span>}
      </div>
    </form>
    {/* Always mounted, so screen readers announce the text when it changes. */}
    <p role="status" aria-live="polite" className={`text-sm leading-6 ${notice?.error ? "text-danger" : "text-success"}`}>{notice?.text ?? ""}</p>
    </>
  );
}
