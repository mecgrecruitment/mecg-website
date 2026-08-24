import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentDestination, currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationDraft } from "@/lib/workflow";
import LogoutButton from "@/components/logout-button";
import ApplicantSignupForm from "./applicant-signup-form";
import ApplicationForm from "./application-form";

type IntakeSchema = { open?: boolean; cycleName?: string | null; questions?: { key: string; prompt: string; inputType: string; required: boolean }[]; draft?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseIntakeSchema(value: unknown): IntakeSchema | null {
  if (!isRecord(value)) return null;
  const questions = Array.isArray(value.questions)
    ? value.questions.flatMap((question) => {
        if (!isRecord(question) || typeof question.key !== "string" || typeof question.prompt !== "string") return [];
        return [{ key: question.key, prompt: question.prompt, inputType: typeof question.inputType === "string" ? question.inputType : "long_text", required: question.required === true }];
      })
    : [];
  return {
    open: value.open === true,
    cycleName: typeof value.cycleName === "string" ? value.cycleName : null,
    questions,
    draft: value.draft,
  };
}

export default async function ApplyPage() {
  const destination = await currentDestination();
  if (destination && destination !== "/apply") redirect(destination);
  const user = destination === "/apply" ? await currentUser() : null;
  const supabase = user ? await createClient() : null;
  const { data: intake } = supabase ? await supabase.rpc("intake_schema") : { data: null };
  const schema = parseIntakeSchema(intake);
  const draft = parseApplicationDraft(schema?.draft);

  return (
    <main className="min-h-dvh bg-[#f5f4ef] text-mecg-navy">
      <header className="border-b border-mecg-navy/8 bg-white px-6 py-3 sm:px-10">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4">
          <Link href="/home" className="flex min-h-11 items-center rounded-sm" aria-label="MECG home">
            <Image
              src="/logos/mecg-color.svg"
              alt="MECG"
              width={150}
              height={45}
              priority
              className="h-10 w-auto"
              style={{ width: "auto" }}
            />
          </Link>
          <div className="flex min-h-11 items-center gap-4 text-sm">
            <span className="hidden text-mecg-navy/45 sm:inline">{user ? user.email : "Applicant portal"}</span>
            {user ? (
              <LogoutButton />
            ) : (
              <Link href="/login" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className={`mx-auto px-6 py-10 sm:px-10 sm:py-14 ${user ? "max-w-7xl" : "max-w-2xl"}`}>
        <div className={`flex flex-wrap items-end justify-between gap-5 ${user ? "" : "text-center"}`}>
          <div className={user ? "" : "mx-auto"}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">Application intake</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Apply to MECG.</h1>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-mecg-navy/55">
              {user
                ? "Your work saves automatically. Take your time, review everything, then submit once."
                : "Create an account and verify your email to begin the application."}
            </p>
          </div>
          {user && (
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              Applications open · About 15 minutes
            </div>
          )}
        </div>

        {user ? (
          <ApplicationForm
            initialName={user.name}
            email={user.email}
            cycleOpen={schema?.open === true}
            cycleName={schema?.cycleName ?? null}
            questions={schema?.questions ?? []}
            initialDraft={draft}
          />
        ) : (
          <div className="mx-auto mt-8 max-w-xl rounded-[28px] bg-white p-7 text-left shadow-[0_24px_80px_rgba(7,13,31,0.09)] sm:p-9">
            <ApplicantSignupForm />
          </div>
        )}
      </div>
    </main>
  );
}
