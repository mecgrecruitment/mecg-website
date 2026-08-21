"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          checkinOpensAt: opensAt,
          checkinClosesAt: closesAt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id || !data?.checkinToken) {
        setError(data?.error ?? "Something went wrong");
        return;
      }
      router.push(`/admin/events/${data.id}?token=${encodeURIComponent(data.checkinToken)}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 p-8 max-w-md mx-auto w-full flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New event</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </label>
        <p className="rounded bg-gray-50 p-3 text-sm text-gray-600">
          Attendance is tracked for operations and does not affect applicant rankings.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Check-in opens at
          <input
            type="datetime-local"
            required
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Check-in closes at
          <input
            type="datetime-local"
            required
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create event"}
        </button>
      </form>
    </main>
  );
}
