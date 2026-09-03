"use client";

import { useEffect, useRef, useState } from "react";
import { resizeHeadshot, uploadHeadshot } from "@/lib/headshot-upload";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; url: string; note: string }
  | { kind: "error"; message: string };

function byteLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// accept="image/*" is what gives phones the "Take Photo" option; no camera library needed.
export default function HeadshotField({ onUploaded, initialHasHeadshot = false, onBusyChange, validationError }: { onUploaded: (done: boolean) => void; initialHasHeadshot?: boolean; onBusyChange?: (busy: boolean) => void; validationError?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const previewUrl = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function releasePreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  }

  async function choose(file: File) {
    if (inFlight.current) return;
    releasePreview();
    // Guard before createImageBitmap: decoding a 40 MP original on a phone is
    // what runs the tab out of memory, and nothing that large is a headshot.
    if (file.size > 25 * 1024 * 1024) {
      setState({ kind: "error", message: "Choose a photo smaller than 25 MB." });
      onUploaded(false);
      return;
    }
    inFlight.current = true;
    setState({ kind: "working" });
    onBusyChange?.(true);
    try {
      // Same deterministic resize the upload sends, so the preview and the size
      // note describe exactly what is stored.
      const resized = await resizeHeadshot(file);
      await uploadHeadshot(resized);
      previewUrl.current = URL.createObjectURL(resized);
      setState({ kind: "done", url: previewUrl.current, note: `${byteLabel(file.size)} → ${byteLabel(resized.size)}` });
      onUploaded(true);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "We could not upload your photo. Please try again." });
      onUploaded(false);
    } finally {
      inFlight.current = false;
      onBusyChange?.(false);
    }
  }

  const uploaded = state.kind === "done" || (state.kind === "idle" && initialHasHeadshot);
  return (
    <div>
      <label htmlFor="headshot" className="group block cursor-pointer rounded-2xl bg-mecg-navy/[0.035] p-6 text-center shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] outline-none transition-colors hover:bg-mecg-blue/8 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-mecg-navy">
        <input
          id="headshot"
          type="file"
          accept="image/*"
          required={!uploaded}
          disabled={state.kind === "working"}
          className="sr-only"
          aria-invalid={state.kind === "error" || Boolean(validationError)}
          aria-describedby={["headshot-guidance", state.kind === "error" ? "headshot-upload-error" : "", validationError ? "headshot-error" : ""].filter(Boolean).join(" ")}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void choose(file); }}
        />
        {state.kind === "done"
          // eslint-disable-next-line @next/next/no-img-element -- blob: preview of the resized file, nothing for next/image to optimize
          ? <img src={state.url} alt="" className="mx-auto size-20 rounded-full object-cover shadow-sm" />
          : <span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm" aria-hidden="true">☺</span>}
        <span className="mt-4 block font-semibold">{state.kind === "working" ? "Uploading photo..." : uploaded ? "Replace your photo" : "Upload a photo of yourself (required)"}</span>
        <span id="headshot-guidance" className="mt-1 block text-sm text-mecg-navy/65">A clear photo of your face. Taken with your phone is fine. It is never shown in anonymous review.</span>
        {state.kind === "done" && <span className="mt-4 block rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ Photo uploaded · {state.note}</span>}
      </label>
      {state.kind === "working" && <p className="mt-2 text-sm text-mecg-navy/65" role="status" aria-live="polite">Resizing and uploading your photo...</p>}
      {state.kind === "error" && <p id="headshot-upload-error" className="mt-2 text-sm text-red-700" role="alert">{state.message}</p>}
    </div>
  );
}
