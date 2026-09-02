"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearApplicationDraftRecovery,
  createApplicationDraftRecoveryScope,
  loadApplicationDraftRecovery,
  saveApplicationDraftRecovery,
} from "@/lib/application-draft-recovery";
import { uploadResumeFile } from "@/lib/resume-upload";
import { CLASS_YEAR_LABELS, CLASS_YEARS, COLLEGES, countWords, type ApplicationDraft } from "@/lib/workflow";

type IntakeQuestion = { key: string; prompt: string; inputType: string; required: boolean; options: string[]; maxWords: number | null };
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

// scroll-mb-24 keeps a focused field's ring clear of the sticky Back/Continue bar below `sm`
// (the bar itself is ~85px tall there); the bar is `sm:static` so no margin is needed at `sm`+.
const fieldClass = "mt-2 min-h-12 w-full scroll-mb-24 rounded-xl bg-white px-4 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16),0_1px_2px_rgba(7,13,31,0.04)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-navy),0_1px_2px_rgba(7,13,31,0.04)] sm:scroll-mb-0";
const labelClass = "block text-sm font-semibold text-mecg-navy";

function guidanceFor(question: IntakeQuestion) {
  return question.maxWords ? `${question.maxWords}-word limit` : "No word limit";
}

function answerId(key: string) {
  return `answer-${encodeURIComponent(key)}`;
}

function isHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

// Validation errors are announced by the describedby link when validate() focuses the field, so
// FieldError stays silent by default. `alert` is for the two errors nothing focuses: upload and submit.
function FieldError({ id, children, alert = false }: { id: string; children?: string; alert?: boolean }) {
  return children ? <p id={id} className="mt-2 text-sm text-red-700" role={alert ? "alert" : undefined}>{children}</p> : null;
}

