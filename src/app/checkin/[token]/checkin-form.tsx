"use client";

import Link from "next/link";
import { useState } from "react";
import OperationNotice from "@/components/operation-notice";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export default function CheckinForm({ token, eventName, signedIn, identityUnavailable }: { token: string; eventName: string; signedIn: boolean; identityUnavailable: boolean }) {
  const returnTo = encodeURIComponent(`/checkin/${token}`);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong");
        setUnauthorized(res.status === 401);
        setStatus("error");
        return;
      }
      setStatus(data.alreadyCheckedIn ? "already" : "success");
    } catch {
      setErrorMessage("We could not confirm the result. It is safe to try again. If the first request succeeded, you will see that you are already checked in.");
      setUnauthorized(false);
      setStatus("error");
    }
  }

  if (identityUnavailable) {
    return (
      <OperationNotice kind="error">
        Sign-in status is temporarily unavailable. Ask an MECG Board Member to record an assisted check-in so you do not have to wait here.
      </OperationNotice>
    );
  }

  if (status === "success") {
    return (
      <div className="rounded-xl bg-success-wash p-5 text-success" role="status">
        <p className="font-semibold">You&apos;re checked in for {eventName}.</p>
        <p className="mt-1 text-sm text-success">You are all set. Your schedule and application updates stay in the applicant portal.</p>
        <Link href="/applicant" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          View your schedule
        </Link>
      </div>
    );
  }
  if (status === "already") {
    return (
      <div className="rounded-xl bg-mecg-blue/10 p-5 text-mecg-navy" role="status">
        <p className="font-semibold">You&apos;re already checked in for {eventName}.</p>
        <Link href="/applicant" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
          View your schedule
        </Link>
      </div>
    );
  }

  // Told up front, not after a failed submit: at a table with a queue behind you,
  // a 401 you only discover on tap is a drop-off.
  if (!signedIn) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-muted">Check-in uses your MECG account. Create one or sign in and you will come straight back here.</p>
        <Link href={`/apply?redirect_url=${returnTo}`} className="button-primary flex w-full items-center justify-center">Create an account</Link>
        <Link href={`/login?redirect_url=${returnTo}`} className="button-secondary flex w-full items-center justify-center">I already have an account</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-6 text-muted">Check-in uses your signed-in applicant account.</p>
      {status === "error" && (
        <OperationNotice kind="error">
          {errorMessage}
          {unauthorized && (
            <>
              {" "}
              <Link href={`/login?redirect_url=${returnTo}`} className="font-semibold underline underline-offset-2">Sign in</Link> and try again.
            </>
          )}
        </OperationNotice>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Checking in…" : status === "error" ? "Try check-in again" : "Check in"}
      </button>
    </form>
  );
}
