import { notFound } from "next/navigation";
import { OfferDeadlineForm } from "@/app/admin/decision-form";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function OfferDeadlineHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="mx-auto max-w-xl p-6"><h1 className="mb-5 text-xl font-semibold">Synthetic offer deadline verification</h1><OfferDeadlineForm applicationId="synthetic-offer" current="2030-09-10T20:00:00.000Z" /><HarnessReady /></main>;
}
