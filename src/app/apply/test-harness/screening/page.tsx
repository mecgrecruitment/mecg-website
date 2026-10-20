import { notFound } from "next/navigation";
import ScreeningReviewForm from "@/app/member/screening/[assignmentId]/screening-review-form";
import ScreeningReadingDesk from "@/app/member/screening/[assignmentId]/screening-reading-desk";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function ScreeningTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-private workspace-stack mx-auto flex w-full min-w-0 max-w-7xl flex-col">
    <header><h1 className="text-2xl font-semibold">Synthetic screening verification</h1><p>Fictional responses for local interaction checks.</p></header>
    <ScreeningReadingDesk reader={<section><h2 className="font-semibold">Synthetic written response</h2><p className="mt-3">I explained a decision using observations from a fictional project and described how I changed my approach after feedback.</p></section>} scorer={<section><ScreeningReviewForm assignmentId="synthetic-screening" criteria={[
      { id: "analysis", key: "analysis", name: "Analysis", description: "Use observable written evidence.", weight: 60, required: true },
      { id: "clarity", key: "clarity", name: "Clarity", description: "Explain the reasoning clearly.", weight: 40, required: true },
    ]} /></section>} />
    <HarnessReady />
  </main>;
}
