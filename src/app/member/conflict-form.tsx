"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConflictForm({ applications }: { applications: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/member/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: data.get("applicationId"), reason: data.get("reason") }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error ?? "Could not declare conflict"); else { event.currentTarget.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="rounded-xl border p-5"><h2 className="font-semibold">Declare a conflict</h2><p className="mt-1 text-sm text-gray-600">This immediately recuses you from the applicant and any unfinished assignment.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select name="applicationId" required className="rounded border px-3 py-2"><option value="">Applicant</option>{applications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}</select><input name="reason" required placeholder="Relationship or conflict" className="min-w-56 flex-1 rounded border px-3 py-2" /><button className="rounded bg-slate-950 px-4 py-2 text-white">Declare</button></div>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}</form>;
}
