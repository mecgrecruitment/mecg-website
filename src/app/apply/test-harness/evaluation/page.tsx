import { notFound } from "next/navigation";
import EvaluationForm from "@/app/member/evaluation-form";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function EvaluationTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">Synthetic evaluation verification</h1><EvaluationForm assignmentId="synthetic-evaluation" minimumObservedCriteria={2} criteria={[
    { id: "analysis", name: "Analysis", description: "Use observed evidence.", weight: 50, required: true },
    { id: "clarity", name: "Clarity", description: "Communicate the recommendation.", weight: 50, required: true },
  ]} /><HarnessReady /></main>;
}
