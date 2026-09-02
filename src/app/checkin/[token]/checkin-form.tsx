"use client";

import Link from "next/link";
import { useState } from "react";
import OperationNotice from "@/components/operation-notice";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export default function CheckinForm({ token, signedIn }: { token: string; signedIn: boolean }) {
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
      setErrorMessage("Something went wrong");
      setUnauthorized(false);
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="rounded-xl bg-green-50 p-5 text-sm text-green-800">You&apos;re checked in. See you there!</p>;
  }
  if (status === "already") {
    return <p className="rounded-xl bg-mecg-blue/10 p-5 text-sm text-mecg-navy">You&apos;re already checked in for this event.</p>;
  }

  // Told up front, not after a failed submit: at a table with a queue behind you,
  // a 401 you only discover on tap is a drop-off.
  if (!signedIn) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-mecg-navy/65">Check-in uses your MECG account. Create one or sign in and you will come straight back here.</p>
        <Link href={`/apply?redirect_url=${returnTo}`} className="button-primary flex w-full items-center justify-center">Create an account</Link>
        <Link href={`/login?redirect_url=${returnTo}`} className="button-secondary flex w-full items-center justify-center">I already have an account</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-6 text-mecg-navy/65">Check-in uses your signed-in applicant account.</p>
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
        {status === "submitting" ? "Checking in…" : "Check in"}
      </button>
    </form>
  );
}
