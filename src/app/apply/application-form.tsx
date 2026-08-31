"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CLASS_YEAR_LABELS, CLASS_YEARS, COLLEGES, type ApplicationDraft } from "@/lib/workflow";

type IntakeQuestion = { key: string; prompt: string; inputType: string; required: boolean };
type Step = "details" | "responses" | "materials" | "review";
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; label: string } | { kind: "error"; message: string };
type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; label: string }
  | { kind: "uploaded"; label: string; size?: number; pageCount?: number }
  | { kind: "error"; message: string };
type SubmitState = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string };

const STEPS: { id: Step; label: string; shortLabel: string }[] = [
  { id: "details", label: "About you", shortLabel: "Details" },
  { id: "responses", label: "Written responses", shortLabel: "Responses" },
  { id: "materials", label: "Materials and access", shortLabel: "Materials" },
  { id: "review", label: "Review and submit", shortLabel: "Review" },
];

const fieldClass = "mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16),0_1px_2px_rgba(7,13,31,0.04)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-orange),0_1px_2px_rgba(7,13,31,0.04)]";
const labelClass = "block text-sm font-semibold text-mecg-navy";

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function guidanceFor(key: string) {
  if (key === "problem_example") return "Recommended: 200–350 words";
  return "Recommended: 150–250 words";
}

