"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearApplicationDraftRecovery,
  createApplicationDraftRecoveryScope,
  loadApplicationDraftRecoverySnapshot,
  saveApplicationDraftRecovery,
  type ApplicationDraftRecovery,
} from "@/lib/application-draft-recovery";
import { parseApplicationSubmissionReceipt } from "@/lib/application-submission";
import { fetchJsonWithTimeout, reconcileSubmittedApplication, RequestTimeoutError } from "@/lib/client-fetch";
import { uploadResumeFile } from "@/lib/resume-upload";
import GradTermPicker from "@/components/grad-term-picker";
import { APPLICATION_FIELD_LIMITS, CLASS_YEAR_LABELS, CLASS_YEARS, COLLEGES, countWords } from "@/lib/workflow";
import { applicationStepErrors, blurFieldError, stepForField, type IntakeQuestion } from "./application-validation";
import {
  clearApplicationStepRecovery,
  parseApplicationDraftSaveResult,
  type ApplicationDraftSaveRequest,
  type ApplicationDraftSnapshot,
  loadApplicationStepRecovery,
  saveApplicationStepRecovery,
  type ApplicationServerDraft,
  type ApplicationStep,
} from "./application-server-draft";
import HeadshotField from "./headshot-field";
import { resumeDrop } from "./resume-drop";
import ApplicationRecoveryReview, { APPLICATION_RECOVERY_FIELDS as RECOVERY_FIELDS } from "./application-recovery-review";

type Step = ApplicationStep;
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; label: string } | { kind: "error"; message: string };
type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; label: string }
  | { kind: "uploaded"; label: string; size?: number; pageCount?: number }
  | { kind: "error"; message: string };
type SubmitState = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string };
type RecoveryDecision = { kind: "checking" } | { kind: "ready" } | { kind: "choice"; draft: ApplicationDraftRecovery; step: Step };
type PendingSave = { payload: ApplicationServerDraft; sequence: number; focusFailure: boolean };


const DRAFT_TIMEOUT_MS = 10_000;
const SUBMIT_TIMEOUT_MS = 15_000;

const STEPS: { id: Step; label: string; shortLabel: string }[] = [
  { id: "details", label: "About you", shortLabel: "Details" },
  { id: "responses", label: "Written responses", shortLabel: "Responses" },
  { id: "materials", label: "Materials and access", shortLabel: "Materials" },
  { id: "review", label: "Review and submit", shortLabel: "Review" },
];

// scroll-mb-24 keeps a focused field's ring clear of the sticky Back/Continue bar below `sm`
// (the bar itself is ~85px tall there); the bar is `sm:static` so no margin is needed at `sm`+.
const fieldClass = "application-field mt-2 min-h-12 w-full scroll-mb-24 rounded-xl bg-white px-4 text-mecg-navy inset-ring inset-ring-line-strong shadow-xs outline-none transition-shadow focus:inset-ring-2 focus:inset-ring-mecg-navy sm:scroll-mb-0";
const selectClass = "select-control mt-2 scroll-mb-24 sm:scroll-mb-0";
const labelClass = "block text-sm font-semibold text-mecg-navy";

// Accessing sessionStorage itself can throw in browsers with storage disabled.
function applicationRecoveryStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

function guidanceFor(question: IntakeQuestion) {
  return question.maxWords ? `${question.maxWords}-word limit` : "No word limit";
}

function answerId(key: string) {
  return `answer-${encodeURIComponent(key)}`;
}

// Validation errors are announced by the describedby link when validate() focuses the field, so
// FieldError stays silent by default. `alert` is for the two errors nothing focuses: upload and submit.
function FieldError({ id, children, alert = false }: { id: string; children?: string; alert?: boolean }) {
  return children ? <p id={id} className="mt-2 text-sm text-danger" role={alert ? "alert" : undefined}>{children}</p> : null;
}

