import { notFound } from "next/navigation";
import ApplicationForm from "../application-form";

export const dynamic = "force-dynamic";

export default function ApplicationTestHarnessPage() {
  if (process.env.PLAYWRIGHT_APPLICATION_HARNESS !== "1" || process.env.E2E_LOCAL_HTTP !== "1") notFound();
  return (
    <main className="min-h-dvh bg-mecg-paper-workspace p-6 text-mecg-navy">
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
          name: "Ada Applicant",
          preferredName: "Ada",
          phone: "",
          classYear: "JUNIOR",
          major: "Computer Science",
          college: "Engineering",
          uniqname: "adaapplicant",
          gradTerm: "Winter 2028",
          accessibilityNotes: "",
          linkedinUrl: "",
          answers: { motivation: "I want to solve hard problems with a thoughtful team." },
          resumeStoragePath: "00000000-0000-0000-0000-000000000001/e2e-cycle/resume.pdf",
          currentStep: "details",
        }}
        initialHasHeadshot={false}
        headshotSupported={false}
      />
    </main>
  );
}
