"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/client";

type State =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "done"; label: string }
  | { kind: "error"; message: string };

// Replacing a resume after submission. The same pipeline the application form
// uses (start, upload, finalize) plus an attach step, because after submission
// nothing else points the application at the new file.
//
// The fairness rule lives in the RPCs: allowed while the window is open,
// refused once a screening packet exists. This is only the client half.
export default function ResumeReplace({ hasResume }: { hasResume: boolean }) {
  const router = useRouter();
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function replace(file: File) {
    if (inFlight.current) return;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setState({ kind: "error", message: "Choose a PDF smaller than 10 MB." });
      return;
    }
    inFlight.current = true;
    setState({ kind: "working", label: file.name });
    let documentId = "";
    try {
      const startResponse = await fetch("/api/apply/resume/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      });
      const startBody = await startResponse.json().catch(() => null);
      if (!startResponse.ok || typeof startBody?.documentId !== "string" || typeof startBody?.path !== "string") {
        throw new Error(startBody?.error ?? "We could not start the upload.");
      }
      documentId = startBody.documentId;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(startBody.path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error("We could not upload your resume. Please try again.");

      const finalizeResponse = await fetch("/api/apply/resume/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const finalized = await finalizeResponse.json().catch(() => null);
      if (!finalizeResponse.ok) throw new Error(finalized?.error ?? "We could not verify your resume.");

      const attachResponse = await fetch("/api/apply/resume/attach", { method: "POST" });
      const attached = await attachResponse.json().catch(() => null);
      if (!attachResponse.ok) throw new Error(attached?.error ?? "We could not update your resume.");

      setState({ kind: "done", label: finalized?.filename ?? file.name });
      router.refresh();
    } catch (error) {
      if (documentId) {
        void fetch("/api/apply/resume/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });
      }
      setState({ kind: "error", message: error instanceof Error ? error.message : "We could not upload your resume." });
    } finally {
      inFlight.current = false;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.18)] hover:bg-mecg-blue/[0.08]">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void replace(file);
          }}
        />
        {hasResume ? "Replace resume" : "Upload a resume"}
      </label>
      <p className="mt-1.5 text-xs text-mecg-navy/45">
        PDF, up to 10 MB. You can change this until applications close, or until review starts on your file.
      </p>
      {state.kind === "working" && <p role="status" className="mt-2 text-sm text-mecg-navy/60">Uploading {state.label}…</p>}
      {state.kind === "done" && <p role="status" className="mt-2 text-sm text-emerald-800">{state.label} is now on file.</p>}
      {state.kind === "error" && <p role="alert" className="mt-2 text-sm text-red-700">{state.message}</p>}
    </div>
  );
}
