"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLASS_YEAR_LABELS, CLASS_YEARS, COLLEGES } from "@/lib/workflow";

type IntakeQuestion = {
  key: string;
  prompt: string;
  inputType: string;
  required: boolean;
};

export default function ApplicationForm({
  initialName,
  email,
  cycleOpen,
  cycleName,
  questions,
}: {
  initialName: string;
  email: string;
  cycleOpen: boolean;
  cycleName: string | null;
  questions: IntakeQuestion[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [college, setCollege] = useState("");
  const [uniqname, setUniqname] = useState("");
  const [gradTerm, setGradTerm] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumePath, setResumePath] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function uploadResume(file: File) {
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setError("Upload a PDF resume under 10 MB.");
      return;
    }
    setError("");
    const supabase = createClient();
    const { data: path, error: pathError } = await supabase.rpc("create_resume_upload");
    if (pathError || !path) {
      setError(pathError?.message ?? "applications are not open");
      return;
    }
    const { error: uploadError } = await supabase.storage.from("resumes").upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    setResumePath(path);
    setResumeLabel(file.name);
  }

  function payload(includeConsent: boolean) {
    return {
      name,
      preferredName,
      phone,
      classYear,
      major,
      college,
      uniqname,
      gradTerm,
      accessibilityNotes,
      linkedinUrl,
      answers,
      resumeStoragePath: resumePath,
      consent: includeConsent ? consent : false,
    };
  }

  async function saveDraft() {
    setPending(true);
    setError("");
    const response = await fetch("/api/apply/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(false)),
    });
    const body = await response.json().catch(() => null);
    setError(response.ok ? "" : body?.error ?? "Could not save draft.");
    if (response.ok) setError("Draft saved. You can finish later.");
    setPending(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !cycleOpen) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(true)),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "The application could not be submitted.");
        return;
      }
      router.replace("/applicant");
      router.refresh();
    } catch {
      setError("The application could not be submitted. Try again.");
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    "mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.035] px-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#fe904d]";

  if (!cycleOpen) {
    return (
      <p role="status" className="mt-7 rounded-xl bg-red-50 p-4 text-sm text-red-800">
        applications are not open
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      {cycleName && <p className="text-sm text-mecg-navy/50">Submitting for {cycleName}.</p>}
      <label className="block text-sm font-medium">Full name
        <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Preferred name
        <input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} autoComplete="nickname" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Verified email
        <input value={email} readOnly className="mt-2 min-h-12 w-full rounded-xl bg-mecg-navy/[0.06] px-4 text-mecg-navy/60 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]" />
      </label>
      <label className="block text-sm font-medium">Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Year
        <select value={classYear} onChange={(event) => setClassYear(event.target.value)} required className={fieldClass}>
          <option value="">Select year</option>
          {CLASS_YEARS.map((year) => <option key={year} value={year}>{CLASS_YEAR_LABELS[year]}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Uniqname
        <input value={uniqname} onChange={(event) => setUniqname(event.target.value.toLowerCase())} required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">College
        <select value={college} onChange={(event) => setCollege(event.target.value)} required className={fieldClass}>
          <option value="">Select college</option>
          {COLLEGES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Expected graduation
        <input value={gradTerm} onChange={(event) => setGradTerm(event.target.value)} placeholder="Winter 2028" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Major
        <input value={major} onChange={(event) => setMajor(event.target.value)} required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">LinkedIn URL
        <input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} type="url" className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Schedule or accessibility notes (never scored)
        <textarea value={accessibilityNotes} onChange={(event) => setAccessibilityNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]" />
      </label>
      {questions.map((question) => (
        <label key={question.key} className="block text-sm font-medium">{question.prompt}
          <textarea
            required={question.required}
            value={answers[question.key] ?? ""}
            onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
            maxLength={1200}
            rows={5}
            className="mt-2 w-full rounded-xl bg-mecg-navy/[0.035] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#fe904d]"
          />
        </label>
      ))}
      <label className="block text-sm font-medium">Resume (PDF, 10 MB max)
        <input
          type="file"
          accept="application/pdf"
          required={!resumePath}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadResume(file);
          }}
          className="mt-2 block w-full text-sm"
        />
        {resumeLabel && <p className="mt-2 text-sm text-mecg-navy/55">Uploaded: {resumeLabel}</p>}
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-mecg-navy/65">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1 h-4 w-4 accent-mecg-orange" />
        <span>I consent to MECG using this information to administer the current rush cycle.</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => void saveDraft()} disabled={pending} className="button-secondary w-full">Save draft</button>
        <button type="submit" disabled={pending || !resumePath} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}
