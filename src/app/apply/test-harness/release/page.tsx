import { notFound } from "next/navigation";
import { ReleaseAllButton } from "@/app/admin/decision-form";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default async function ReleaseTestHarness({ searchParams }: { searchParams: Promise<{ large?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { large } = await searchParams;
  return <main className="mx-auto max-w-xl p-6"><h1 className="mb-5 text-xl font-semibold">Synthetic release verification</h1><ReleaseAllButton cycleId="synthetic-release-cycle" lockedCount={large === "1" ? 500 : 1} /><HarnessReady /></main>;
}
