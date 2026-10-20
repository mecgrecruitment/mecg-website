import { notFound } from "next/navigation";
import RubricEditor from "@/app/admin/rounds/rubric-editor";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function RubricTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-3xl p-6"><h1 className="mb-4 text-2xl font-semibold">Synthetic rubric verification</h1><RubricEditor round={{ cycleId: "synthetic-rubric-cycle", roundId: "synthetic-rubric-round", roundName: "Synthetic round", roundStatus: "DRAFT", rubricVersion: 1, criteria: [
    { key: "analysis", name: "Analysis", description: "Explain the evidence.", weight: 50, required: true },
    { key: "clarity", name: "Clarity", description: "Communicate the recommendation.", weight: 50, required: true },
  ] }} /><HarnessReady /></main>;
}
