"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function SignOutAction({ signOut, className, onComplete }: { signOut: () => Promise<unknown>; className: string; onComplete?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (error && !busy) button.current?.focus();
  }, [error, busy]);

  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    let timer: number | undefined;
    try {
      await Promise.race([
        signOut(),
        new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("Sign-out acknowledgement timed out")), 15_000); }),
      ]);
      onComplete?.();
    } catch {
      setError("Sign-out could not be confirmed. Retry, or reload to check your session.");
    } finally {
      window.clearTimeout(timer);
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <span className="inline-flex min-w-0 flex-col items-start">
    <button ref={button} type="button" onClick={() => void logout()} disabled={busy} aria-describedby={error ? errorId : undefined} className={`${className} disabled:cursor-wait disabled:opacity-50 disabled:scale-100`}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
    {error && <span id={errorId} role="alert" className="mt-2 max-w-64 text-sm font-normal leading-5">{error}</span>}
  </span>;
}
