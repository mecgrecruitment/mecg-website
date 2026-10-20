import { notFound } from "next/navigation";
import { ReleaseButton } from "@/app/admin/decision-form";
import HarnessReady from "../harness-ready";
export const dynamic = "force-dynamic";
export default function OperatorWritesHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-xl p-6"><h1 className="mb-5 text-xl font-semibold">Synthetic individual release verification</h1><ReleaseButton decisionId="synthetic-decision" /><HarnessReady /></main>;
}
