"use client";

import { useId, useState } from "react";
import type { ApplicationDraftRecovery } from "@/lib/application-draft-recovery";

export const APPLICATION_RECOVERY_FIELDS = [
  { key: "name", label: "Full name" }, { key: "preferredName", label: "Preferred name" },
  { key: "phone", label: "Phone" }, { key: "classYear", label: "Class year" },
  { key: "major", label: "Major" }, { key: "college", label: "College" },
  { key: "uniqname", label: "Uniqname" }, { key: "gradTerm", label: "Expected graduation" },
  { key: "accessibilityNotes", label: "Scheduling or access needs" }, { key: "linkedinUrl", label: "LinkedIn profile" },
] satisfies { key: Exclude<keyof ApplicationDraftRecovery, "answers">; label: string }[];

type Props = {
  saved: ApplicationDraftRecovery | null;
  browser: ApplicationDraftRecovery;
  questions: readonly { key: string; prompt: string }[];
  resume?: { saved: string; browser: string };
  expanded?: boolean;
  onCombine: (draft: ApplicationDraftRecovery, resumeSource: "saved" | "browser") => void;
};

export default function ApplicationRecoveryReview({ saved, browser, questions, resume, expanded = false, onCombine }: Props) {
  const id = useId();
  const [savedChoices, setSavedChoices] = useState<ReadonlySet<string>>(() => new Set());
  const [downloadStatus, setDownloadStatus] = useState("");
  const savedCopy = saved ?? browser;
  const fields = [
    ...APPLICATION_RECOVERY_FIELDS.map(({ key, label }) => ({ key, label, saved: savedCopy[key], browser: browser[key] })),
    ...questions.map(({ key, prompt }) => ({ key: `answer:${key}`, label: prompt, saved: savedCopy.answers[key] ?? "", browser: browser.answers[key] ?? "" })),
  ];
  const changed = fields.filter((field) => field.saved !== field.browser);
  const resumeDiffers = resume && resume.saved !== resume.browser;

  function choose(key: string, useSaved: boolean) {
    setSavedChoices((current) => {
      const next = new Set(current);
      if (useSaved) next.add(key); else next.delete(key);
      return next;
    });
  }
  function combine() {
    if (!saved) return;
    const draft = { ...browser, answers: { ...browser.answers } };
    for (const { key } of APPLICATION_RECOVERY_FIELDS) if (savedChoices.has(key)) draft[key] = saved[key];
    for (const { key } of questions) if (savedChoices.has(`answer:${key}`)) draft.answers[key] = saved.answers[key] ?? "";
    onCombine(draft, savedChoices.has("resume") ? "saved" : "browser");
  }
  function download() {
    try {
      const payload = { format: "mecg.application-copies.v1", exportedAt: new Date().toISOString(), saved: saved ? { answers: saved, resumeReference: resume?.saved ?? null } : null, browser: { answers: browser, resumeReference: resume?.browser ?? null } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "mecg-application-private-copies.json";
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadStatus("Your copies were prepared for download. Check your downloads before discarding any answers.");
    } catch { setDownloadStatus("Download could not start. Keep this page open and copy the text you need before choosing."); }
  }
  function comparison(field: typeof fields[number], selectable: boolean) {
    return <fieldset key={field.key} className="min-w-0 border-0 p-0">
      <legend className="font-semibold">{field.label}</legend>
      <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">{(["saved", "browser"] as const).map((source) => <div key={source} className="min-w-0 rounded-xl bg-mecg-navy/[0.035] p-3">
        {selectable ? <label className="flex min-h-11 cursor-pointer items-center gap-2 font-medium"><input type="radio" name={`${id}-${field.key}`} checked={source === "saved" ? savedChoices.has(field.key) : !savedChoices.has(field.key)} onChange={() => choose(field.key, source === "saved")} />Use {source === "saved" ? "saved draft" : "browser answers"}</label> : <p className="font-medium">{source === "saved" ? "Saved draft" : "Browser answers"}</p>}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{field[source] || "Not provided"}</p>
      </div>)}</div>
    </fieldset>;
  }
  return <div className="mt-5 min-w-0">
    <p className="text-sm leading-6 text-mecg-navy/70">Download your answers before choosing if you want a private backup. It contains personal information and written responses. Uploaded files are not included; any resume reference only identifies the existing upload.</p>
    <button type="button" className="button-secondary mt-3" onClick={download}>{saved ? "Download both copies" : "Download this page’s answers"}</button>
    <p role="status" className="mt-2 text-sm leading-6">{downloadStatus}</p>
    {saved && <details open={expanded || undefined} className="mt-4 border-y border-mecg-navy/10 py-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Compare answers before choosing</summary>
      <p className="mt-2 text-sm leading-6 text-mecg-navy/70">{changed.length} changed {changed.length === 1 ? "answer" : "answers"}. For each, choose the version to keep. Browser answers are selected initially. Combining uses these choices; it does not rewrite your text.</p>
      <div className="mt-4 space-y-6">{changed.map((field) => comparison(field, true))}</div>
      {resumeDiffers && <fieldset className="mt-5 min-w-0 border-0 p-0"><legend className="font-semibold">Resume to keep</legend>{(["saved", "browser"] as const).map((source) => <label key={source} className="flex min-h-11 items-center gap-2"><input type="radio" name={`${id}-resume`} checked={source === "saved" ? savedChoices.has("resume") : !savedChoices.has("resume")} onChange={() => choose("resume", source === "saved")} />Use {source === "saved" ? "saved draft’s" : "this page’s"} resume</label>)}</fieldset>}
      <details className="mt-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Unchanged answers ({fields.length - changed.length})</summary><div className="mt-3 space-y-5">{fields.filter((field) => field.saved === field.browser).map((field) => comparison(field, false))}</div></details>
      <button type="button" className="button-primary mt-5" onClick={combine}>Continue with combined answers</button>
    </details>}
  </div>;
}
