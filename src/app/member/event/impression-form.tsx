"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { IMPRESSION_TAGS } from "@/lib/impressions";
import { SCORE_ANCHORS } from "@/lib/rubrics";

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function ImpressionForm({
  eventId,
  applicationId,
  initial,
}: {
  eventId: string;
  applicationId: string;
  initial?: { score: number; tags: string[]; note: string };
}) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(initial?.score ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const scoreGroupRef = useRef<HTMLDivElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!score) {
      setError("Choose a score before saving this impression.");
      scoreGroupRef.current?.focus();
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/member/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, applicationId, score, tags, note }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Could not save impression");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save impression. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      <div className="text-sm font-medium" id={`impression-score-label-${applicationId}`}>Score</div>
      <div ref={scoreGroupRef} tabIndex={-1} className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={`impression-score-label-${applicationId}`}>
        {SCORE_OPTIONS.map((option) => {
          const selected = score === option;
          const label = `Score ${option}: ${SCORE_ANCHORS[option]}`;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              disabled={pending}
              onClick={() => { setScore(option); setError(""); }}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                selected
                  ? "bg-mecg-navy text-white"
                  : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
              }`}
              title={label}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="text-sm font-medium" id={`impression-tags-label-${applicationId}`}>Tags</div>
      <div className="flex flex-wrap gap-2" aria-labelledby={`impression-tags-label-${applicationId}`}>
        {IMPRESSION_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              aria-label={`${selected ? "Remove" : "Add"} tag: ${tag}`}
              disabled={pending}
              onClick={() => setTags((current) => selected ? current.filter((existing) => existing !== tag) : [...current, tag])}
              className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                selected
                  ? "bg-mecg-navy text-white"
                  : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <label className="text-sm font-medium" htmlFor={`impression-note-${applicationId}`}>Note (optional)</label>
      <textarea
        id={`impression-note-${applicationId}`}
        className="min-h-20 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
        value={note}
        maxLength={1000}
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        aria-describedby={`impression-note-count-${applicationId}`}
      />
      <p id={`impression-note-count-${applicationId}`} className="-mt-3 text-right text-xs tabular-nums text-mecg-navy/45">{note.length} / 1000</p>
      <OperationNotice kind="error">{error}</OperationNotice>
      <button disabled={pending} className="button-primary disabled:opacity-50">
        {pending ? "Saving…" : "Save impression"}
      </button>
    </form>
  );
}
