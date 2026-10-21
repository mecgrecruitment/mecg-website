"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeHeadshot, uploadHeadshot } from "@/lib/headshot-upload";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done" }
  | { kind: "error"; message: string };

// Backfill path: applications opened before the photo was part of the form, so
// everyone already submitted needs somewhere to add one. Same route as the form.
export default function HeadshotUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function upload(file: File) {
    if (inFlight.current) return;
    if (file.size > 25 * 1024 * 1024) {
      setState({ kind: "error", message: "Choose a photo smaller than 25 MB." });
      return;
    }
    inFlight.current = true;
    setState({ kind: "working" });
    try {
      await uploadHeadshot(await resizeHeadshot(file));
      setState({ kind: "done" });
      router.refresh();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "We could not upload your photo." });
    } finally {
      inFlight.current = false;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-mecg-navy inset-ring inset-ring-line-strong hover:bg-mecg-blue/10">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        Add or replace your photo
      </label>
      <p className="mt-1.5 text-xs text-muted">
        A clear photo of your face, taken with your phone is fine. It is resized in your browser and is never shown in anonymous review.
      </p>
      {state.kind === "working" && <p role="status" className="mt-2 text-sm text-muted">Uploading your photo…</p>}
      {state.kind === "done" && <p role="status" className="mt-2 text-sm text-success">Your photo is now on file.</p>}
      {state.kind === "error" && <p role="alert" className="mt-2 text-sm text-danger">{state.message}</p>}
    </div>
  );
}
