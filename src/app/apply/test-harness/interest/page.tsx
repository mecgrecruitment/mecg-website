import { notFound } from "next/navigation";
import InterestForm from "@/app/(marketing)/join/interest-form";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function InterestTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="min-h-dvh bg-mecg-navy p-6"><h1 className="text-xl text-white">Synthetic recruitment interest verification</h1><InterestForm /><HarnessReady /></main>;
}
