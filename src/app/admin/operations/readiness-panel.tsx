"use client";

import { useEffect, useState } from "react";
import { formatEasternDateTime } from "@/lib/date-time";

type Readiness = {
  ready: boolean;
  checkedAt: string;
  database: { ok: boolean; latencyMs: number };
  configuration: {
    publicSupabase: boolean;
    serviceRole: boolean;
    resend: boolean;
    contactRecipient: boolean;
    cronSecret: boolean;
  };
};

const LABELS: Record<keyof Readiness["configuration"], string> = {
  publicSupabase: "Public Supabase configuration",
  serviceRole: "Server administration key",
  resend: "Recruitment email",
  contactRecipient: "Contact recipient",
  cronSecret: "Scheduled-job secret",
};

async function requestReadiness(): Promise<Readiness> {
  const response = await fetch("/api/admin/operations", { cache: "no-store" });
  const body = await response.json();
  if (![200, 503].includes(response.status)) throw new Error(body?.error ?? "Could not check operations");
  return body as Readiness;
}

export default function ReadinessPanel() {
  const [result, setResult] = useState<Readiness | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setResult(await requestReadiness());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not check operations");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void requestReadiness()
      .then((body) => { if (!cancelled) setResult(body); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not check operations");
      });
    return () => { cancelled = true; };
  }, []);

  if (!result && !error) return <p role="status" className="text-sm text-mecg-navy/65">Checking production dependencies…</p>;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => void load()} className="button-secondary mt-4">Try again</button>
      </div>
    );
  }
  if (!result) return null;

  const checks = [
    ["Database", result.database.ok, `${result.database.latencyMs} ms`],
    ...Object.entries(result.configuration).map(([key, ok]) => [LABELS[key as keyof Readiness["configuration"]], ok, ok ? "Configured" : "Missing"]),
  ] as Array<[string, boolean, string]>;

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl p-5 ${result.ready ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`} role="status">
        <p className="font-semibold">{result.ready ? "Production dependencies are ready." : "Production dependencies need attention."}</p>
        <p className="mt-1 text-sm opacity-75">Checked {formatEasternDateTime(result.checkedAt)}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {checks.map(([label, ok, detail]) => (
          <li key={label} className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-mecg-navy">{label}</span>
              <span className={`font-mono text-xs font-semibold uppercase tracking-[0.08em] ${ok ? "text-emerald-800" : "text-red-700"}`}>{ok ? "Ready" : "Action"}</span>
            </div>
            <p className="mt-2 text-sm text-mecg-navy/65">{detail}</p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void load()} className="button-secondary">Run check again</button>
    </div>
  );
}
