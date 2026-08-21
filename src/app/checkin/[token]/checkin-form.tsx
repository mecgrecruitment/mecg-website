"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export default function CheckinForm({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
        setStatus("error");
        return;
      }
      setStatus(data.alreadyCheckedIn ? "already" : "success");
    } catch {
      setErrorMessage("Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="rounded-xl bg-green-50 p-5 text-sm text-green-800">You&apos;re checked in. See you there!</p>;
  }
  if (status === "already") {
    return <p className="rounded-xl bg-mecg-blue/10 p-5 text-sm text-mecg-navy">You&apos;re already checked in for this event.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-mecg-navy/60">Check-in uses your signed-in applicant account.</p>
      {status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorMessage}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Checking in..." : "Check in"}
      </button>
    </form>
  );
}
