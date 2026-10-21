import { notFound } from "next/navigation";
import ApplicationForm from "../application-form";
import { gradTermBaseYear } from "@/lib/grad-term";
import HarnessReady from "./harness-ready";

export const dynamic = "force-dynamic";

export default async function ApplicationTestHarnessPage({ searchParams }: { searchParams: Promise<{ headshot?: string; draft?: string }> }) {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  const { headshot, draft } = await searchParams;
  return (
    <main className="min-h-dvh bg-paper p-6 text-mecg-navy">
      <ApplicationForm
        initialName="Ada Applicant"
        email="ada@example.com"
        userId="00000000-0000-0000-0000-000000000001"
        cycleOpen
        preOpenLabel={null}
        cycleId="e2e-cycle"
        cycleName="E2E Cycle"
        questions={[{
          key: "motivation",
          prompt: "Why MECG?",
          inputType: "long_text",
          required: true,
          options: [],
          maxWords: 100,
        }]}
        initialDraft={{
          name: draft === "newer" ? "Ada Saved" : "Ada Applicant",
          preferredName: "Ada",
          phone: "",
          classYear: "JUNIOR",
          major: "Computer Science",
          college: "Engineering",
          uniqname: "adaapplicant",
          gradTerm: "Winter 2028",
          accessibilityNotes: "",
          linkedinUrl: "",
          answers: { motivation: draft === "newer" ? "Newer answer saved on another device." : "I want to solve hard problems with a thoughtful team." },
          resumeStoragePath: "00000000-0000-0000-0000-000000000001/e2e-cycle/resume.pdf",
          currentStep: "details",
        }}
        initialRevision="10000000-0000-4000-8000-000000000001"
        initialHasHeadshot={false}
        headshotSupported={headshot === "required"}
        gradBaseYear={gradTermBaseYear(new Date())}
      />
      <HarnessReady />
    </main>
  );
}