export default function ApplicationForm({ initialName, email, userId, cycleOpen, cycleId, cycleName, questions, initialDraft }: {
  initialName: string;
  email: string;
  userId: string;
  cycleOpen: boolean;
  cycleId: string | null;
  cycleName: string | null;
  questions: IntakeQuestion[];
  initialDraft: ApplicationDraft | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");
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
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const restored = { ...(initialDraft?.answers ?? {}) };
    for (const question of questions) if (question.inputType === "select" && restored[question.key] && !question.options.includes(restored[question.key])) restored[question.key] = "";
    return restored;
  });
  const [resumePath, setResumePath] = useState(initialDraft?.resumeStoragePath ?? "");
  const [consent, setConsent] = useState(false);
  const [consentNotice, setConsentNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [draftDirty, setDraftDirty] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(initialDraft?.resumeStoragePath ? { kind: "uploaded", label: "Previously uploaded PDF" } : { kind: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const initialized = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveSequence = useRef(0);
  const uploadSequence = useRef(0);
  const stepChangeRequested = useRef(false);
  const recoveryInitialized = useRef(false);

  const draftPayload = useMemo(() => ({ name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumeStoragePath: resumePath, consent: false }), [name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumePath]);
  const recoveryScope = useMemo(() => cycleId ? createApplicationDraftRecoveryScope({
    userIdentity: userId,
    cycleIdentity: cycleId,
    questions,
  }) : null, [cycleId, questions, userId]);
  const recoveryDraft = useMemo(() => ({ name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers }), [name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers]);

  const cancelPendingSave = useCallback(() => {
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
  }, []);

  const saveDraft = useCallback((payload: typeof draftPayload, focusFailure = false) => {
    const sequence = ++saveSequence.current;
    setSaveState({ kind: "saving" });
    const operation = saveQueue.current.then(async () => {
      try {
        const response = await fetch("/api/apply/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) {
          if (response.status === 401) throw new Error("Your session expired. Sign in again to save your application.");
          throw new Error("We could not save your application. Please try again.");
        }
        if (sequence === saveSequence.current) {
          clearApplicationDraftRecovery(window.sessionStorage);
          setSaveState({ kind: "saved", label: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
          setDraftDirty(false);
        }
        return true;
      } catch (error) {
        if (sequence !== saveSequence.current) return false;
        setSaveState({ kind: "error", message: error instanceof Error ? error.message : "We could not save your application. Please try again." });
        if (focusFailure) window.requestAnimationFrame(() => document.getElementById("draft-save-error")?.focus());
        return false;
      }
    });
    saveQueue.current = operation.then(() => undefined);
    return operation;
  }, []);

  function markApplicationEdited() {
    saveSequence.current += 1;
    setDraftDirty(true);
    if (consent) {
      setConsent(false);
      setConsentNotice("Your consent was cleared because the application changed. Review the update, then check the box again.");
    }
  }

  function handleApplicationChange(event: React.FormEvent<HTMLElement>) {
    const target = event.target as HTMLInputElement;
    if (target.type !== "checkbox") markApplicationEdited();
  }

  useEffect(() => {
    if (!recoveryScope) {
      recoveryInitialized.current = true;
      return;
    }
    const recovered = loadApplicationDraftRecovery(window.sessionStorage, recoveryScope);
    recoveryInitialized.current = true;
    if (!recovered) return;
    const restoreTimer = window.setTimeout(() => {
      setName(recovered.name);
      setPreferredName(recovered.preferredName);
      setPhone(recovered.phone);
      setClassYear(CLASS_YEARS.includes(recovered.classYear as (typeof CLASS_YEARS)[number]) ? recovered.classYear : "");
      setMajor(recovered.major);
      setCollege(COLLEGES.includes(recovered.college as (typeof COLLEGES)[number]) ? recovered.college : "");
      setUniqname(recovered.uniqname);
      setGradTerm(recovered.gradTerm);
      setAccessibilityNotes(recovered.accessibilityNotes);
      setLinkedinUrl(recovered.linkedinUrl);
      setAnswers(Object.fromEntries(questions.map((question) => {
        const value = recovered.answers[question.key] ?? "";
        return [question.key, question.inputType === "select" && value && !question.options.includes(value) ? "" : value];
      })));
      setDraftDirty(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [questions, recoveryScope]);

  useEffect(() => {
    if (!cycleOpen || !draftDirty || !recoveryInitialized.current || !recoveryScope) return;
    saveApplicationDraftRecovery(window.sessionStorage, recoveryScope, recoveryDraft);
  }, [cycleOpen, draftDirty, recoveryDraft, recoveryScope]);

  useEffect(() => {
    if (!cycleOpen) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void saveDraft(draftPayload);
    }, 1200);
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    };
  }, [cycleOpen, draftPayload, saveDraft]);

  useEffect(() => () => cancelPendingSave(), [cancelPendingSave]);

  useEffect(() => {
    if (!cycleOpen || !draftDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [cycleOpen, draftDirty]);

  useEffect(() => {
    if (!stepChangeRequested.current) return;
    stepChangeRequested.current = false;
    const heading = document.getElementById("application-step-heading");
    heading?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [step]);

  function changeStep(next: Step) {
    if (next === step) return;
    setStepDirection(STEPS.findIndex((item) => item.id === next) > STEPS.findIndex((item) => item.id === step) ? "forward" : "back");
    stepChangeRequested.current = true;
    setStep(next);
  }

  async function uploadResume(file: File) {
    const sequence = ++uploadSequence.current;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setUploadState({ kind: "error", message: "Choose a PDF smaller than 10 MB." });
      return;
    }
    setUploadState({ kind: "uploading", label: file.name });
    try {
      const finalized = await uploadResumeFile(file);
      if (sequence !== uploadSequence.current) return;
      setResumePath(finalized.path);
      markApplicationEdited();
      setUploadState({ kind: "uploaded", label: finalized.filename ?? file.name, size: finalized.size, pageCount: finalized.pageCount });
      setErrors((current) => ({ ...current, resume: "" }));
    } catch (error) {
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
      for (const question of questions) {
        const answer = answers[question.key]?.trim() ?? "";
        if (question.required && !answer) next[question.key] = "Write a response before continuing.";
        else if (question.maxWords && countWords(answer) > question.maxWords) next[question.key] = `Shorten this response to ${question.maxWords} words or fewer.`;
        else if (question.inputType === "select" && answer && !question.options.includes(answer)) next[question.key] = "Select one of the available options.";
        else if (question.inputType === "url" && answer && !isHttpUrl(answer)) next[question.key] = "Enter a complete http or https URL.";
      }
    }
    if (target === "materials" && (uploadState.kind === "uploading" || !resumePath)) next.resume = uploadState.kind === "uploading" ? "Wait for your resume upload to finish." : "Upload your resume before continuing.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) window.requestAnimationFrame(() => document.getElementById(first === "resume" ? "resume" : questions.some((question) => question.key === first) ? answerId(first) : first)?.focus());
    return !first;
  }

  async function move(next: Step) {
    if (uploadState.kind === "uploading" || !validate(step)) return;
    cancelPendingSave();
    if (await saveDraft(draftPayload, true)) changeStep(next);
  }

  async function submit() {
    if (!consent || submitState.kind === "submitting" || uploadState.kind === "uploading") return;
    cancelPendingSave();
    setSubmitState({ kind: "submitting" });
    try {
      await saveQueue.current;
      const response = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draftPayload, consent: true }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The application could not be submitted.");
      }
      clearApplicationDraftRecovery(window.sessionStorage);
      router.replace("/applicant?submitted=1");
      router.refresh();
    } catch (error) {
      setSubmitState({ kind: "error", message: error instanceof Error ? error.message : "The application could not be submitted." });
    }
  }

  if (!cycleOpen) return <div className="mt-8 rounded-2xl bg-red-50 p-6 text-red-900"><p className="font-semibold">Applications are currently closed.</p><p className="mt-2 text-sm leading-6 text-red-800/80">Check the recruitment page for the next opening date, or email the MECG board if you expected to apply today.</p></div>;

  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const completed = (id: Step) => STEPS.findIndex((item) => item.id === id) < currentIndex;
  const saving = saveState.kind === "saving";
  const uploading = uploadState.kind === "uploading";

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,720px)] lg:items-start lg:gap-10">
      <aside className="order-2 hidden lg:order-1 lg:sticky lg:top-8 lg:block">
        <div className="rounded-2xl bg-mecg-navy p-5 text-white shadow-[0_18px_50px_rgba(7,13,31,0.16)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mecg-orange">{cycleName ?? "Current cycle"}</p>
          <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:block lg:space-y-2" aria-label="Application progress">
            {STEPS.map((item, index) => {
              const active = item.id === step;
              return <li key={item.id}><button type="button" onClick={() => index <= currentIndex && changeStep(item.id)} disabled={index > currentIndex || saving} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition-colors sm:flex-col sm:items-start sm:text-sm lg:flex-row lg:gap-3 ${active ? "bg-white/12 text-white" : completed(item.id) ? "text-white/80 hover:bg-white/8" : "cursor-default text-white/40"}`} aria-current={active ? "step" : undefined}><span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${active ? "bg-mecg-orange text-mecg-navy" : completed(item.id) ? "bg-white text-mecg-navy" : "bg-white/8"}`}>{completed(item.id) ? "✓" : index + 1}</span><span>{item.shortLabel}</span></button></li>;
            })}
          </ol>
          <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/70">
            {saveState.kind === "saving" && <p aria-hidden="true">Saving changes...</p>}
            {saveState.kind === "saved" && <p className="tabular-nums" role="status" aria-live="polite">Saved at {saveState.label}</p>}
            {saveState.kind === "error" && <div id="draft-save-error" className="text-red-200" role="alert" tabIndex={-1}><p>{saveState.message}</p><button type="button" onClick={() => void saveDraft(draftPayload, true)} disabled={saving} className="mt-2 min-h-11 font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">Retry save</button></div>}
            {saveState.kind === "idle" && <p>Your answers save automatically.</p>}
          </div>
        </div>
        <p className="mt-4 px-2 text-xs leading-5 text-mecg-navy/65">Need help? <a className="underline underline-offset-2" href="mailto:mecg-board@umich.edu">Email the recruitment team.</a></p>
      </aside>

      <section onChangeCapture={handleApplicationChange} className="surface-card order-1 min-w-0 bg-white p-6 sm:p-8 lg:order-2">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 rounded-t-[28px] border-b border-mecg-navy/8 bg-white/95 px-6 pb-4 pt-5 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-orange-ink">Step {currentIndex + 1} of {STEPS.length}</p>
            <p className="text-xs font-semibold text-mecg-navy/65" aria-live="polite">
              {saveState.kind === "saving" ? "Saving…" : saveState.kind === "saved" ? "Saved" : saveState.kind === "error" ? "Save failed" : STEPS[currentIndex].label}
            </p>
          </div>
          <div className="progress-track mt-3" aria-hidden="true">
            <div className="progress-fill" style={{ transform: `scaleX(${(currentIndex + 1) / STEPS.length})` }} />
          </div>
        </div>

        <div key={step} className="step-seat" data-direction={stepDirection}>
          <p className="hidden font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange-ink lg:block">Step {currentIndex + 1} of {STEPS.length}</p>
          {step === "details" && <DetailsStep values={{ name, preferredName, phone, classYear, major, college, uniqname, gradTerm }} setters={{ setName, setPreferredName, setPhone, setClassYear, setMajor, setCollege, setUniqname, setGradTerm }} email={email} errors={errors} />}
          {step === "responses" && <ResponsesStep questions={questions} answers={answers} setAnswers={setAnswers} errors={errors} />}
          {step === "materials" && <MaterialsStep linkedinUrl={linkedinUrl} setLinkedinUrl={setLinkedinUrl} accessibilityNotes={accessibilityNotes} setAccessibilityNotes={setAccessibilityNotes} uploadState={uploadState} resumePath={resumePath} uploadResume={uploadResume} error={errors.resume} />}
          {step === "review" && <ReviewStep values={{ name, preferredName, email, phone, classYear, major, college, uniqname, gradTerm, linkedinUrl, accessibilityNotes }} questions={questions} answers={answers} resumeLabel={uploadState.kind === "uploaded" ? uploadState.label : "Resume uploaded"} consent={consent} consentNotice={consentNotice} setConsent={(value) => { setConsent(value); if (value) setConsentNotice(""); }} submitState={submitState} submit={submit} changeStep={changeStep} uploading={uploading} />}
        </div>

        {step !== "review" && <div className="sticky bottom-0 z-10 -mx-6 mt-7 flex items-center justify-between gap-3 border-t border-mecg-navy/8 bg-white/95 px-6 pb-4 pt-5 backdrop-blur sm:static sm:mx-0 sm:px-0 sm:pb-0"><button type="button" onClick={() => changeStep(STEPS[Math.max(0, currentIndex - 1)].id)} disabled={currentIndex === 0 || saving} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-mecg-navy/65 disabled:invisible">Back</button><button type="button" onClick={() => void move(STEPS[currentIndex + 1].id)} disabled={saving || uploading} aria-busy={saving || uploading} className="button-dark flex-1 bg-mecg-navy sm:flex-none">{uploading ? "Uploading resume..." : saving ? "Saving..." : "Save and continue"}</button></div>}
      </section>
    </div>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 id="application-step-heading" tabIndex={-1} className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] outline-none">{children}</h2>;
}

function DetailsStep({ values, setters, email, errors }: { values: Record<string, string>; setters: Record<string, (value: string) => void>; email: string; errors: Record<string, string> }) {
  const describedBy = (key: string) => errors[key] ? `${key}-error` : undefined;
  return <><StepHeading>Start with the basics.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/60">These details stay separate from the anonymous first review of your written responses.</p><div className="mt-8 grid gap-5 sm:grid-cols-2">
    <div className={labelClass}><label htmlFor="name">Full name <span className="text-mecg-orange-ink">(required)</span></label><input id="name" value={values.name} onChange={(e) => setters.setName(e.target.value)} autoComplete="name" required className={fieldClass} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} /><FieldError id="name-error">{errors.name}</FieldError></div>
    <label htmlFor="preferredName" className={labelClass}>Preferred name <span className="font-normal text-mecg-navy/60">Optional</span><input id="preferredName" value={values.preferredName} onChange={(e) => setters.setPreferredName(e.target.value)} autoComplete="nickname" className={fieldClass} /></label>
    <div className="sm:col-span-2"><p className={labelClass}>Verified email</p><div className="mt-2 flex min-h-12 items-center justify-between rounded-xl bg-mecg-blue/8 px-4 text-sm"><span>{email}</span><span className="font-semibold text-emerald-700">✓ Verified</span></div></div>
    <label htmlFor="phone" className={labelClass}>Phone <span className="font-normal text-mecg-navy/60">Optional</span><input id="phone" value={values.phone} onChange={(e) => setters.setPhone(e.target.value)} type="tel" autoComplete="tel" className={fieldClass} /></label>
    <div className={labelClass}><label htmlFor="uniqname">Uniqname <span className="text-mecg-orange-ink">(required)</span></label><input id="uniqname" value={values.uniqname} onChange={(e) => setters.setUniqname(e.target.value.toLowerCase())} autoCapitalize="none" required className={fieldClass} aria-invalid={Boolean(errors.uniqname)} aria-describedby={describedBy("uniqname")} /><FieldError id="uniqname-error">{errors.uniqname}</FieldError></div>
    <div className={labelClass}><label htmlFor="classYear">Year <span className="text-mecg-orange-ink">(required)</span></label><select id="classYear" value={values.classYear} onChange={(e) => setters.setClassYear(e.target.value)} required className={fieldClass} aria-invalid={Boolean(errors.classYear)} aria-describedby={describedBy("classYear")}><option value="">Select year</option>{CLASS_YEARS.map((year) => <option key={year} value={year}>{CLASS_YEAR_LABELS[year]}</option>)}</select><FieldError id="classYear-error">{errors.classYear}</FieldError></div>
    <div className={labelClass}><label htmlFor="college">College <span className="text-mecg-orange-ink">(required)</span></label><select id="college" value={values.college} onChange={(e) => setters.setCollege(e.target.value)} required className={fieldClass} aria-invalid={Boolean(errors.college)} aria-describedby={describedBy("college")}><option value="">Select college</option>{COLLEGES.map((item) => <option key={item}>{item}</option>)}</select><FieldError id="college-error">{errors.college}</FieldError></div>
    <div className={labelClass}><label htmlFor="major">Major <span className="text-mecg-orange-ink">(required)</span></label><input id="major" value={values.major} onChange={(e) => setters.setMajor(e.target.value)} required className={fieldClass} aria-invalid={Boolean(errors.major)} aria-describedby={describedBy("major")} /><FieldError id="major-error">{errors.major}</FieldError></div>
    <label htmlFor="gradTerm" className={labelClass}>Expected graduation <span className="font-normal text-mecg-navy/60">Optional</span><input id="gradTerm" value={values.gradTerm} onChange={(e) => setters.setGradTerm(e.target.value)} placeholder="Winter 2028" className={fieldClass} /></label>
  </div></>;
}

function ResponsesStep({ questions, answers, setAnswers, errors }: { questions: IntakeQuestion[]; answers: Record<string, string>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>; errors: Record<string, string> }) {
  return <><StepHeading>Tell us how you think.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/60">Be specific about your own actions. We care more about judgment and reflection than polished business language.</p><div className="mt-6 space-y-6">{questions.map((question, index) => {
    const value = answers[question.key] ?? "";
    const id = answerId(question.key);
    const guidanceId = `${id}-guidance`;
    const errorId = `${id}-error`;
    const describedBy = errors[question.key] ? `${guidanceId} ${errorId}` : guidanceId;
    const common = { id, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setAnswers((current) => ({ ...current, [question.key]: event.target.value })), required: question.required, "aria-invalid": Boolean(errors[question.key]), "aria-describedby": describedBy };
    let control: React.ReactNode;
    if (question.inputType === "short_text") control = <input {...common} type="text" maxLength={2400} className={fieldClass} />;
    else if (question.inputType === "url") control = <input {...common} type="url" maxLength={2400} className={fieldClass} />;
    else if (question.inputType === "select") control = <select {...common} className={fieldClass}><option value="">Select an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    else control = <textarea {...common} maxLength={8000} rows={5} className={`${fieldClass} min-h-32 py-3 leading-6`} />;
    const words = countWords(value);
    return <div key={question.key}><label htmlFor={id} className="flex gap-3"><span className="font-mono text-xs text-mecg-orange-ink">{String(index + 1).padStart(2, "0")}</span><span className="text-lg font-semibold leading-6">{question.prompt}{question.required && <span className="ml-2 text-sm text-mecg-orange-ink">(required)</span>}</span></label>{control}<span id={guidanceId} className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-mecg-navy/65"><span>{guidanceFor(question)}</span><span className={`tabular-nums ${question.maxWords && words > question.maxWords ? "font-semibold text-red-700" : ""}`}>{question.maxWords ? `${words} / ${question.maxWords} words` : `${words} words`} · {8000 - value.length} characters remaining</span></span><FieldError id={errorId}>{errors[question.key]}</FieldError></div>;
  })}</div></>;
}

