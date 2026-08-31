"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCORE_ANCHORS } from "@/lib/rubrics";
import { IMPRESSION_TAGS } from "@/lib/impressions";

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!score) {
      setError("Choose a score");
      return;
    }
    setPending(true);
    setError("");
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
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
      <p className="text-sm font-medium">Score</p>
      <div className="grid grid-cols-5 gap-2">
        {SCORE_OPTIONS.map((option) => {
          const selected = score === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setScore(option)}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
                selected
                  ? "bg-mecg-navy text-white"
                  : "text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]"
              }`}
              title={SCORE_ANCHORS[option]}
            >
              {option}
            </button>
          );
        })}
      </div>
      <p className="text-sm font-medium">Tags</p>
      <div className="flex flex-wrap gap-2">
        {IMPRESSION_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              onClick={() => setTags((current) => selected ? current.filter((existing) => existing !== tag) : [...current, tag])}
              className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] ${
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
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="button-primary disabled:opacity-50">
        {pending ? "Saving…" : "Save impression"}
      </button>
    </form>
  );
}