export default function ApplicationForm({ initialName, email, cycleOpen, cycleName, questions, initialDraft }: {
  initialName: string;
  email: string;
  cycleOpen: boolean;
  cycleName: string | null;
  questions: IntakeQuestion[];
  initialDraft: ApplicationDraft | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState(initialDraft?.name || initialName);
  const [preferredName, setPreferredName] = useState(initialDraft?.preferredName ?? "");
  const [phone, setPhone] = useState(initialDraft?.phone ?? "");
  const [classYear, setClassYear] = useState(initialDraft?.classYear ?? "");
  const [major, setMajor] = useState(initialDraft?.major ?? "");
  const [college, setCollege] = useState(initialDraft?.college ?? "");
  const [uniqname, setUniqname] = useState(initialDraft?.uniqname ?? "");
  const [gradTerm, setGradTerm] = useState(initialDraft?.gradTerm ?? "");
  const [accessibilityNotes, setAccessibilityNotes] = useState(initialDraft?.accessibilityNotes ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialDraft?.linkedinUrl ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(initialDraft?.answers ?? {});
  const [resumePath, setResumePath] = useState(initialDraft?.resumeStoragePath ?? "");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [uploadState, setUploadState] = useState<UploadState>(initialDraft?.resumeStoragePath ? { kind: "uploaded", label: "Previously uploaded PDF" } : { kind: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const initialized = useRef(false);
  const uploadSequence = useRef(0);

  const draftPayload = useMemo(() => ({ name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumeStoragePath: resumePath, consent: false }), [name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumePath]);

  useEffect(() => {
    if (!cycleOpen) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaveState({ kind: "saving" });
      try {
        const response = await fetch("/api/apply/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draftPayload) });
        if (!response.ok) throw new Error("Could not save your draft");
        setSaveState({ kind: "saved", label: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
      } catch (error) {
        setSaveState({ kind: "error", message: error instanceof Error ? error.message : "Could not save your draft" });
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [cycleOpen, draftPayload]);

  async function uploadResume(file: File) {
    const sequence = ++uploadSequence.current;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setUploadState({ kind: "error", message: "Choose a PDF smaller than 10 MB." });
      return;
    }
    setUploadState({ kind: "uploading", label: file.name });
    let documentId = "";
    try {
      const startResponse = await fetch("/api/apply/resume/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      });
      const startBody = await startResponse.json().catch(() => null);
      if (!startResponse.ok || typeof startBody?.documentId !== "string" || typeof startBody?.path !== "string") {
        throw new Error(startBody?.error ?? "We could not start the resume upload.");
      }
      documentId = startBody.documentId;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("resumes").upload(startBody.path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error("We could not upload your resume. Please try again.");
      const finalizeResponse = await fetch("/api/apply/resume/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const finalized = await finalizeResponse.json().catch(() => null);
      if (!finalizeResponse.ok || typeof finalized?.path !== "string") {
        throw new Error(finalized?.error ?? "We could not verify your resume. Please try again.");
      }
      if (sequence !== uploadSequence.current) return;
      setResumePath(finalized.path);
      setUploadState({ kind: "uploaded", label: finalized.filename ?? file.name, size: finalized.size, pageCount: finalized.pageCount });
      setErrors((current) => ({ ...current, resume: "" }));
    } catch (error) {
      if (documentId) {
        void fetch("/api/apply/resume/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });
      }
      if (sequence === uploadSequence.current) {
        setUploadState({ kind: "error", message: error instanceof Error ? error.message : "We could not upload your resume. Please try again." });
      }
    }
  }

  function validate(target: Step) {
    const next: Record<string, string> = {};
    if (target === "details") {
      if (!name.trim()) next.name = "Enter your full name.";
      if (!classYear) next.classYear = "Select your year.";
      if (!uniqname.trim()) next.uniqname = "Enter your uniqname.";
      if (!college) next.college = "Select your college.";
      if (!major.trim()) next.major = "Enter your major.";
    }
    if (target === "responses") {
      for (const question of questions) if (question.required && !answers[question.key]?.trim()) next[question.key] = "Write a response before continuing.";
    }
    if (target === "materials" && !resumePath) next.resume = "Upload your resume before continuing.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function move(next: Step) {
    if (!validate(step)) return;
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!consent || submitState.kind === "submitting") return;
    setSubmitState({ kind: "submitting" });
    try {
      const response = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draftPayload, consent: true }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The application could not be submitted.");
      }
      router.replace("/applicant?submitted=1");
      router.refresh();
    } catch (error) {
      setSubmitState({ kind: "error", message: error instanceof Error ? error.message : "The application could not be submitted." });
    }
  }

  if (!cycleOpen) return <div className="mt-8 rounded-2xl bg-red-50 p-6 text-red-900"><p className="font-semibold">Applications are currently closed.</p><p className="mt-2 text-sm leading-6 text-red-800/75">Check the recruitment page for the next opening date, or email the MECG board if you expected to apply today.</p></div>;

  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const completed = (id: Step) => STEPS.findIndex((item) => item.id === id) < currentIndex;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,720px)] lg:items-start lg:gap-12">
      <aside className="lg:sticky lg:top-8">
        <div className="rounded-2xl bg-mecg-navy p-5 text-white shadow-[0_18px_50px_rgba(7,13,31,0.16)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mecg-orange">{cycleName ?? "Current cycle"}</p>
          <ol className="mt-6 grid grid-cols-4 gap-2 lg:block lg:space-y-2" aria-label="Application progress">
            {STEPS.map((item, index) => {
              const active = item.id === step;
              return <li key={item.id}><button type="button" onClick={() => index <= currentIndex && setStep(item.id)} disabled={index > currentIndex} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors ${active ? "bg-white/12 text-white" : completed(item.id) ? "text-white/75 hover:bg-white/8" : "cursor-default text-white/35"}`} aria-current={active ? "step" : undefined}><span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${active ? "bg-mecg-orange text-mecg-navy" : completed(item.id) ? "bg-white text-mecg-navy" : "bg-white/8"}`}>{completed(item.id) ? "✓" : index + 1}</span><span className="hidden lg:inline">{item.label}</span><span className="sr-only lg:hidden">{item.shortLabel}</span></button></li>;
            })}
          </ol>
          <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/55">
            {saveState.kind === "saving" && <p>Saving changes...</p>}
            {saveState.kind === "saved" && <p className="tabular-nums">Saved at {saveState.label}</p>}
            {saveState.kind === "error" && <p className="text-red-200">{saveState.message}</p>}
            {saveState.kind === "idle" && <p>Your answers save automatically.</p>}
          </div>
        </div>
        <p className="mt-4 px-2 text-xs leading-5 text-mecg-navy/50">Need help? <a className="underline underline-offset-2" href="mailto:mecg-board@umich.edu">Email the recruitment team.</a></p>
      </aside>

      <section className="min-w-0 rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(7,13,31,0.09),inset_0_0_0_1px_rgba(7,13,31,0.06)] sm:p-9">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange-ink">Step {currentIndex + 1} of {STEPS.length}</p>
        {step === "details" && <DetailsStep values={{ name, preferredName, phone, classYear, major, college, uniqname, gradTerm }} setters={{ setName, setPreferredName, setPhone, setClassYear, setMajor, setCollege, setUniqname, setGradTerm }} email={email} errors={errors} />}
        {step === "responses" && <ResponsesStep questions={questions} answers={answers} setAnswers={setAnswers} errors={errors} />}
        {step === "materials" && <MaterialsStep linkedinUrl={linkedinUrl} setLinkedinUrl={setLinkedinUrl} accessibilityNotes={accessibilityNotes} setAccessibilityNotes={setAccessibilityNotes} uploadState={uploadState} resumePath={resumePath} uploadResume={uploadResume} error={errors.resume} />}
        {step === "review" && <ReviewStep values={{ name, preferredName, email, classYear, major, college, uniqname, gradTerm, linkedinUrl, accessibilityNotes }} questions={questions} answers={answers} resumeLabel={uploadState.kind === "uploaded" ? uploadState.label : "Resume uploaded"} consent={consent} setConsent={setConsent} submitState={submitState} submit={submit} setStep={setStep} />}

        {step !== "review" && <div className="mt-9 flex items-center justify-between gap-3 border-t border-mecg-navy/8 pt-6"><button type="button" onClick={() => setStep(STEPS[Math.max(0, currentIndex - 1)].id)} disabled={currentIndex === 0} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-mecg-navy/60 disabled:invisible">Back</button><button type="button" onClick={() => move(STEPS[currentIndex + 1].id)} className="min-h-12 rounded-xl bg-mecg-navy px-6 font-semibold text-white transition-transform active:scale-[0.96]">Save and continue</button></div>}
      </section>
    </div>
  );
}

function FieldError({ children }: { children?: string }) { return children ? <p className="mt-2 text-sm text-red-700" role="alert">{children}</p> : null; }

function DetailsStep({ values, setters, email, errors }: { values: Record<string, string>; setters: Record<string, (value: string) => void>; email: string; errors: Record<string, string> }) {
  return <><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">Start with the basics.</h2><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/55">These details stay separate from the anonymous first review of your written responses.</p><div className="mt-8 grid gap-5 sm:grid-cols-2">
    <label className={labelClass}>Full name <span className="text-mecg-orange-ink">*</span><input value={values.name} onChange={(e) => setters.setName(e.target.value)} autoComplete="name" className={fieldClass} aria-invalid={Boolean(errors.name)} /><FieldError>{errors.name}</FieldError></label>
    <label className={labelClass}>Preferred name <span className="font-normal text-mecg-navy/40">Optional</span><input value={values.preferredName} onChange={(e) => setters.setPreferredName(e.target.value)} autoComplete="nickname" className={fieldClass} /></label>
    <div className="sm:col-span-2"><p className={labelClass}>Verified email</p><div className="mt-2 flex min-h-12 items-center justify-between rounded-xl bg-mecg-blue/8 px-4 text-sm"><span>{email}</span><span className="font-semibold text-emerald-700">✓ Verified</span></div></div>
    <label className={labelClass}>Phone <span className="font-normal text-mecg-navy/40">Optional</span><input value={values.phone} onChange={(e) => setters.setPhone(e.target.value)} type="tel" autoComplete="tel" className={fieldClass} /></label>
    <label className={labelClass}>Uniqname <span className="text-mecg-orange-ink">*</span><input value={values.uniqname} onChange={(e) => setters.setUniqname(e.target.value.toLowerCase())} autoCapitalize="none" className={fieldClass} aria-invalid={Boolean(errors.uniqname)} /><FieldError>{errors.uniqname}</FieldError></label>
    <label className={labelClass}>Year <span className="text-mecg-orange-ink">*</span><select value={values.classYear} onChange={(e) => setters.setClassYear(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.classYear)}><option value="">Select year</option>{CLASS_YEARS.map((year) => <option key={year} value={year}>{CLASS_YEAR_LABELS[year]}</option>)}</select><FieldError>{errors.classYear}</FieldError></label>
    <label className={labelClass}>College <span className="text-mecg-orange-ink">*</span><select value={values.college} onChange={(e) => setters.setCollege(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.college)}><option value="">Select college</option>{COLLEGES.map((item) => <option key={item}>{item}</option>)}</select><FieldError>{errors.college}</FieldError></label>
    <label className={labelClass}>Major <span className="text-mecg-orange-ink">*</span><input value={values.major} onChange={(e) => setters.setMajor(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.major)} /><FieldError>{errors.major}</FieldError></label>
    <label className={labelClass}>Expected graduation <span className="font-normal text-mecg-navy/40">Optional</span><input value={values.gradTerm} onChange={(e) => setters.setGradTerm(e.target.value)} placeholder="Winter 2028" className={fieldClass} /></label>
  </div></>;
}

function ResponsesStep({ questions, answers, setAnswers, errors }: { questions: IntakeQuestion[]; answers: Record<string, string>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>; errors: Record<string, string> }) {
  return <><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">Tell us how you think.</h2><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/55">Be specific about your own actions. We care more about judgment and reflection than polished business language.</p><div className="mt-8 space-y-8">{questions.map((question, index) => { const value = answers[question.key] ?? ""; return <label key={question.key} className="block"><span className="flex gap-3"><span className="font-mono text-xs text-mecg-orange-ink">0{index + 1}</span><span className="text-lg font-semibold leading-7">{question.prompt}</span></span><textarea value={value} onChange={(e) => setAnswers((current) => ({ ...current, [question.key]: e.target.value }))} maxLength={2400} rows={7} className={`${fieldClass} min-h-44 py-4 leading-7`} aria-invalid={Boolean(errors[question.key])} /><span className="mt-2 flex justify-between text-xs text-mecg-navy/45"><span>{guidanceFor(question.key)}</span><span className="tabular-nums">{wordCount(value)} words</span></span><FieldError>{errors[question.key]}</FieldError></label>; })}</div></>;
}

function MaterialsStep({ linkedinUrl, setLinkedinUrl, accessibilityNotes, setAccessibilityNotes, uploadState, resumePath, uploadResume, error }: { linkedinUrl: string; setLinkedinUrl: (value: string) => void; accessibilityNotes: string; setAccessibilityNotes: (value: string) => void; uploadState: UploadState; resumePath: string; uploadResume: (file: File) => Promise<void>; error?: string }) {
  return <><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">Add your materials.</h2><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/55">Your resume is stored securely and is not included in anonymous first-pass review.</p><div className="mt-8 space-y-6">
    <label className="group block cursor-pointer rounded-2xl bg-mecg-navy/[0.035] p-6 text-center shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] transition-colors hover:bg-mecg-blue/8"><input type="file" accept="application/pdf" disabled={uploadState.kind === "uploading"} className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void uploadResume(file); }} /><span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm" aria-hidden="true">↑</span><span className="mt-4 block font-semibold">{uploadState.kind === "uploading" ? "Uploading and checking resume..." : resumePath ? "Replace your resume" : "Upload your resume"}</span><span className="mt-1 block text-sm text-mecg-navy/50">PDF only, up to 10 MB and 20 pages</span>{uploadState.kind === "uploaded" && <span className="mt-4 block rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ {uploadState.label}</span>}</label>
    {uploadState.kind === "uploading" && <p className="text-sm text-mecg-navy/55" role="status">Uploading and checking {uploadState.label}...</p>}{uploadState.kind === "uploaded" && <p className="text-sm text-emerald-800" role="status">Resume verified{uploadState.pageCount ? ` · ${uploadState.pageCount} ${uploadState.pageCount === 1 ? "page" : "pages"}` : ""}{uploadState.size ? ` · ${(uploadState.size / 1024 / 1024).toFixed(1)} MB` : ""}. {resumePath && <a className="font-semibold underline underline-offset-2" href={`/api/apply/resume?path=${encodeURIComponent(resumePath)}`} target="_blank" rel="noreferrer">View PDF</a>}</p>}{uploadState.kind === "error" && <FieldError>{uploadState.message}</FieldError>}<FieldError>{error}</FieldError>
    <label className={labelClass}>LinkedIn profile <span className="font-normal text-mecg-navy/40">Optional</span><input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} type="url" placeholder="https://linkedin.com/in/..." className={fieldClass} /></label>
    <label className={labelClass}>Scheduling or access needs <span className="font-normal text-mecg-navy/40">Optional and never scored</span><textarea value={accessibilityNotes} onChange={(e) => setAccessibilityNotes(e.target.value)} rows={4} className={`${fieldClass} py-3`} /><span className="mt-2 block text-xs font-normal leading-5 text-mecg-navy/45">Only the operations team uses this information to arrange an accessible recruitment process.</span></label>
  </div></>;
}

function ReviewStep({ values, questions, answers, resumeLabel, consent, setConsent, submitState, submit, setStep }: { values: Record<string, string>; questions: IntakeQuestion[]; answers: Record<string, string>; resumeLabel: string; consent: boolean; setConsent: (value: boolean) => void; submitState: SubmitState; submit: () => Promise<void>; setStep: (step: Step) => void }) {
  return <><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">Review before you submit.</h2><p className="mt-3 text-pretty leading-7 text-mecg-navy/55">You will not be able to edit this application after submission.</p><div className="mt-8 space-y-4">
    <ReviewCard title="About you" edit={() => setStep("details")}><p>{values.name}{values.preferredName ? ` · Goes by ${values.preferredName}` : ""}</p><p className="mt-1 text-mecg-navy/50">{values.email} · {values.uniqname} · {values.major}, {values.college}</p></ReviewCard>
    <ReviewCard title="Written responses" edit={() => setStep("responses")}><ul className="space-y-3">{questions.map((question) => <li key={question.key}><p className="font-medium">{question.prompt}</p><p className="mt-1 line-clamp-2 text-mecg-navy/55">{answers[question.key]}</p></li>)}</ul></ReviewCard>
    <ReviewCard title="Materials" edit={() => setStep("materials")}><p>✓ {resumeLabel}</p>{values.linkedinUrl && <p className="mt-1 text-mecg-navy/50">LinkedIn included</p>}</ReviewCard>
  </div><div className="mt-6 rounded-2xl bg-mecg-blue/8 p-5"><p className="font-semibold">How blind review works</p><p className="mt-2 text-sm leading-6 text-mecg-navy/60">First-pass reviewers receive redacted written responses. They do not receive your name, email, LinkedIn profile, resume, or access notes.</p></div>
  <label className="mt-6 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-mecg-orange" /><span className="text-sm leading-6">I reviewed my application and consent to MECG using this information to administer the current recruitment cycle.</span></label>
  {submitState.kind === "error" && <div className="mt-4"><FieldError>{submitState.message}</FieldError></div>}
  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => setStep("materials")} className="min-h-12 rounded-xl px-5 font-semibold text-mecg-navy/60">Back</button><button type="button" onClick={() => void submit()} disabled={!consent || submitState.kind === "submitting"} className="min-h-12 rounded-xl bg-mecg-orange px-7 font-semibold text-mecg-navy transition-transform active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45">{submitState.kind === "submitting" ? "Submitting application..." : "Submit application"}</button></div></>;
}

function ReviewCard({ title, edit, children }: { title: string; edit: () => void; children: React.ReactNode }) { return <section className="rounded-2xl bg-mecg-navy/[0.035] p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><button type="button" onClick={edit} className="min-h-10 px-2 text-sm font-semibold text-mecg-blue underline underline-offset-2">Edit</button></div><div className="mt-3 text-sm leading-6">{children}</div></section>; }
