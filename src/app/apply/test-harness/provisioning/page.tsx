import { notFound } from "next/navigation";
import ResolveButton from "@/app/admin/provisioning/resolve-button";
import HarnessReady from "../harness-ready";
export const dynamic = "force-dynamic";
export default function ProvisioningHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-xl space-y-5 p-6 text-mecg-navy">
    <h1 className="text-2xl font-semibold">Synthetic account recovery</h1>
    <p className="text-sm text-mecg-navy/70">Local test fixture only. The response is intercepted; no account is changed.</p>
    <ResolveButton incidentId="65000000-0000-4000-8000-000000000001" />
    <HarnessReady />
  </main>;
}
