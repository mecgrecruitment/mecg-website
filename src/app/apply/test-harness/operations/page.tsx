import { notFound } from "next/navigation";
import { RoundControls } from "@/app/admin/rush-controls";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";

export default async function OperationsTestHarnessPage({ searchParams }: { searchParams: Promise<{ manage?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { manage } = await searchParams;
  return <main className="min-h-dvh bg-paper p-4 text-mecg-navy sm:p-8">
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-semibold">Synthetic operator verification</h1>
      <p className="mb-6 text-sm text-muted">Local harness only. Counts and actions use intercepted synthetic HTTP responses; no real round is changed.</p>
      <RoundControls canManageStatus={manage !== "no"} cycleId="synthetic-operator-cycle" rounds={[{ id: "synthetic-group-case", label: "Group Case", status: "ACTIVE" }]} memberAccounts={[]} applications={[]} assignments={[]} assignable={false} />
      <HarnessReady />
    </div>
  </main>;
}
