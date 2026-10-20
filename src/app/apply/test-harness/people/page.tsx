import { notFound } from "next/navigation";
import PeopleWorkspace from "@/app/admin/people/people-workspace";
import { PeopleControls } from "@/app/admin/rush-controls";
import HarnessReady from "../harness-ready";

export const dynamic = "force-dynamic";
export default function PeopleTestHarness() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return <main className="workspace-stack mx-auto flex max-w-5xl flex-col"><h1 className="mb-5 text-xl font-semibold">Synthetic owner verification</h1><PeopleWorkspace directoryCount={0} onboardingCount={0} duplicateAccountCount={0} directory={<p>Synthetic directory.</p>} onboarding={<p>Synthetic onboarding.</p>} access={<PeopleControls cycleId="synthetic-owner-cycle" currentUserId="synthetic-owner" memberAccounts={[]} />} /><HarnessReady /></main>;
}
