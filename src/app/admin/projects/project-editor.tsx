"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  clientLabel: string;
  industry: string;
  semester: string;
  decision: string;
  context: string;
  handoff: string;
  methods: string[];
  deliverables: string[];
  constraints: string[];
  memberWork: string[];
  isPublic: boolean;
  sortOrder: number;
  staffedUserIds: string[];
};

export type StaffOption = { id: string; name: string };

const BLANK: ProjectRow = {
  id: "", slug: "", title: "", clientLabel: "", industry: "", semester: "", decision: "",
  context: "", handoff: "", methods: [], deliverables: [], constraints: [], memberWork: [],
  isPublic: false, sortOrder: 0, staffedUserIds: [],
};

// Lists are edited as one item per line. A tag widget would be nicer and is not
// worth the code for four fields a board touches a few times a semester.
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

export default function ProjectEditor({ projects, staff }: { projects: ProjectRow[]; staff: StaffOption[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(projects[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const editing = projects.find((project) => project.id === selectedId) ?? BLANK;
  const [staffed, setStaffed] = useState<string[]>(editing.staffedUserIds);
  const [staffKey, setStaffKey] = useState(editing.id);
  if (staffKey !== editing.id) {
    // Selecting a different project must reset the staffing checkboxes, or the
    // previous project's roster would be saved onto this one.
    setStaffKey(editing.id);
    setStaffed(editing.staffedUserIds);
  }

  async function post(payload: Record<string, unknown>, successMessage: string) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "Could not save");
        return;
      }
      setNotice(successMessage);
      router.refresh();
    } catch {
      setError("Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setSelectedId(project.id)}
            aria-current={project.id === selectedId ? "true" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-[12px] font-semibold ${project.id === selectedId ? "bg-mecg-navy text-white" : "text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"}`}
          >
            {project.title}
            {project.isPublic && <span className="font-mono text-[9px] uppercase tracking-[0.08em] opacity-70">Public</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelectedId("")}
          className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[12px] font-semibold ${selectedId ? "text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]" : "bg-mecg-navy text-white"}`}
        >
          + New project
        </button>
      </div>

      <form
        key={editing.id || "new"}
        className="rounded-2xl bg-paper p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void post({
            action: "SAVE",
            project: {
              slug: String(data.get("slug") ?? ""),
              title: String(data.get("title") ?? ""),
              clientLabel: String(data.get("clientLabel") ?? ""),
              industry: String(data.get("industry") ?? ""),
              semester: String(data.get("semester") ?? ""),
              decision: String(data.get("decision") ?? ""),
              context: String(data.get("context") ?? ""),
              handoff: String(data.get("handoff") ?? ""),
              methods: lines(String(data.get("methods") ?? "")),
              deliverables: lines(String(data.get("deliverables") ?? "")),
              constraints: lines(String(data.get("constraints") ?? "")),
              memberWork: lines(String(data.get("memberWork") ?? "")),
              isPublic: data.get("isPublic") === "on",
              sortOrder: Number.parseInt(String(data.get("sortOrder") ?? "0"), 10) || 0,
            },
          }, "Project saved.");
        }}
      >
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">
          {editing.id ? "Edit project" : "New project"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            ["title", "Title", editing.title, true],
            ["slug", "URL slug", editing.slug, true],
            ["clientLabel", "Client label", editing.clientLabel, false],
            ["industry", "Industry", editing.industry, false],
            ["semester", "Semester", editing.semester, false],
            ["decision", "Decision supported", editing.decision, false],
          ] as const).map(([name, label, value, required]) => (
            <label key={name} className="block text-sm font-medium">
              {label}
              <input
                name={name}
                required={required}
                defaultValue={value}
                className="mt-1.5 min-h-11 w-full rounded-xl bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
              />
            </label>
          ))}
        </div>
        {([
          ["context", "Context", editing.context],
          ["handoff", "Handoff", editing.handoff],
        ] as const).map(([name, label, value]) => (
          <label key={name} className="mt-3 block text-sm font-medium">
            {label}
            <textarea name={name} rows={2} defaultValue={value} className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none" />
          </label>
        ))}
        {([
          ["methods", "Methods", editing.methods],
          ["deliverables", "Deliverables", editing.deliverables],
          ["constraints", "Constraints", editing.constraints],
          ["memberWork", "Member work", editing.memberWork],
        ] as const).map(([name, label, value]) => (
          <label key={name} className="mt-3 block text-sm font-medium">
            {label} <span className="font-normal text-mecg-navy/45">(one per line)</span>
            <textarea name={name} rows={3} defaultValue={value.join("\n")} className="mt-1.5 w-full rounded-xl bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none" />
          </label>
        ))}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isPublic" defaultChecked={editing.isPublic} className="size-4" />
            Show on the public Work page
          </label>
          <label className="text-sm font-medium">
            Order
            <input type="number" name="sortOrder" defaultValue={editing.sortOrder} className="ml-2 min-h-11 w-20 rounded-xl bg-white px-3 text-sm tabular-nums shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none" />
          </label>
          <button type="submit" disabled={pending} className="button-primary">{pending ? "Saving…" : "Save project"}</button>
        </div>
        <p className="mt-2 text-xs leading-5 text-mecg-navy/45">
          Projects are private until this box is ticked. Nothing here reaches the public site otherwise.
        </p>
      </form>

      {editing.id && (
        <div className="rounded-2xl bg-paper p-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Staffing</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Who worked on {editing.title}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {staff.map((person) => {
              const checked = staffed.includes(person.id);
              return (
                <label key={person.id} className={`inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 text-[12px] font-semibold ${checked ? "bg-mecg-navy text-white" : "text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) => setStaffed((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))}
                  />
                  {person.name}
                </label>
              );
            })}
            {!staff.length && <p className="text-sm text-mecg-navy/45">No active members to staff yet.</p>}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void post({ action: "STAFF", projectId: editing.id, members: staffed.map((id) => ({ userId: id, roleLabel: "" })) }, "Staffing saved.")}
            className="button-secondary mt-4 text-sm"
          >
            Save staffing
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    </section>
  );
}
