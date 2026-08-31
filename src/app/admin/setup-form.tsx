"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("Fall 2026 Rush");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not create cycle");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-5 flex flex-col gap-3 max-w-md">
      <h2 className="font-semibold">Create the first rush cycle</h2>
      <p className="text-sm text-gray-600">
        This also creates the approved Speed Dating and Group Case rubrics.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Cycle name
        <input
          className="rounded border px-3 py-2 font-normal"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="rounded bg-slate-950 px-4 py-2 text-white" disabled={pending}>
        {pending ? "Creating…" : "Create cycle"}
      </button>
    </form>
  );
}
