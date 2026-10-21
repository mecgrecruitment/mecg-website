"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OperationNotice from "@/components/operation-notice";
import { authorizedFetch } from "@/lib/client-fetch";

export default function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("Fall 2026 Rush");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await authorizedFetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Could not create cycle");
        return;
      }
      setSuccess("Rush cycle created. Loading the board workspace…");
      router.refresh();
    } catch {
      setError("Could not create cycle. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3 rounded-xl p-5 inset-ring inset-ring-line">
      <h2 className="font-semibold">Create the first rush cycle</h2>
      <p className="text-sm text-gray-600">
        This also creates the approved scoring guides for quick chats and group interviews.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Cycle name
        <input
          className="field-control font-normal"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <OperationNotice kind="error">{error}</OperationNotice>
      <OperationNotice kind="success">{success}</OperationNotice>
      <button type="submit" className="button-primary" disabled={pending}>
        {pending ? "Creating…" : "Create cycle"}
      </button>
    </form>
  );
}
