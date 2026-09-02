import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ApplicationCountdown from "@/components/application-countdown";
import LogoutButton from "@/components/logout-button";
import OperationNotice from "@/components/operation-notice";
import { currentDestination, currentUser } from "@/lib/auth";
import { hasClerkRuntimeConfiguration } from "@/lib/env";
import {
  applicationCycleStatus,
  fetchPublicRecruitment,
  isBeforeApplicationOpen,
} from "@/lib/public-recruitment";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationDraft } from "@/lib/workflow";
import ApplicantSignupForm from "./applicant-signup-form";
import ApplicationForm from "./application-form";

export const metadata: Metadata = { title: "Apply" };

type IntakeQuestion = { key: string; prompt: string; inputType: string; required: boolean; options: string[] };
type IntakeSchema = { open?: boolean; needsInfo?: boolean; cycleName?: string | null; questions?: IntakeQuestion[]; draft?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptions(value: unknown) {
  if (!Array.isArray(value) || value.length > 50) return [];
  const options: string[] = [];
  for (const option of value) {
    if (typeof option !== "string" || !option.trim() || option.trim().length > 200) return [];
    if (!options.includes(option.trim())) options.push(option.trim());
  }
  return options;
}

// Returns null for anything malformed. A dropped question row would let an applicant submit with no
// written responses at all, so a bad row fails the whole page loudly instead.
function parseIntakeSchema(value: unknown): IntakeSchema | null {
  if (!isRecord(value)) return null;
  const questions: IntakeQuestion[] = [];
  if (value.questions !== undefined) {
    if (!Array.isArray(value.questions)) return null;
    for (const question of value.questions) {
      if (!isRecord(question) || typeof question.key !== "string" || !question.key || typeof question.prompt !== "string" || !question.prompt) return null;
      questions.push({ key: question.key, prompt: question.prompt, inputType: typeof question.inputType === "string" ? question.inputType : "long_text", required: question.required === true, options: parseOptions(question.options) });
    }
  }
  return {
    open: typeof value.open === "boolean" ? value.open : undefined,
    needsInfo: value.needsInfo === true,
    cycleName: typeof value.cycleName === "string" ? value.cycleName : null,
    questions,
    draft: value.draft,
  };
}

export default async function ApplyPage() {
  const clerkConfigured = hasClerkRuntimeConfiguration();
  const destination = await currentDestination();
  if (destination && destination !== "/apply") redirect(destination);
  const user = destination === "/apply" ? await currentUser() : null;
  const recruitment = user ? null : await fetchPublicRecruitment();
  const cycleStatus = recruitment?.cycle ? applicationCycleStatus(recruitment.cycle) : null;
  const upcomingCycle = recruitment?.cycle && isBeforeApplicationOpen(recruitment.cycle) ? recruitment.cycle : null;
  const supabase = user ? await createClient() : null;
  const [{ data: intake, error: intakeError }, { data: hasPastApplication }] = supabase
    ? await Promise.all([supabase.rpc("intake_schema"), supabase.rpc("is_applicant")])
    : [{ data: null, error: null }, { data: false }];
  if (intakeError) console.error("intake_schema failed", intakeError);
  const schema = intakeError ? null : parseIntakeSchema(intake);
  // A failed or malformed schema is not the same thing as a closed cycle; never say "closed" for it.
  const schemaUnavailable = Boolean(user) && !schema;
  if (schemaUnavailable && !intakeError) console.error("intake_schema returned an unusable payload", intake);
  const draft = parseApplicationDraft(schema?.draft);

  return (
    <main className="min-h-dvh bg-mecg-paper-workspace text-mecg-navy">
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
            <span className="hidden text-mecg-navy/60 sm:inline">{user ? user.email : "Applicant portal"}</span>
            {user && hasPastApplication === true && (
              <Link href="/applicant" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
                Past applications
              </Link>
            )}
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
                : cycleStatus && !cycleStatus.isOpen
                  ? cycleStatus.detail
                  : "Create an account and verify your email to begin the application."}
            </p>
            {!user && upcomingCycle?.opensAt ? <ApplicationCountdown opensAt={upcomingCycle.opensAt} /> : null}
          </div>
          {user && !schemaUnavailable && typeof schema?.open === "boolean" && (
            <div className={`rounded-sm px-4 py-2 text-sm font-semibold ${schema.open ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {schema.open ? "Applications open · About 15 minutes" : "Applications closed"}
            </div>
          )}
        </div>

        {user && schema?.needsInfo === true && (
          <div className="mt-5">
            <OperationNotice kind="info">The board asked for a bit more before deciding — please review and resubmit below.</OperationNotice>
          </div>
        )}

        {user && schemaUnavailable ? (
          <div className="mt-5">
            <OperationNotice kind="error">
              The application could not be loaded right now. This is not the same as applications being closed. Reload in
              a moment, and email mecg-board@umich.edu if it keeps happening.
            </OperationNotice>
          </div>
        ) : user ? (
          <ApplicationForm
            initialName={user.name}
            email={user.email}
            cycleOpen={schema?.open === true}
            cycleName={schema?.cycleName ?? null}
            questions={schema?.questions ?? []}
            initialDraft={draft}
          />
        ) : clerkConfigured ? (
          <div className="surface-card mx-auto mt-8 max-w-xl bg-white p-7 text-left sm:p-9">
            <ApplicantSignupForm />
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-xl">
            <OperationNotice kind="error">
              Account creation is temporarily unavailable because authentication is not configured on this deployment. No credentials were accepted or transmitted. Contact <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you need help.
            </OperationNotice>
          </div>
        )}
      </div>
    </main>
  );
}
