"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type IntakeQuestion = {
  key: string;
  prompt: string;
  inputType: "short_text" | "long_text" | "url" | "select";
  required: boolean;
};

const INPUT_TYPES: ReadonlyArray<readonly [IntakeQuestion["inputType"], string]> = [
  ["long_text", "Long answer"],
  ["short_text", "Short answer"],
  ["url", "Link"],
  ["select", "Choice"],
];

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

// The whole ordered list is submitted at once. The RPC replaces the set in one
// statement, so a reorder cannot land half-applied, and the client never has to
// reconcile per-row ids it does not own.
export default function QuestionEditor({
  cycleId,
  initial,
  locked,
}: {
  cycleId: string;
  initial: IntakeQuestion[];
  locked: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const update = (index: number, patch: Partial<IntakeQuestion>) => {
    setQuestions((current) => current.map((question, at) => (at === index ? { ...question, ...patch } : question)));
  };

  const move = (index: number, delta: number) => {
    setQuestions((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const duplicateKeys = questions
    .map((question) => question.key)
    .filter((key, index, all) => all.indexOf(key) !== index);
  const invalid = questions.some((question) => !KEY_PATTERN.test(question.key) || !question.prompt.trim())
    || duplicateKeys.length > 0;

  async function save() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, action: "SET_APPLICATION_QUESTIONS", questions }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not save the questions");
        return;
      }
      setNotice(`Saved ${questions.length} question${questions.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setError("Could not save the questions");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Application questions</p>
          <p className="mt-1 max-w-2xl text-sm text-mecg-navy/55">
            These are the written prompts on the public application, in order.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-mecg-navy/45">{questions.length} of 25</span>
      </div>

      {locked ? (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-mecg-navy/65 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
          Applications have already been submitted in this cycle, so the prompts are frozen. Answers already given keep
          the wording they were shown, but changing the questions under a cohort that is partway through is not allowed.
        </p>
      ) : (
        <>
          <ol className="mt-4 flex flex-col gap-3">
            {questions.map((question, index) => (
              <li key={index} className="rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-mecg-navy/45">{index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Move question ${index + 1} up`} className="inline-flex size-9 items-center justify-center rounded-full text-mecg-navy/60 hover:bg-mecg-blue/[0.1] disabled:opacity-35">&uarr;</button>
                    <button type="button" onClick={() => move(index, 1)} disabled={pending || index === questions.length - 1} aria-label={`Move question ${index + 1} down`} className="inline-flex size-9 items-center justify-center rounded-full text-mecg-navy/60 hover:bg-mecg-blue/[0.1] disabled:opacity-35">&darr;</button>
                    <button type="button" onClick={() => setQuestions((current) => current.filter((_, at) => at !== index))} disabled={pending} aria-label={`Remove question ${index + 1}`} className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-45">Remove</button>
                  </div>
                </div>

                <label className="mt-2 block text-sm font-medium">
                  Prompt
                  <textarea
                    value={question.prompt}
                    onChange={(event) => update(index, { prompt: event.target.value })}
                    rows={2}
                    maxLength={2000}
                    className="mt-1.5 w-full rounded-xl bg-mecg-navy/[0.035] p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange)]"
                  />
                </label>

                <div className="mt-2.5 flex flex-wrap items-end gap-3">
                  <label className="block text-sm font-medium">
                    Key
                    <input
                      value={question.key}
                      onChange={(event) => update(index, { key: event.target.value })}
                      aria-invalid={!KEY_PATTERN.test(question.key)}
                      className="mt-1.5 min-h-11 w-48 rounded-xl bg-mecg-navy/[0.035] px-3 font-mono text-xs shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Answer type
                    <select
                      value={question.inputType}
                      onChange={(event) => update(index, { inputType: event.target.value as IntakeQuestion["inputType"] })}
                      className="mt-1.5 min-h-11 rounded-xl bg-mecg-navy/[0.035] px-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none"
                    >
                      {INPUT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={question.required} onChange={(event) => update(index, { required: event.target.checked })} className="size-4" />
                    Required
                  </label>
                </div>
                {!KEY_PATTERN.test(question.key) && (
                  <p className="mt-2 text-xs text-red-700">Keys are lowercase letters, digits and underscores, starting with a letter.</p>
                )}
              </li>
            ))}
          </ol>

          {!questions.length && (
            <p className="mt-4 rounded-xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-center text-sm text-mecg-navy/55">
              No written questions. Applicants would submit a resume and nothing else.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || questions.length >= 25}
              onClick={() => setQuestions((current) => [...current, { key: `question_${current.length + 1}`, prompt: "", inputType: "long_text", required: true }])}
              className="button-secondary text-sm"
            >
              + Add question
            </button>
            <button type="button" disabled={pending || invalid} onClick={() => void save()} className="button-primary">
              {pending ? "Saving..." : "Save questions"}
            </button>
            {duplicateKeys.length > 0 && <p className="text-sm text-red-700">Duplicate key: {duplicateKeys[0]}</p>}
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    </section>
  );
}
