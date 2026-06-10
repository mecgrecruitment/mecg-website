"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import {
  applyFieldsSchema,
  responseSchemaFor,
  GRAD_YEARS,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  type ApplyQuestion,
} from "@/lib/apply/schema";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

type Props = {
  questions: ApplyQuestion[];
  siteKey: string;
};

type Status = "idle" | "submitting" | "success" | "error";

const inputClass =
  "rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none transition focus:border-[var(--orange)] aria-[invalid=true]:border-red-400/70";

export default function ApplicationForm({ questions, siteKey }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // EX-52: focus moves to the first invalid field on a failed submit.
  const focusFirstInvalid = (errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    if (!first || !formRef.current) return;
    const el = formRef.current.elements.namedItem(first);
    if (el instanceof HTMLElement) el.focus();
  };

  const validate = (data: FormData) => {
    const errs: Record<string, string> = {};

    const parsed = applyFieldsSchema.safeParse({
      full_name: data.get("full_name"),
      email: data.get("email"),
      year: data.get("year"),
      major: data.get("major"),
      phone: data.get("phone") ?? "",
      linkedin_url: data.get("linkedin_url") ?? "",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
    }

    const resume = data.get("resume");
    if (!(resume instanceof File) || resume.size === 0) {
      errs.resume = "Upload your resume as a PDF.";
    } else if (resume.type !== RESUME_MIME) {
      errs.resume = "Resume must be a PDF file.";
    } else if (resume.size > RESUME_MAX_BYTES) {
      errs.resume = "Resume must be 10MB or smaller.";
    }

    for (const q of questions) {
      const result = responseSchemaFor(q).safeParse(
        String(data.get(`q_${q.key}`) || "")
      );
      if (!result.success) {
        errs[`q_${q.key}`] = result.error.issues[0].message;
      }
    }

    return errs;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return; // EX-53: no double-submit

    const form = event.currentTarget;
    const data = new FormData(form);

    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setFormError("Fix the highlighted fields and resubmit.");
      setStatus("error");
      focusFirstInvalid(errs);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("submitting");

    try {
      const res = await fetch("/api/apply", { method: "POST", body: data });
      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (body.ok) {
        setStatus("success");
        return;
      }

      // EX-66: preserve entered values; the form stays mounted.
      setErrors(body.fieldErrors ?? {});
      setFormError(body.error ?? "Something went wrong. Try again.");
      setStatus("error");
      window.turnstile?.reset();
      if (body.fieldErrors) focusFirstInvalid(body.fieldErrors);
    } catch {
      setFormError(
        "Network error — your answers are still here. Check your connection and resubmit."
      );
      setStatus("error");
      window.turnstile?.reset();
    }
  };

  if (status === "success") {
    return (
      <section
        aria-live="polite"
        className="panel-strong mt-10 rounded-[2rem] p-8 md:p-10"
      >
        <p className="eyebrow">Confirmation</p>
        <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.05em] text-white">
          Application submitted.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-white/60">
          Thanks for applying to MECG. Keep an eye on the recruitment timeline
          for what happens next.
        </p>
        <a
          href="/recruitment"
          className="focus-ring mt-7 inline-block rounded-full bg-[var(--orange)] px-7 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)]"
        >
          View recruitment timeline
        </a>
      </section>
    );
  }

  const errorId = (name: string) => `apply-error-${name}`;

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={errorId(name)} className="text-sm font-semibold text-red-300">
        {errors[name]}
      </p>
    ) : null;

  const ariaProps = (name: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? errorId(name) : undefined,
  });

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="panel relative mt-10 grid gap-6 rounded-[2rem] p-7 md:p-9"
      >
        {/* EX-61 honeypot — invisible to humans, tempting to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto">
          <label>
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">Full name *</span>
            <input
              name="full_name"
              required
              autoComplete="name"
              className={inputClass}
              {...ariaProps("full_name")}
            />
            {fieldError("full_name")}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">UMich email *</span>
            <input
              name="email"
              type="email"
              required
              placeholder="uniqname@umich.edu"
              autoComplete="email"
              className={inputClass}
              {...ariaProps("email")}
            />
            {fieldError("email")}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">
              Graduation year *
            </span>
            <select
              name="year"
              required
              defaultValue=""
              className={inputClass}
              {...ariaProps("year")}
            >
              <option value="" disabled>
                Select year
              </option>
              {GRAD_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {fieldError("year")}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">Major(s) *</span>
            <input
              name="major"
              required
              placeholder="Industrial & Operations Engineering"
              className={inputClass}
              {...ariaProps("major")}
            />
            {fieldError("major")}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">Phone</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className={inputClass}
              {...ariaProps("phone")}
            />
            {fieldError("phone")}
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-white">LinkedIn</span>
            <input
              name="linkedin_url"
              type="url"
              placeholder="https://linkedin.com/in/…"
              className={inputClass}
              {...ariaProps("linkedin_url")}
            />
            {fieldError("linkedin_url")}
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-white">
            Resume (PDF, max 10MB) *
          </span>
          <input
            name="resume"
            type="file"
            accept="application/pdf"
            required
            className={inputClass}
            {...ariaProps("resume")}
          />
          {fieldError("resume")}
        </label>

        {questions.map((q) => (
          <label key={q.key} className="grid gap-2">
            <span className="text-sm font-bold text-white">
              {q.prompt}
              {q.required ? " *" : ""}
            </span>
            <textarea
              name={`q_${q.key}`}
              rows={5}
              required={q.required}
              className={inputClass}
              {...ariaProps(`q_${q.key}`)}
            />
            {fieldError(`q_${q.key}`)}
          </label>
        ))}

        <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" />

        {/* EX-52/EX-66: submit-with-errors announces a summary. */}
        <div role="status" aria-live="assertive">
          {formError && (
            <p className="rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
              {formError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </>
  );
}