function MaterialsStep({ linkedinUrl, setLinkedinUrl, accessibilityNotes, setAccessibilityNotes, uploadState, resumePath, uploadResume, error }: { linkedinUrl: string; setLinkedinUrl: (value: string) => void; accessibilityNotes: string; setAccessibilityNotes: (value: string) => void; uploadState: UploadState; resumePath: string; uploadResume: (file: File) => Promise<void>; error?: string }) {
  const resumeDescription = ["resume-guidance", error ? "resume-error" : "", uploadState.kind === "error" ? "resume-upload-error" : ""].filter(Boolean).join(" ");
  return <><StepHeading>Add your materials.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-mecg-navy/60">Your resume is stored securely and is not included in anonymous first-pass review.</p><div className="mt-8 space-y-6">
    <label htmlFor="resume" className="group block cursor-pointer rounded-2xl bg-mecg-navy/[0.035] p-6 text-center shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] outline-none transition-colors hover:bg-mecg-blue/8 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-mecg-navy"><input id="resume" type="file" accept="application/pdf" required={!resumePath} disabled={uploadState.kind === "uploading"} className="sr-only" aria-invalid={Boolean(error || uploadState.kind === "error")} aria-describedby={resumeDescription} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void uploadResume(file); }} /><span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm" aria-hidden="true">↑</span><span className="mt-4 block font-semibold">{uploadState.kind === "uploading" ? "Uploading resume..." : resumePath ? "Replace your resume" : "Upload your resume (required)"}</span><span id="resume-guidance" className="mt-1 block text-sm text-mecg-navy/65">PDF only, up to 10 MB</span>{uploadState.kind === "uploaded" && <span className="mt-4 block rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ {uploadState.label}</span>}</label>
    {uploadState.kind === "uploading" && <p className="text-sm text-mecg-navy/65" role="status" aria-live="polite">Uploading and checking {uploadState.label}...</p>}{uploadState.kind === "uploaded" && <p className="text-sm text-emerald-800" role="status" aria-live="polite">Resume verified{uploadState.pageCount ? ` · ${uploadState.pageCount} ${uploadState.pageCount === 1 ? "page" : "pages"}` : ""}{uploadState.size ? ` · ${(uploadState.size / 1024 / 1024).toFixed(1)} MB` : ""}. {resumePath && <a className="font-semibold underline underline-offset-2" href={`/api/apply/resume?path=${encodeURIComponent(resumePath)}`} target="_blank" rel="noreferrer">View PDF</a>}</p>}{uploadState.kind === "error" && <FieldError id="resume-upload-error" alert>{uploadState.message}</FieldError>}<FieldError id="resume-error">{error}</FieldError>
    <label htmlFor="linkedinUrl" className={labelClass}>LinkedIn profile <span className="font-normal text-mecg-navy/60">Optional</span><input id="linkedinUrl" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} type="url" placeholder="https://linkedin.com/in/..." className={fieldClass} /></label>
    <label htmlFor="accessibilityNotes" className={labelClass}>Scheduling or access needs <span className="font-normal text-mecg-navy/60">Optional and never scored</span><textarea id="accessibilityNotes" value={accessibilityNotes} onChange={(e) => setAccessibilityNotes(e.target.value)} rows={4} className={`${fieldClass} py-3`} aria-describedby="accessibilityNotes-guidance" /><span id="accessibilityNotes-guidance" className="mt-2 block text-xs font-normal leading-5 text-mecg-navy/65">Only the operations team uses this information to arrange an accessible recruitment process.</span></label>
  </div></>;
}

