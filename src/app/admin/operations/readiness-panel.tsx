"use client";

import { useEffect, useState } from "react";
import { formatEasternDateTime } from "@/lib/date-time";
import { authorizedFetch } from "@/lib/client-fetch";

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

const LABELS = {
  publicSupabase: "Public Supabase configuration",
  serviceRole: "Server administration key",
  resend: "Recruitment email",
  contactRecipient: "Contact recipient",
  cronSecret: "Scheduled-job secret",
} satisfies Record<keyof Readiness["configuration"], string>;

const CONFIGURATION_KEYS = ["publicSupabase", "serviceRole", "resend", "contactRecipient", "cronSecret"] as const;

async function requestReadiness(): Promise<Readiness> {
  const response = await authorizedFetch("/api/admin/operations", { cache: "no-store" });
  const body = await response.json();
  if (![200, 503].includes(response.status)) throw new Error(body?.error ?? "Could not check operations");
  return body as Readiness;
}

export default function ReadinessPanel() {
  const [result, setResult] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    setPending(true);
    try {
      setResult(await requestReadiness());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not check operations");
    } finally {
      setPending(false);
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

  if (!result && !error) return <p role="status" className="text-sm text-muted">Checking database access and required configuration…</p>;
  if (error && !result) {
    return (
      <div className="rounded-xl border border-red-200 bg-danger-wash p-5 text-danger" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => void load()} disabled={pending} aria-busy={pending} className="button-secondary mt-4">{pending ? "Checking…" : "Try again"}</button>
      </div>
    );
  }
  if (!result) return null;

  const checks: Array<[string, boolean, string]> = [
    ["Database access", result.database.ok, result.database.ok ? `Responded in ${result.database.latencyMs} ms` : "Database check failed. Check database availability and server credentials."],
    ...CONFIGURATION_KEYS.map((key): [string, boolean, string] => [LABELS[key], result.configuration[key], result.configuration[key] ? "Configured" : "Missing. Ask the deployment owner to check this configuration."]),
  ];

  return (
    <div className="space-y-5">
      <div className={`rounded-xl p-5 ${result.ready ? "bg-success-wash text-success" : "bg-danger-wash text-danger"}`} role="status">
        <p className="font-semibold">{result.ready ? "Required configuration checks passed." : "Required configuration checks need attention."}</p>
        <p className="mt-1 text-sm opacity-75">Checked {formatEasternDateTime(result.checkedAt)}</p>
      </div>
      <p className="text-sm text-muted">These checks cover database access and required configuration. Email provider acceptance, inbox delivery and recruitment readiness require separate verification.</p>
      {error && <p role="alert" className="text-sm text-danger">Could not refresh checks: {error} The previous result above has not been updated.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {checks.map(([label, ok, detail]) => (
          <li key={label} className="rounded-xl bg-white p-4 inset-ring inset-ring-line">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-mecg-navy">{label}</span>
              <span className={`text-[13px] font-semibold ${ok ? "text-success" : "text-danger"}`}>{ok ? "Passed" : "Needs attention"}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{detail}</p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void load()} disabled={pending} aria-busy={pending} className="button-secondary">{pending ? "Checking…" : "Run check again"}</button>
    </div>
  );
}
