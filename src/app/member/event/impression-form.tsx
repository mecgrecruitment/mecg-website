"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { OBSERVATION_TAGS } from "./observation-tags";
import { authorizedFetch } from "@/lib/client-fetch";

export default function ImpressionForm({
  eventId,
  applicationId,
  initial,
}: {
  eventId: string;
  applicationId: string;
  initial?: { tags: string[]; note: string };
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!tags.length && !note.trim()) {
      setError("Add a neutral tag or a short observation before saving.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/member/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, applicationId, tags, note }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not save observation");
        setPending(false);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save observation. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      <p className="text-sm leading-6 text-muted">
        Capture factual context only. Formal rubric evaluations are the only scores used in recruitment decisions.
      </p>
      <div className="text-sm font-medium" id={`impression-tags-label-${applicationId}`}>Observation tags</div>
      <div className="flex flex-wrap gap-2" aria-labelledby={`impression-tags-label-${applicationId}`}>
        {OBSERVATION_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              aria-label={`${selected ? "Remove" : "Add"} tag: ${tag}`}
              disabled={pending}
              onClick={() => { setSaved(false); setTags((current) => selected ? current.filter((existing) => existing !== tag) : [...current, tag]); }}
              className={`min-h-11 rounded-xl px-3.5 text-xs font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                selected
                  ? "bg-mecg-navy text-white"
                  : "text-mecg-navy inset-ring inset-ring-line-strong hover:inset-ring-mecg-navy/40"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <label className="text-sm font-medium" htmlFor={`impression-note-${applicationId}`}>Factual note (optional when a tag is selected)</label>
      <textarea
        id={`impression-note-${applicationId}`}
        className="min-h-20 rounded-xl bg-wash px-4 py-3 inset-ring inset-ring-line-strong outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        value={note}
        maxLength={1000}
        disabled={pending}
        onChange={(event) => { setSaved(false); setNote(event.target.value); }}
        aria-describedby={`impression-note-count-${applicationId}`}
      />
      <p id={`impression-note-count-${applicationId}`} className="-mt-3 text-right text-xs tabular-nums text-muted">{note.length} / 1000</p>
      <OperationNotice kind="error">{error}</OperationNotice>
      {saved && <p className="submission-confirmed rounded-xl bg-success-wash px-4 py-3 text-sm font-semibold text-success" role="status">Observation saved.</p>}
      <button type="submit" disabled={pending} className={`button-primary disabled:opacity-50 ${saved ? "is-success" : ""}`}>
        {saved ? "✓ Saved" : pending ? "Saving…" : "Save observation"}
      </button>
    </form>
  );
}