function ReviewStep({ values, questions, answers, resumeLabel, consent, consentNotice, setConsent, submitState, submit, changeStep, uploading }: { values: Record<string, string>; questions: IntakeQuestion[]; answers: Record<string, string>; resumeLabel: string; consent: boolean; consentNotice: string; setConsent: (value: boolean) => void; submitState: SubmitState; submit: () => Promise<void>; changeStep: (step: Step) => void; uploading: boolean }) {
  const classYearLabel = CLASS_YEARS.includes(values.classYear as (typeof CLASS_YEARS)[number]) ? CLASS_YEAR_LABELS[values.classYear as (typeof CLASS_YEARS)[number]] : values.classYear;
  return <><StepHeading>Review before you submit.</StepHeading><p className="mt-3 text-pretty leading-7 text-mecg-navy/60">You will not be able to edit this application after submission.</p><div className="mt-8 space-y-4">
    <ReviewCard title="About you" edit={() => changeStep("details")}><dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2"><ReviewItem label="Full name" value={values.name} /><ReviewItem label="Preferred name" value={values.preferredName} /><ReviewItem label="Email" value={values.email} /><ReviewItem label="Phone" value={values.phone} /><ReviewItem label="Uniqname" value={values.uniqname} /><ReviewItem label="Class year" value={classYearLabel} /><ReviewItem label="College" value={values.college} /><ReviewItem label="Major" value={values.major} /><ReviewItem label="Expected graduation" value={values.gradTerm} /></dl></ReviewCard>
    <ReviewCard title="Written responses" edit={() => changeStep("responses")}><ul className="space-y-4">{questions.map((question) => <li key={question.key}><p className="font-medium">{question.prompt}</p><p className="mt-1 whitespace-pre-wrap break-words text-mecg-navy/70">{answers[question.key] || "Not provided"}</p></li>)}</ul></ReviewCard>
    <ReviewCard title="Materials and access" edit={() => changeStep("materials")}><dl className="space-y-3"><ReviewItem label="Resume" value={resumeLabel} /><ReviewItem label="LinkedIn URL" value={values.linkedinUrl} /><ReviewItem label="Scheduling or access needs" value={values.accessibilityNotes} preserveWhitespace /></dl></ReviewCard>
  </div><div className="mt-6 rounded-2xl bg-mecg-blue/8 p-5"><p className="font-semibold">How blind review works</p><p className="mt-2 text-sm leading-6 text-mecg-navy/65">First-pass reviewers receive redacted written responses. They do not receive your name, email, LinkedIn profile, resume, or access notes.</p></div>
  <label className="mt-6 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-mecg-orange" /><span className="text-sm leading-6">I reviewed my application and consent to MECG using this information to administer the current recruitment cycle.</span></label>
  {consentNotice && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{consentNotice}</p>}
  {submitState.kind === "error" && <div className="mt-4"><FieldError id="submit-error" alert>{submitState.message}</FieldError></div>}
  <p className="sr-only" role="status" aria-live="polite">{submitState.kind === "submitting" ? "Submitting your application. Please wait." : ""}</p>
  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => changeStep("materials")} className="min-h-12 rounded-xl px-5 font-semibold text-mecg-navy/65">Back</button><button type="button" onClick={() => void submit()} disabled={!consent || submitState.kind === "submitting" || uploading} aria-busy={submitState.kind === "submitting"} className="button-primary">{submitState.kind === "submitting" ? "Submitting application..." : "Submit application"}</button></div></>;
}

function ReviewItem({ label, value, preserveWhitespace = false }: { label: string; value: string; preserveWhitespace?: boolean }) {
  return <div><dt className="font-medium text-mecg-navy">{label}</dt><dd className={`mt-0.5 break-words text-mecg-navy/70 ${preserveWhitespace ? "whitespace-pre-wrap" : ""}`}>{value || "Not provided"}</dd></div>;
}

function ReviewCard({ title, edit, children }: { title: string; edit: () => void; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-mecg-navy/[0.035] p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><button type="button" onClick={edit} className="min-h-10 px-2 text-sm font-semibold text-mecg-blue underline underline-offset-2">Edit</button></div><div className="mt-3 text-sm leading-6">{children}</div></section>;
}