export default function ApplicationForm({ initialName, email, userId, cycleOpen, preOpenLabel, cycleId, cycleName, questions, initialDraft, initialRevision = null, initialHasHeadshot = false, headshotSupported = true, gradBaseYear }: {
  initialName: string;
  email: string;
  userId: string;
  cycleOpen: boolean;
  preOpenLabel: string | null;
  cycleId: string | null;
  cycleName: string | null;
  questions: IntakeQuestion[];
  initialDraft: ApplicationServerDraft | null;
  initialRevision?: string | null;
  initialHasHeadshot?: boolean;
  headshotSupported?: boolean;
  gradBaseYear: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialDraft?.currentStep ?? "details");
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
    return Object.fromEntries(questions.map((question) => {
      const value = initialDraft?.answers[question.key] ?? "";
      return [question.key, question.inputType === "select" && value && !question.options.includes(value) ? "" : value];
    }));
  });
  const [resumePath, setResumePath] = useState(initialDraft?.resumeStoragePath ?? "");
  // The photo lives outside the draft row (its own RPC), so it is a boolean here, not a path.
  const [headshotReady, setHeadshotReadyState] = useState(initialHasHeadshot);
  const [headshotUploading, setHeadshotUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentNotice, setConsentNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Set when the applicant leaves Review for an earlier step, so that step's primary
  // action returns straight to Review instead of walking through every later step.
  const [returnToReview, setReturnToReview] = useState(false);
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const mobileStepsRef = useRef<HTMLDivElement>(null);
  const mobileStepsToggleRef = useRef<HTMLButtonElement>(null);
  // Clear the "upload a photo" error as soon as one lands, the way uploadResume
  // does for the resume. Otherwise the success state and the error render together.
  const setHeadshotReady = useCallback((ready: boolean) => {
    setHeadshotReadyState(ready);
    if (ready) setErrors((current) => ({ ...current, headshot: "" }));
  }, []);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [draftDirty, setDraftDirty] = useState(false);
  const [localRecovery, setLocalRecovery] = useState<"pending" | "saved" | "unavailable">("pending");
  const [recoveredNotice, setRecoveredNotice] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(initialDraft?.resumeStoragePath ? { kind: "uploaded", label: "Previously uploaded PDF" } : { kind: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const [recoveryDecision, setRecoveryDecision] = useState<RecoveryDecision>({ kind: "checking" });
  const submissionInFlight = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const pendingSave = useRef<PendingSave | null>(null);
  const saveSequence = useRef(0);
  const revision = useRef(initialRevision);
  const uncertainSave = useRef<(PendingSave & { request: ApplicationDraftSaveRequest }) | null>(null);
  const conflictRef = useRef(false);
  const [conflict, setConflict] = useState<{ local: ApplicationServerDraft; server: ApplicationDraftSnapshot | null } | null>(null);
  const uploadSequence = useRef(0);
  const stepChangeRequested = useRef(false);
  const recoveryInitialized = useRef(false);
  const pendingValidationFocus = useRef<string | null>(null);
  const pendingRecoveryFocus = useRef(false);

  const draftPayload = useMemo(() => ({ name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumeStoragePath: resumePath, currentStep: step, consent: false }), [name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers, resumePath, step]);
  const recoveryScope = useMemo(() => cycleId ? createApplicationDraftRecoveryScope({
    userIdentity: userId,
    cycleIdentity: cycleId,
    questions,
  }) : null, [cycleId, questions, userId]);
  const recoveryDraft = useMemo(() => ({ name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers }), [name, preferredName, phone, classYear, major, college, uniqname, gradTerm, accessibilityNotes, linkedinUrl, answers]);

  const [initialRecoveryDraft] = useState(recoveryDraft);
  const latestDraft = useRef(draftPayload);
  useLayoutEffect(() => { latestDraft.current = draftPayload; }, [draftPayload]);

  const cancelPendingSave = useCallback(() => {
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
  }, []);

  const runQueuedSave = useCallback(async function drainSaveQueue() {
    if (saveInFlight.current || submissionInFlight.current || conflictRef.current) return;
    const queued = uncertainSave.current ?? pendingSave.current;
    if (!queued || !cycleId) return;
    if (!uncertainSave.current) pendingSave.current = null;
    const request = uncertainSave.current ?? {
      ...queued,
      request: { draft: queued.payload, expectedRevision: revision.current, mutationId: crypto.randomUUID(), cycleId },
    };
    uncertainSave.current = request;
    saveInFlight.current = true;
    const { sequence, focusFailure } = request;
    let succeeded = false;
    try {
      const { response, body } = await fetchJsonWithTimeout("/api/apply/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.request) }, DRAFT_TIMEOUT_MS);
      const result = parseApplicationDraftSaveResult(body);
      if (response.status === 409 && result?.kind === "conflict") {
        conflictRef.current = true;
        uncertainSave.current = null;
        cancelPendingSave();
        setConflict({ local: latestDraft.current, server: result.snapshot });
        pendingSave.current = null;
        setSaveState({ kind: "idle" });
        return;
      }
      if (!response.ok || result?.kind !== "saved") {
        // A definitive client rejection did not commit. Let corrected edits
        // replace that request; only uncertain outcomes retain its retry id.
        if (!response.ok && response.status < 500 && response.status !== 408) uncertainSave.current = null;
        if (response.status === 401) throw new Error("Your session expired. Sign in again to save your application.");
        throw new Error("We could not save your application. Please try again.");
      }
      revision.current = result.revision;
      uncertainSave.current = null;
      succeeded = true;
      if (sequence === saveSequence.current && !submissionInFlight.current) {
        setSaveState({ kind: "saved", label: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
        setDraftDirty(false);
        const storage = applicationRecoveryStorage();
        if (recoveryScope && storage) clearApplicationDraftRecovery(storage);
      }
    } catch (error) {
      // Preserve the exact mutation on uncertain outcomes. Its retry must be
      // acknowledged before a later edit can use the returned next revision.
      const message = error instanceof RequestTimeoutError
        ? "Saving took too long. Keep this page open and retry when your connection is stable."
        : error instanceof TypeError ? "We could not save your application. Check your connection and retry."
        : error instanceof Error ? error.message : "We could not save your application. Please try again.";
      setSaveState({ kind: "error", message });
      if (focusFailure) window.requestAnimationFrame(() => document.getElementById("draft-save-error")?.focus());
    } finally {
      saveInFlight.current = false;
      if (succeeded && pendingSave.current) void drainSaveQueue();
    }
  }, [cancelPendingSave, cycleId, recoveryScope]);

  const saveDraft = useCallback((payload: typeof draftPayload, focusFailure = false) => {
    if (!recoveryInitialized.current || submissionInFlight.current || conflictRef.current) return;
    const sequence = ++saveSequence.current;
    pendingSave.current = { payload, sequence, focusFailure };
    setSaveState({ kind: "saving" });
    void runQueuedSave();
  }, [runQueuedSave]);

  function markApplicationEdited() {
    saveSequence.current += 1;
    setDraftDirty(true);
    setSaveState({ kind: "idle" });
    if (consent) {
      setConsent(false);
      setConsentNotice("Your consent was cleared because the application changed. Review the update, then check the box again.");
    }
  }

  function clearFieldError(element: EventTarget) {
    if (!(element instanceof HTMLElement) || !element.id) return;
    setErrors((current) => {
      const key = Object.keys(current).find((candidate) => current[candidate] && fieldId(candidate) === element.id);
      return key ? { ...current, [key]: "" } : current;
    });
  }

  function handleApplicationChange(event: React.FormEvent<HTMLElement>) {
    const target = event.target;
    clearFieldError(target);
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") markApplicationEdited();
  }

  function handleApplicationBlur(event: React.FocusEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.id) return;
    const key = target.id === "uniqname" || target.id === "phone" || target.id === "linkedinUrl"
      ? target.id
      : questions.find((question) => answerId(question.key) === target.id)?.key;
    if (!key) return;
    const message = blurFieldError(key, target.value, validationInput);
    if (message !== null) setErrors((current) => current[key] === message ? current : { ...current, [key]: message });
  }

  useEffect(() => {
    // A refreshed server render can supply equivalent question objects. Once the
    // applicant has chosen a copy, that rerender must not reopen the choice.
    if (recoveryInitialized.current) return;
    const storage = applicationRecoveryStorage();
    const snapshot = storage && recoveryScope ? loadApplicationDraftRecoverySnapshot(storage, recoveryScope) : null;
    const recoveredStep = storage && recoveryScope ? loadApplicationStepRecovery(storage, recoveryScope) : null;
    const recovered = snapshot?.draft;
    const saved = initialRecoveryDraft;
    // Compare values, not timestamps: a browser copy can predate another device's save.
    const differs = recovered && (RECOVERY_FIELDS.some(({ key }) => recovered[key] !== saved[key])
      || questions.some(({ key }) => (recovered.answers[key] ?? "") !== (saved.answers[key] ?? "")));
    const timer = window.setTimeout(() => {
      if (recovered && differs) {
        setRecoveryDecision({ kind: "choice", draft: recovered, step: recoveredStep ?? "details" });
      } else {
        recoveryInitialized.current = true;
        setRecoveryDecision({ kind: "ready" });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialRecoveryDraft, questions, recoveryScope]);

  useEffect(() => {
    if (recoveryDecision.kind === "choice") document.getElementById("recovery-choice-heading")?.focus();
  }, [recoveryDecision]);

  function chooseRecovery(useBrowser: boolean, combined?: ApplicationDraftRecovery) {
    if (recoveryDecision.kind !== "choice") return;
    if (useBrowser) {
      const recovered = combined ?? recoveryDecision.draft;
      setName(recovered.name);
      setPreferredName(recovered.preferredName);
      setPhone(recovered.phone);
      setClassYear(CLASS_YEARS.some((value) => value === recovered.classYear) ? recovered.classYear : "");
      setMajor(recovered.major);
      setCollege(COLLEGES.some((value) => value === recovered.college) ? recovered.college : "");
      setUniqname(recovered.uniqname);
      setGradTerm(recovered.gradTerm);
      setAccessibilityNotes(recovered.accessibilityNotes);
      setLinkedinUrl(recovered.linkedinUrl);
      setAnswers(Object.fromEntries(questions.map((question) => {
        const value = recovered.answers[question.key] ?? "";
        return [question.key, question.inputType === "select" && value && !question.options.includes(value) ? "" : value];
      })));
      setStep(recoveryDecision.step);
      setRecoveredNotice(true);
      markApplicationEdited();
    } else {
      const storage = applicationRecoveryStorage();
      if (storage) {
        clearApplicationDraftRecovery(storage);
        clearApplicationStepRecovery(storage);
      }
    }
    recoveryInitialized.current = true;
    setRecoveryDecision({ kind: "ready" });
    pendingRecoveryFocus.current = true;
  }

  useEffect(() => {
    if (!cycleOpen || !draftDirty || !recoveryInitialized.current || recoveryDecision.kind !== "ready" || !recoveryScope) return;
    const storage = applicationRecoveryStorage();
    const saved = storage && saveApplicationDraftRecovery(storage, recoveryScope, recoveryDraft);
    // Defer the display update; storing the actual recovery copy stays synchronous.
    const timer = window.setTimeout(() => setLocalRecovery(saved ? "saved" : "unavailable"), 0);
    return () => window.clearTimeout(timer);
  }, [cycleOpen, draftDirty, recoveryDecision.kind, recoveryDraft, recoveryScope]);

  useEffect(() => {
    if (!cycleOpen || !recoveryInitialized.current || recoveryDecision.kind !== "ready" || !recoveryScope) return;
    const storage = applicationRecoveryStorage();
    if (storage) saveApplicationStepRecovery(storage, recoveryScope, step);
  }, [cycleOpen, recoveryDecision.kind, recoveryScope, step]);

  useEffect(() => {
    if (!cycleOpen || !draftDirty || recoveryDecision.kind !== "ready" || submissionInFlight.current || conflict) return;
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void saveDraft(draftPayload);
    }, 1_500);
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    };
  }, [cycleOpen, draftDirty, recoveryDecision.kind, draftPayload, saveDraft, conflict]);

  useEffect(() => () => cancelPendingSave(), [cancelPendingSave]);

  useEffect(() => {
    if (!cycleOpen || !draftDirty) return;
    const retryOnReconnect = () => {
      cancelPendingSave();
      saveDraft(draftPayload);
    };
    window.addEventListener("online", retryOnReconnect);
    return () => window.removeEventListener("online", retryOnReconnect);
  }, [cancelPendingSave, cycleOpen, draftDirty, draftPayload, saveDraft, conflict]);

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
    const validationTarget = pendingValidationFocus.current;
    if (validationTarget) {
      pendingValidationFocus.current = null;
      window.requestAnimationFrame(() => document.getElementById(validationTarget)?.focus());
      return;
    }
    const heading = document.getElementById("application-step-heading");
    heading?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [step]);

  useEffect(() => {
    if (!mobileStepsOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileStepsOpen(false);
      mobileStepsToggleRef.current?.focus();
    }
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !mobileStepsRef.current?.contains(event.target)) setMobileStepsOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [mobileStepsOpen]);

  function changeStep(next: Step) {
    if (next === step || submissionInFlight.current) return;
    setReturnToReview(next !== "review" && (step === "review" || returnToReview));
    setMobileStepsOpen(false);
    setStepDirection(STEPS.findIndex((item) => item.id === next) > STEPS.findIndex((item) => item.id === step) ? "forward" : "back");
    stepChangeRequested.current = true;
    saveSequence.current += 1;
    setDraftDirty(true);
    setSaveState((current) => current.kind === "error" ? current : { kind: "idle" });
    setStep(next);
  }

  async function uploadResume(file: File) {
    const sequence = ++uploadSequence.current;
    const looksLikePdf = file.type === "application/pdf" || (!file.type && file.name.toLowerCase().endsWith(".pdf"));
    if (!looksLikePdf || file.size > 10 * 1024 * 1024) {
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

  const validationInput = { name, preferredName, phone, classYear, major, college, uniqname, gradTerm, linkedinUrl, accessibilityNotes, answers, questions, resumePath, resumeUploading: uploadState.kind === "uploading", headshotSupported, headshotReady, headshotUploading };
  const validationErrors = (target: Step) => applicationStepErrors(target, validationInput);

  function fieldId(key: string) {
    return key === "resume" || key === "headshot" || key === "consent" ? key : questions.some((question) => question.key === key) ? answerId(key) : key;
  }

  function validate(target: Step) {
    const next = validationErrors(target);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) window.requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
    return !first;
  }

  async function move(next: Step) {
    if (uploadState.kind === "uploading" || headshotUploading || !validate(step)) return;
    cancelPendingSave();
    // A failed save must never trap a student on a step. /api/apply posts the whole client
    // payload and rush.submit_application takes every field as an argument, so the stored
    // draft row is a convenience, not a prerequisite for submitting; sessionStorage recovery
    // covers a reload. The save-error panel (role="alert") still reports the failure, and
    // focus stays with the new step instead of jumping into the sidebar.
    changeStep(next);
    saveDraft({ ...draftPayload, currentStep: next });
  }

  async function submit() {
    if (conflictRef.current || submissionInFlight.current || uploadState.kind === "uploading" || headshotUploading) return;
    if (!consent) {
      setErrors((current) => ({ ...current, consent: "Check this box to confirm you reviewed your application before submitting." }));
      document.getElementById("consent")?.focus();
      return;
    }
    const allErrors = Object.assign({}, ...STEPS.slice(0, 3).map(({ id }) => validationErrors(id)));
    const firstError = Object.keys(allErrors)[0];
    if (firstError) {
      setErrors(allErrors);
      pendingValidationFocus.current = fieldId(firstError);
      changeStep(stepForField(firstError, questions));
      return;
    }
    cancelPendingSave();
    pendingSave.current = null;
    saveSequence.current += 1;
    submissionInFlight.current = true;
    setSubmitState({ kind: "submitting" });
    const finishSubmission = (applicationId: string) => {
      const storage = applicationRecoveryStorage();
      if (storage) {
        clearApplicationDraftRecovery(storage);
        clearApplicationStepRecovery(storage);
      }
      setDraftDirty(false);
      router.replace(`/applicant?submitted=${encodeURIComponent(applicationId)}`);
      router.refresh();
    };
    try {
      const request = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draftPayload, consent: true, expectedRevision: revision.current, cycleId }) };
      let response: Response;
      let body: unknown;
      try {
        ({ response, body } = await fetchJsonWithTimeout("/api/apply", request, SUBMIT_TIMEOUT_MS));
      } catch (error) {
        if (!(error instanceof RequestTimeoutError) && !(error instanceof TypeError)) throw error;
        const applicationId = cycleId ? await reconcileSubmittedApplication({ cycleId }) : null;
        if (applicationId) {
          finishSubmission(applicationId);
          return;
        }
        throw new RequestTimeoutError();
      }
      if (response.status === 409) {
        const result = parseApplicationDraftSaveResult(body);
        if (result?.kind === "conflict") {
          conflictRef.current = true;
          uncertainSave.current = null;
          pendingSave.current = null;
          setConflict({ local: latestDraft.current, server: result.snapshot });
          submissionInFlight.current = false;
          setSubmitState({ kind: "idle" });
          setConsent(false);
          return;
        }
      }
      if (!response.ok) {
        if ([500, 502, 503, 504].includes(response.status)) {
          const applicationId = cycleId ? await reconcileSubmittedApplication({ cycleId }) : null;
          if (applicationId) { finishSubmission(applicationId); return; }
          throw new RequestTimeoutError();
        }
        throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The application could not be submitted.");
      }
      const applicationId = parseApplicationSubmissionReceipt(body) ?? (cycleId ? await reconcileSubmittedApplication({ cycleId }) : null);
      if (!applicationId) throw new RequestTimeoutError();
      finishSubmission(applicationId);
    } catch (error) {
      const message = error instanceof RequestTimeoutError || error instanceof TypeError
        ? "We could not confirm whether your application was received. Check your connection, then try Submit again; duplicate submissions are prevented."
        : error instanceof Error ? error.message : "The application could not be submitted.";
      submissionInFlight.current = false;
      setSubmitState({ kind: "error", message });
    }
  }

  function resolveConflict(useLocal: boolean, combined?: ApplicationServerDraft) {
    if (!conflict) return;
    const selected = combined ?? (useLocal ? conflict.local : conflict.server?.draft);
    if (!selected) return;
    revision.current = conflict.server?.revision ?? null;
    setName(selected.name); setPreferredName(selected.preferredName); setPhone(selected.phone);
    setClassYear(selected.classYear); setMajor(selected.major); setCollege(selected.college);
    setUniqname(selected.uniqname); setGradTerm(selected.gradTerm);
    setAccessibilityNotes(selected.accessibilityNotes); setLinkedinUrl(selected.linkedinUrl);
    setAnswers(selected.answers); setResumePath(selected.resumeStoragePath); setStep(selected.currentStep);
    setUploadState(selected.resumeStoragePath ? { kind: "uploaded", label: "Previously uploaded PDF" } : { kind: "idle" });
    setConsent(false);
    setConsentNotice("Review the chosen copy before consenting to submit.");
    conflictRef.current = false;
    setConflict(null);
    setSaveState({ kind: "idle" });
    setDraftDirty(useLocal);
    if (!useLocal) {
      const storage = applicationRecoveryStorage();
      if (storage) { clearApplicationDraftRecovery(storage); clearApplicationStepRecovery(storage); }
    }
    pendingRecoveryFocus.current = true;
  }

  useEffect(() => {
    if (conflict) document.getElementById("draft-conflict-heading")?.focus();
  }, [conflict]);

  useEffect(() => {
    if (pendingRecoveryFocus.current && !conflict && recoveryDecision.kind === "ready") {
      document.getElementById("application-step-heading")?.focus();
      pendingRecoveryFocus.current = false;
    }
  }, [conflict, recoveryDecision.kind]);

  // Before opens_at the cycle is open, it just has not started, and intake_schema still reports
  // open:false. Saying "closed" there would contradict the countdown a few lines above it on the
  // same screen; the red wording is for a cycle that is genuinely over.
  //
  // The copy no longer tells anyone to reload: ApplicationCountdown calls router.refresh() the
  // moment it hits zero, so the form arrives on its own. Telling a hall full of students to
  // refresh at 20:00:00 is also how you turn an opening into a thundering herd.
  if (!cycleOpen) return preOpenLabel
    ? <div className="mt-8 rounded-xl bg-warning-wash p-6 text-warning"><p className="font-semibold">{preOpenLabel}.</p><p className="mt-2 text-sm leading-6 text-amber-900/80">Keep this page open. The application appears here on its own when the countdown reaches zero.</p></div>
    : <div className="mt-8 rounded-xl bg-danger-wash p-6 text-danger"><p className="font-semibold">Applications are currently closed.</p><p className="mt-2 text-sm leading-6 text-red-800/80">Check the recruitment page for the next opening date, or email the MECG board if you expected to apply today.</p></div>;

  if (recoveryDecision.kind === "checking") return <p className="mt-6" role="status">Checking for browser answers...</p>;
  if (recoveryDecision.kind === "choice") return (
    <section aria-labelledby="recovery-choice-heading" aria-describedby="recovery-choice-description" className="surface-card mt-6 max-w-3xl bg-white p-6 sm:p-8">
      <h2 id="recovery-choice-heading" tabIndex={-1} className="text-2xl font-semibold">Choose which answers to continue with</h2>
      <p id="recovery-choice-description" className="mt-3 leading-7 text-muted">This tab has browser answers that differ from your saved draft. Either copy may be older. Editing and saving are paused until you choose.</p>
      <p className="mt-3 text-sm leading-6 text-muted">Recovering browser answers replaces the answers in your saved draft when they sync. Keeping your saved draft discards this browser copy. Browser recovery is limited to this tab, expires after 24 hours, and can be lost when the tab closes or browser storage is cleared. Your uploaded materials stay with your saved draft.</p>
      <ApplicationRecoveryReview saved={initialRecoveryDraft} browser={recoveryDecision.draft} questions={questions} onCombine={(combined) => chooseRecovery(true, combined)} />
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="button-secondary" onClick={() => chooseRecovery(true)}>Recover browser answers</button>
        <button type="button" className="button-secondary" onClick={() => chooseRecovery(false)}>Keep saved draft</button>
      </div>
    </section>
  );

  if (conflict) return (
    <section aria-labelledby="draft-conflict-heading" className="surface-card mt-6 max-w-3xl bg-white p-6 sm:p-8">
      <h2 id="draft-conflict-heading" tabIndex={-1} className="text-2xl font-semibold">Your saved draft changed elsewhere</h2>
      <p className="mt-3 leading-7 text-muted">Saving and submitting are paused. Your answers on this page have been kept. Compare both copies, then choose which one to continue with.</p>
      {!conflict.server && <p className="mt-3 text-sm leading-6 text-muted">The previous saved draft no longer exists. Keeping this page will create a new draft if applications are still open.</p>}
      <ApplicationRecoveryReview expanded saved={conflict.server?.draft ?? null} browser={conflict.local} questions={questions} resume={{ saved: conflict.server?.draft.resumeStoragePath ?? "", browser: conflict.local.resumeStoragePath }} onCombine={(combined, resumeSource) => resolveConflict(true, { ...conflict.local, ...combined, resumeStoragePath: resumeSource === "saved" ? conflict.server?.draft.resumeStoragePath ?? "" : conflict.local.resumeStoragePath })} />
      <div className="mt-5 border-b border-line pb-5">
        <div><h3 className="font-semibold">Resume</h3><div className="mt-2 grid gap-3 text-sm leading-6 sm:grid-cols-2"><div><p className="font-medium">Saved draft</p>{conflict.server?.draft.resumeStoragePath ? <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/api/apply/resume?path=${encodeURIComponent(conflict.server.draft.resumeStoragePath)}`} target="_blank" rel="noopener noreferrer">View saved PDF (opens a new tab)</a> : <p>Not provided</p>}</div><div><p className="font-medium">Browser answers</p>{conflict.local.resumeStoragePath ? <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/api/apply/resume?path=${encodeURIComponent(conflict.local.resumeStoragePath)}`} target="_blank" rel="noopener noreferrer">View this page’s PDF (opens a new tab)</a> : <p>Not provided</p>}</div></div>{conflict.local.resumeStoragePath !== (conflict.server?.draft.resumeStoragePath ?? "") && <p className="mt-2 text-sm leading-6 text-muted">These copies use different resumes. Choosing a copy also chooses its uploaded PDF.</p>}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">Keeping this page will replace the saved copy when it syncs. Using the saved copy discards the changes on this page. To keep changes from both, compare the changed answers and continue with your combined choices.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="button-secondary" onClick={() => resolveConflict(true)}>Keep this page’s answers</button>
        {conflict.server && <button type="button" className="button-secondary" onClick={() => resolveConflict(false)}>Use the saved copy</button>}
      </div>
    </section>
  );

  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const completed = (id: Step) => id !== "review" && STEPS.findIndex((item) => item.id === id) < currentIndex && Object.keys(validationErrors(id)).length === 0;
  const saving = saveState.kind === "saving";
  const uploading = uploadState.kind === "uploading";
  const submitting = submitState.kind === "submitting";
  const localSaveLabel = draftDirty
    ? localRecovery === "saved" ? "Saved in this tab. Waiting to sync." : localRecovery === "unavailable" ? "Changes are only on this page. Keep it open until saved." : "Changes waiting to save."
    : "Your answers save automatically.";

  // One list serves the desktop sidebar and the phone disclosure. Only one is displayed at a
  // time, so assistive tech never meets two "Application progress" lists.
  const stepListClass = "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:block lg:space-y-2";
  const stepItems = STEPS.map((item, index) => {
    const active = item.id === step;
    return <li key={item.id}><button type="button" onClick={() => { if (active) setMobileStepsOpen(false); else if (index < currentIndex) changeStep(item.id); }} disabled={index > currentIndex || submitting} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition-colors sm:flex-col sm:items-start sm:text-sm lg:flex-row lg:gap-3 ${active ? "bg-wash text-mecg-navy" : completed(item.id) ? "text-mecg-navy hover:bg-wash" : "cursor-default text-muted"}`} aria-current={active ? "step" : undefined}><span className={`grid size-7 shrink-0 place-items-center rounded-full tabular text-xs ${active ? "bg-mecg-orange text-mecg-navy" : completed(item.id) ? "bg-mecg-navy text-white" : "bg-wash"}`}>{completed(item.id) ? "✓" : index + 1}</span><span>{item.shortLabel}{index < currentIndex && !completed(item.id) && <span className="block text-xs font-normal text-mecg-orange-ink">Needs attention</span>}</span></button></li>;
  });

  return (
    <div className="application-editor mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,720px)] lg:items-start lg:gap-8">
      <aside className="order-2 hidden lg:order-1 lg:sticky lg:top-8 lg:block">
        <div className="application-step-guide">
          <p className="text-[13px] text-muted">{cycleName ?? "Current cycle"}</p>
          <ol className={`mt-6 ${stepListClass}`} aria-label="Application progress">{stepItems}</ol>
          <div className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
            {saveState.kind === "saving" && <p aria-hidden="true">Saving changes...</p>}
            {saveState.kind === "saved" && <p className="tabular-nums" role="status" aria-live="polite">Saved to your account at {saveState.label}</p>}
            {saveState.kind === "error" && <div id="draft-save-error" className="text-danger" role="alert" tabIndex={-1}><p>{saveState.message}</p><button type="button" onClick={() => void saveDraft(draftPayload, true)} disabled={saving || submitting} className="mt-2 min-h-11 font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">Retry save</button></div>}
            {saveState.kind === "idle" && <p>{localSaveLabel}</p>}
          </div>
        </div>
        <p className="mt-4 px-2 text-xs leading-5 text-muted">Need help? <a className="underline underline-offset-2" href="mailto:mecg-board@umich.edu">Email the recruitment team.</a></p>
      </aside>

      <section onChangeCapture={handleApplicationChange} onBlurCapture={handleApplicationBlur} className="surface-card order-1 min-w-0 bg-white p-6 sm:p-8 lg:order-2">
        <div ref={mobileStepsRef} className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 rounded-t-[28px] border-b border-line bg-white/95 px-6 pb-4 pt-5 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <button ref={mobileStepsToggleRef} type="button" onClick={() => setMobileStepsOpen((open) => !open)} aria-expanded={mobileStepsOpen} aria-controls="mobile-application-steps" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-mecg-orange-ink">Step {currentIndex + 1} of {STEPS.length}<span className={`text-xs transition-transform ${mobileStepsOpen ? "rotate-180" : ""}`} aria-hidden="true">▾</span><span className="sr-only">, show all steps</span></button>
            <p className="text-xs font-semibold text-muted" aria-live="polite">
              {saveState.kind === "saving" ? "Saving…" : saveState.kind === "saved" ? "Saved" : saveState.kind === "error" ? "Could not sync" : draftDirty && localRecovery === "saved" ? "Saved in this tab" : STEPS[currentIndex].label}
            </p>
          </div>
          <ol id="mobile-application-steps" hidden={!mobileStepsOpen} className={`mt-3 ${stepListClass}`} aria-label="Application progress">{stepItems}</ol>
          <div className="progress-track mt-3" aria-hidden="true">
            <div className="progress-fill" style={{ transform: `scaleX(${(currentIndex + 1) / STEPS.length})` }} />
          </div>
          {saveState.kind === "error" && <div className="mt-3 rounded-xl bg-danger-wash p-3 text-sm text-danger" role="alert"><p>{saveState.message}</p><button type="button" onClick={() => saveDraft(draftPayload)} disabled={saving || submitting} className="mt-2 min-h-11 font-semibold underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">Retry save</button></div>}
        </div>

        {recoveredNotice && <p role="status" className="mb-5 border-b border-line pb-4 text-sm leading-6 text-muted">Restored your unsynced answers from this tab. Check your materials and review before submitting.</p>}
        {draftDirty && localRecovery === "unavailable" && <p role="status" className="mb-5 rounded-xl bg-warning-wash p-4 text-sm leading-6 text-warning">Tab recovery is unavailable. Keep this page open until your changes are saved to your account.</p>}
        <fieldset disabled={submitting} className="m-0 min-w-0 border-0 p-0">
        <div key={step} className="step-seat" data-direction={stepDirection}>
          <p className="hidden text-[13px] text-mecg-orange-ink lg:block">Step {currentIndex + 1} of {STEPS.length}</p>
          {step === "details" && <DetailsStep values={{ name, preferredName, phone, classYear, major, college, uniqname, gradTerm }} setters={{ setName, setPreferredName, setPhone, setClassYear, setMajor, setCollege, setUniqname, setGradTerm }} email={email} errors={errors} gradBaseYear={gradBaseYear} />}
          {step === "responses" && <ResponsesStep questions={questions} answers={answers} setAnswers={setAnswers} errors={errors} />}
          {step === "materials" && <MaterialsStep linkedinUrl={linkedinUrl} setLinkedinUrl={setLinkedinUrl} accessibilityNotes={accessibilityNotes} setAccessibilityNotes={setAccessibilityNotes} uploadState={uploadState} resumePath={resumePath} uploadResume={uploadResume} error={errors.resume} initialHasHeadshot={headshotReady} setHeadshotReady={setHeadshotReady} headshotError={errors.headshot} headshotSupported={headshotSupported} setHeadshotUploading={setHeadshotUploading} linkedinError={errors.linkedinUrl} accessibilityNotesError={errors.accessibilityNotes} />}
          {step === "review" && <ReviewStep values={{ name, preferredName, email, phone, classYear, major, college, uniqname, gradTerm, linkedinUrl, accessibilityNotes }} questions={questions} answers={answers} resumeLabel={resumePath ? uploadState.kind === "uploaded" ? uploadState.label : "Resume uploaded" : "Not uploaded"} headshotStatus={headshotSupported ? headshotReady ? "Uploaded" : "Not uploaded" : null} consent={consent} consentError={errors.consent} consentNotice={consentNotice} setConsent={(value) => { setConsent(value); if (value) setConsentNotice(""); }} submitState={submitState} submit={submit} changeStep={changeStep} uploading={uploading || headshotUploading} />}
        </div>
        </fieldset>

        {step !== "review" && <div className="sticky bottom-0 z-10 -mx-6 mt-7 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-6 pb-4 pt-5 backdrop-blur sm:static sm:mx-0 sm:px-0 sm:pb-0"><button type="button" onClick={() => changeStep(STEPS[Math.max(0, currentIndex - 1)].id)} disabled={currentIndex === 0} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted disabled:invisible">Back</button><button type="button" onClick={() => void move(returnToReview ? "review" : STEPS[currentIndex + 1].id)} disabled={uploading || headshotUploading} aria-busy={uploading || headshotUploading} className="button-dark flex-1 bg-mecg-navy sm:flex-none">{uploading ? "Uploading resume..." : headshotUploading ? "Uploading photo..." : returnToReview ? "Save and return to review" : "Continue"}</button></div>}
      </section>
    </div>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 id="application-step-heading" tabIndex={-1} className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] outline-none">{children}</h2>;
}

function DetailsStep({ values, setters, email, errors, gradBaseYear }: { values: Record<string, string>; setters: Record<string, (value: string) => void>; email: string; errors: Record<string, string>; gradBaseYear: number }) {
  const describedBy = (key: string) => errors[key] ? `${key}-error` : undefined;
  return <><StepHeading>Start with the basics.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-muted">These profile details stay separate from the written-response packet used for first-pass review.</p><div className="mt-8 grid gap-5 sm:grid-cols-2">
    <div className={labelClass}><label htmlFor="name">Full name <span className="text-mecg-orange-ink">(required)</span></label><input id="name" value={values.name} onChange={(e) => setters.setName(e.target.value)} autoComplete="name" maxLength={APPLICATION_FIELD_LIMITS.name} required className={fieldClass} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} /><FieldError id="name-error">{errors.name}</FieldError></div>
    <div className={labelClass}><label htmlFor="preferredName">Preferred name <span className="font-normal text-muted">Optional</span></label><input id="preferredName" value={values.preferredName} onChange={(e) => setters.setPreferredName(e.target.value)} autoComplete="nickname" maxLength={APPLICATION_FIELD_LIMITS.preferredName} className={fieldClass} aria-invalid={Boolean(errors.preferredName)} aria-describedby={describedBy("preferredName")} /><FieldError id="preferredName-error">{errors.preferredName}</FieldError></div>
    <div className="sm:col-span-2"><p className={labelClass}>Verified email</p><div className="mt-2 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl bg-mecg-blue/10 px-4 text-sm"><span className="min-w-0 break-all">{email}</span><span className="font-semibold text-success">✓ Verified</span></div></div>
    <div className={labelClass}><label htmlFor="phone">Phone <span className="font-normal text-muted">Optional</span></label><input id="phone" value={values.phone} onChange={(e) => setters.setPhone(e.target.value)} type="tel" autoComplete="tel" maxLength={APPLICATION_FIELD_LIMITS.phone} className={fieldClass} aria-invalid={Boolean(errors.phone)} aria-describedby={describedBy("phone")} /><FieldError id="phone-error">{errors.phone}</FieldError></div>
    <div className={labelClass}><label htmlFor="uniqname">Uniqname <span className="text-mecg-orange-ink">(required)</span></label><input id="uniqname" value={values.uniqname} onChange={(e) => setters.setUniqname(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={APPLICATION_FIELD_LIMITS.uniqname} required className={fieldClass} aria-invalid={Boolean(errors.uniqname)} aria-describedby={describedBy("uniqname")} /><FieldError id="uniqname-error">{errors.uniqname}</FieldError></div>
    <div className={labelClass}><label htmlFor="classYear">Year <span className="text-mecg-orange-ink">(required)</span></label><select id="classYear" value={values.classYear} onChange={(e) => setters.setClassYear(e.target.value)} required className={selectClass} aria-invalid={Boolean(errors.classYear)} aria-describedby={describedBy("classYear")}><option value="">Select year</option>{CLASS_YEARS.map((year) => <option key={year} value={year}>{CLASS_YEAR_LABELS[year]}</option>)}</select><FieldError id="classYear-error">{errors.classYear}</FieldError></div>
    <div className={labelClass}><label htmlFor="college">College <span className="text-mecg-orange-ink">(required)</span></label><select id="college" value={values.college} onChange={(e) => setters.setCollege(e.target.value)} required className={selectClass} aria-invalid={Boolean(errors.college)} aria-describedby={describedBy("college")}><option value="">Select college</option>{COLLEGES.map((item) => <option key={item}>{item}</option>)}</select><FieldError id="college-error">{errors.college}</FieldError></div>
    <div className={labelClass}><label htmlFor="major">Major <span className="text-mecg-orange-ink">(required)</span></label><input id="major" value={values.major} onChange={(e) => setters.setMajor(e.target.value)} autoCapitalize="words" maxLength={APPLICATION_FIELD_LIMITS.major} required className={fieldClass} aria-invalid={Boolean(errors.major)} aria-describedby={describedBy("major")} /><FieldError id="major-error">{errors.major}</FieldError></div>
    <div><GradTermPicker id="gradTerm" value={values.gradTerm} onChange={setters.setGradTerm} baseYear={gradBaseYear} legend={<>Expected graduation <span className="font-normal text-muted">Optional</span></>} legendClassName={labelClass} selectClassName={selectClass} invalid={Boolean(errors.gradTerm)} describedBy={describedBy("gradTerm")} /><FieldError id="gradTerm-error">{errors.gradTerm}</FieldError></div>
  </div></>;
}

function ResponsesStep({ questions, answers, setAnswers, errors }: { questions: IntakeQuestion[]; answers: Record<string, string>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>; errors: Record<string, string> }) {
  return <><StepHeading>Tell us how you think.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-muted">Be specific about your own actions. We care more about judgment and reflection than polished business language.</p><div className="mt-6 space-y-6">{questions.map((question, index) => {
    const value = answers[question.key] ?? "";
    const id = answerId(question.key);
    const guidanceId = `${id}-guidance`;
    const errorId = `${id}-error`;
    const describedBy = errors[question.key] ? `${guidanceId} ${errorId}` : guidanceId;
    const common = { id, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setAnswers((current) => ({ ...current, [question.key]: event.target.value })), required: question.required, "aria-invalid": Boolean(errors[question.key]), "aria-describedby": describedBy };
    let control: React.ReactNode;
    if (question.inputType === "short_text") control = <input {...common} type="text" maxLength={APPLICATION_FIELD_LIMITS.answer} className={fieldClass} />;
    else if (question.inputType === "url") control = <input {...common} type="url" maxLength={APPLICATION_FIELD_LIMITS.answer} className={fieldClass} />;
    else if (question.inputType === "select") control = <select {...common} className={selectClass}><option value="">Select an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    else control = <textarea {...common} maxLength={APPLICATION_FIELD_LIMITS.answer} rows={5} className={`${fieldClass} min-h-32 py-3 leading-6`} />;
    const words = countWords(value);
    return <div key={question.key}><label htmlFor={id} className="flex gap-3"><span className="tabular text-xs text-mecg-orange-ink">{String(index + 1).padStart(2, "0")}</span><span className="text-lg font-semibold leading-6">{question.prompt}{question.required && <span className="ml-2 text-sm text-mecg-orange-ink">(required)</span>}</span></label>{control}<span id={guidanceId} className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{guidanceFor(question)}</span><span className={`tabular-nums ${question.maxWords && words > question.maxWords ? "font-semibold text-danger" : ""}`}>{question.maxWords ? `${words} / ${question.maxWords} words` : `${words} words`} · {APPLICATION_FIELD_LIMITS.answer - value.length} characters remaining</span></span><FieldError id={errorId}>{errors[question.key]}</FieldError></div>;
  })}</div></>;
}

function MaterialsStep({ linkedinUrl, setLinkedinUrl, accessibilityNotes, setAccessibilityNotes, uploadState, resumePath, uploadResume, error, initialHasHeadshot, setHeadshotReady, headshotError, headshotSupported, setHeadshotUploading, linkedinError, accessibilityNotesError }: { linkedinUrl: string; setLinkedinUrl: (value: string) => void; accessibilityNotes: string; setAccessibilityNotes: (value: string) => void; uploadState: UploadState; resumePath: string; uploadResume: (file: File) => Promise<void>; error?: string; initialHasHeadshot: boolean; setHeadshotReady: (ready: boolean) => void; headshotError?: string; headshotSupported: boolean; setHeadshotUploading: (busy: boolean) => void; linkedinError?: string; accessibilityNotesError?: string }) {
  const resumeDescription = ["resume-guidance", error ? "resume-error" : "", uploadState.kind === "error" ? "resume-upload-error" : ""].filter(Boolean).join(" ");
  const [dropActive, setDropActive] = useState(false);
  // A "wait" notice only means something while that upload is still running.
  const [dropNotice, setDropNotice] = useState<{ message: string; whileUploading: boolean } | null>(null);
  const uploading = uploadState.kind === "uploading";
  return <><StepHeading>Add your materials.</StepHeading><p className="mt-3 max-w-xl text-pretty leading-7 text-muted">Your resume is stored privately. Assigned first-pass reviewers can view the original PDF for context, including any identifying information it contains.</p><div className="mt-8 space-y-6">
    <label htmlFor="resume" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!uploading) setDropActive(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false); }} onDrop={(e) => { e.preventDefault(); setDropActive(false); const drop = resumeDrop(e.dataTransfer.files.length, uploading); setDropNotice(drop.kind === "notice" ? { message: drop.message, whileUploading: uploading } : null); if (drop.kind === "upload") void uploadResume(e.dataTransfer.files[0]); }} className={`group block cursor-pointer rounded-xl p-6 text-center outline-none transition-colors hover:bg-mecg-blue/10 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-mecg-navy ${dropActive ? "bg-mecg-blue/10 inset-ring-2 inset-ring-mecg-navy" : "bg-wash inset-ring inset-ring-line"}`}><input id="resume" type="file" accept="application/pdf" required={!resumePath} disabled={uploadState.kind === "uploading"} className="sr-only" aria-invalid={Boolean(error || uploadState.kind === "error")} aria-describedby={resumeDescription} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; setDropNotice(null); if (file) void uploadResume(file); }} /><span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm" aria-hidden="true">↑</span><span className="mt-4 block font-semibold">{uploadState.kind === "uploading" ? "Uploading resume..." : dropActive ? "Drop your PDF to upload" : resumePath ? "Replace your resume" : "Upload your resume (required)"}</span><span id="resume-guidance" className="mt-1 block text-sm text-muted">PDF only, up to 10 MB. Choose a file or drag it here.</span>{uploadState.kind === "uploaded" && <span className="mt-4 block rounded-xl bg-success-wash px-3 py-2 text-sm font-medium text-success">✓ {uploadState.label}</span>}</label>
    <p className="text-sm font-medium text-mecg-orange-ink empty:hidden" role="status">{dropNotice && (uploading || !dropNotice.whileUploading) ? dropNotice.message : ""}</p>
    {uploadState.kind === "uploading" && <p className="text-sm text-muted" role="status" aria-live="polite">Uploading and checking {uploadState.label}...</p>}{uploadState.kind === "uploaded" && <p className="text-sm text-success" role="status" aria-live="polite">Resume verified{uploadState.pageCount ? ` · ${uploadState.pageCount} ${uploadState.pageCount === 1 ? "page" : "pages"}` : ""}{uploadState.size ? ` · ${(uploadState.size / 1024 / 1024).toFixed(1)} MB` : ""}. {resumePath && <a className="font-semibold underline underline-offset-2" href={`/api/apply/resume?path=${encodeURIComponent(resumePath)}`} target="_blank" rel="noreferrer">View PDF</a>}</p>}{uploadState.kind === "error" && <FieldError id="resume-upload-error" alert>{uploadState.message}</FieldError>}<FieldError id="resume-error">{error}</FieldError>
    {headshotSupported ? <div><HeadshotField onUploaded={setHeadshotReady} initialHasHeadshot={initialHasHeadshot} onBusyChange={setHeadshotUploading} validationError={headshotError} /><FieldError id="headshot-error">{headshotError}</FieldError></div> : null}
    <div className={labelClass}><label htmlFor="linkedinUrl">LinkedIn profile <span className="font-normal text-muted">Optional</span></label><input id="linkedinUrl" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} type="url" placeholder="https://linkedin.com/in/..." maxLength={APPLICATION_FIELD_LIMITS.linkedinUrl} className={fieldClass} aria-invalid={Boolean(linkedinError)} aria-describedby={linkedinError ? "linkedinUrl-error" : undefined} /><FieldError id="linkedinUrl-error">{linkedinError}</FieldError></div>
    <div className={labelClass}><label htmlFor="accessibilityNotes">Scheduling or access needs <span className="font-normal text-muted">Optional and never scored</span></label><textarea id="accessibilityNotes" value={accessibilityNotes} onChange={(e) => setAccessibilityNotes(e.target.value)} maxLength={APPLICATION_FIELD_LIMITS.accessibilityNotes} rows={4} className={`${fieldClass} py-3`} aria-invalid={Boolean(accessibilityNotesError)} aria-describedby={`accessibilityNotes-guidance${accessibilityNotesError ? " accessibilityNotes-error" : ""}`} /><span id="accessibilityNotes-guidance" className="mt-2 block text-xs font-normal leading-5 text-muted">Only the operations team uses this information to arrange an accessible recruitment process.</span><FieldError id="accessibilityNotes-error">{accessibilityNotesError}</FieldError></div>
  </div></>;
}

function ReviewStep({ values, questions, answers, resumeLabel, headshotStatus, consent, consentError, consentNotice, setConsent, submitState, submit, changeStep, uploading }: { values: Record<string, string>; questions: IntakeQuestion[]; answers: Record<string, string>; resumeLabel: string; headshotStatus: string | null; consent: boolean; consentError?: string; consentNotice: string; setConsent: (value: boolean) => void; submitState: SubmitState; submit: () => Promise<void>; changeStep: (step: Step) => void; uploading: boolean }) {
  const classYearLabel = CLASS_YEARS.includes(values.classYear as (typeof CLASS_YEARS)[number]) ? CLASS_YEAR_LABELS[values.classYear as (typeof CLASS_YEARS)[number]] : values.classYear;
  return <><StepHeading>Review before you submit.</StepHeading><p className="mt-3 text-pretty leading-7 text-muted">You will not be able to edit this application after submission.</p><div className="mt-8 space-y-4">
    <ReviewCard title="About you" edit={() => changeStep("details")}><dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2"><ReviewItem label="Full name" value={values.name} /><ReviewItem label="Preferred name" value={values.preferredName} /><ReviewItem label="Email" value={values.email} /><ReviewItem label="Phone" value={values.phone} /><ReviewItem label="Uniqname" value={values.uniqname} /><ReviewItem label="Class year" value={classYearLabel} /><ReviewItem label="College" value={values.college} /><ReviewItem label="Major" value={values.major} /><ReviewItem label="Expected graduation" value={values.gradTerm} /></dl></ReviewCard>
    <ReviewCard title="Written responses" edit={() => changeStep("responses")}><ul className="space-y-4">{questions.map((question) => <li key={question.key}><p className="font-medium">{question.prompt}</p><p className="mt-1 whitespace-pre-wrap break-words text-muted">{answers[question.key] || "Not provided"}</p></li>)}</ul></ReviewCard>
    <ReviewCard title="Materials and access" edit={() => changeStep("materials")}><dl className="space-y-3"><ReviewItem label="Resume" value={resumeLabel} />{headshotStatus && <ReviewItem label="Photo" value={headshotStatus} />}<ReviewItem label="LinkedIn URL" value={values.linkedinUrl} /><ReviewItem label="Scheduling or access needs" value={values.accessibilityNotes} preserveWhitespace /></dl></ReviewCard>
  </div><div className="mt-6 rounded-xl bg-mecg-blue/10 p-5"><p className="font-semibold">How the first read works</p><p className="mt-2 text-sm leading-6 text-muted">The written-response packet omits your profile name, email, LinkedIn profile, and access notes. Assigned reviewers can also view your original resume, which may contain identifying information.</p></div>
  <label className={`mt-6 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-4 inset-ring ${consentError ? "inset-ring-2 inset-ring-danger" : "inset-ring-line"}`}><input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={Boolean(consentError)} aria-describedby={consentError ? "consent-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-mecg-orange" /><span className="text-sm leading-6">I reviewed my application and consent to MECG using this information to administer the current recruitment cycle.</span></label>
  <FieldError id="consent-error">{consentError}</FieldError>
  {consentNotice && <p role="status" className="mt-3 rounded-xl bg-warning-wash p-3 text-sm text-warning">{consentNotice}</p>}
  {submitState.kind === "error" && <div className="mt-4"><FieldError id="submit-error" alert>{submitState.message}</FieldError></div>}
  <p id="submission-guidance" className="mt-4 text-sm leading-6 text-muted">Saving a draft does not submit your application. After submission is confirmed, you will see your applicant status page.</p>
  <p className="sr-only" role="status" aria-live="polite">{submitState.kind === "submitting" ? "Submitting your application. Please wait." : ""}</p>
  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => changeStep("materials")} className="min-h-12 rounded-xl px-5 font-semibold text-muted">Back</button><button type="button" onClick={() => void submit()} disabled={submitState.kind === "submitting" || uploading} aria-busy={submitState.kind === "submitting"} className="button-primary" aria-describedby="submission-guidance">{submitState.kind === "submitting" ? "Submitting application..." : "Submit application"}</button></div></>;
}

function ReviewItem({ label, value, preserveWhitespace = false }: { label: string; value: string; preserveWhitespace?: boolean }) {
  return <div><dt className="font-medium text-mecg-navy">{label}</dt><dd className={`mt-0.5 break-words text-muted ${preserveWhitespace ? "whitespace-pre-wrap" : ""}`}>{value || "Not provided"}</dd></div>;
}

function ReviewCard({ title, edit, children }: { title: string; edit: () => void; children: React.ReactNode }) {
  return <section className="rounded-xl bg-wash p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><button type="button" onClick={edit} aria-label={`Edit ${title.toLowerCase()}`} className="min-h-11 px-2 text-sm font-semibold text-mecg-blue underline underline-offset-2">Edit</button></div><div className="mt-3 text-sm leading-6">{children}</div></section>;
}
