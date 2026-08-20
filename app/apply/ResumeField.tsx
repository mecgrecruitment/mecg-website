"use client";

import React, { useState } from "react";
import { RESUME_HINT, RESUME_MAX_BYTES, RESUME_MIME } from "@/lib/apply/schema";

/** PDF resume picker with immediate size/type feedback before submit. */
export function ResumeField() {
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setError(null);
      return;
    }

    const hasPdfExt = file.name.toLowerCase().endsWith(".pdf");
    const isPdfMime = file.type === RESUME_MIME;
    const isAmbiguousMime =
      file.type === "" || file.type === "application/octet-stream";

    if (!(isPdfMime || (hasPdfExt && isAmbiguousMime))) {
      setError(`Resume must be a PDF (${RESUME_HINT}).`);
      event.target.value = "";
      return;
    }

    if (file.size > RESUME_MAX_BYTES) {
      setError(
        `This file is too large. Use a PDF under ${RESUME_MAX_BYTES / (1024 * 1024)}MB.`
      );
      event.target.value = "";
      return;
    }

    setError(null);
  }

  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">Resume</span>
      <input
        name="resume"
        type="file"
        accept="application/pdf,.pdf"
        required
        onChange={handleChange}
        className="portal-field focus-ring"
      />
      <span className="text-xs text-white/40">{RESUME_HINT}</span>
      {error ? (
        <span className="text-sm text-red-200" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
