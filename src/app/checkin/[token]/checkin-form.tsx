"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export default function CheckinForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact }),
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
    return <p className="text-green-700">You&apos;re checked in. See you there!</p>;
  }
  if (status === "already") {
    return <p className="text-blue-700">You&apos;re already checked in for this event.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-xs">
      <input
        type="text"
        placeholder="Full name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border rounded px-3 py-2"
      />
      <input
        type="text"
        placeholder="Email or phone"
        required
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="border rounded px-3 py-2"
      />
      {status === "error" && <p className="text-red-600 text-sm">{errorMessage}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {status === "submitting" ? "Checking in..." : "Check in"}
      </button>
    </form>
  );
}
