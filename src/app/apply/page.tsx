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
  formatRecruitmentTime,
  isBeforeApplicationOpen,
} from "@/lib/public-recruitment";
import { createClient } from "@/lib/supabase/server";
import ApplicantSignupForm from "./applicant-signup-form";
import ApplicationForm from "./application-form";
import { parseApplicationDraftSnapshot } from "./application-server-draft";
import { isMissingSchemaObject } from "@/lib/schema-availability";
import { gradTermBaseYear } from "@/lib/grad-term";

export const metadata: Metadata = { title: "Apply" };

type IntakeQuestion = { key: string; prompt: string; inputType: string; required: boolean; options: string[]; maxWords: number | null };
type IntakeSchema = { open?: boolean; needsInfo?: boolean; cycleId?: string | null; cycleName?: string | null; questions?: IntakeQuestion[]; draft?: unknown };
const INPUT_TYPES = new Set(["short_text", "long_text", "url", "select"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const options: string[] = [];
  for (const option of value) {
    if (typeof option !== "string" || !option.trim() || option.trim().length > 200) return null;
    if (!options.includes(option.trim())) options.push(option.trim());
  }
  return options;
}

// Returns null for anything malformed. A dropped question row would let an applicant submit with no
// written responses at all, so a bad row fails the whole page loudly instead.
function parseIntakeSchema(value: unknown): IntakeSchema | null {
  if (!isRecord(value) || typeof value.open !== "boolean") return null;
  const questions: IntakeQuestion[] = [];
  if (value.questions !== undefined) {
    if (!Array.isArray(value.questions)) return null;
    for (const question of value.questions) {
      if (!isRecord(question) || typeof question.key !== "string" || !question.key || typeof question.prompt !== "string" || !question.prompt) return null;
      if (typeof question.inputType !== "string" || !INPUT_TYPES.has(question.inputType)) return null;
      const options = parseOptions(question.options);
      if (!options || (question.inputType === "select" && options.length === 0)) return null;
      const maxWords = question.maxWords == null
        ? null
        : typeof question.maxWords === "number" && Number.isInteger(question.maxWords) && question.maxWords >= 1 && question.maxWords <= 2000
          ? question.maxWords
          : undefined;
      if (maxWords === undefined) return null;
      questions.push({ key: question.key, prompt: question.prompt, inputType: question.inputType, required: question.required === true, options, maxWords });
    }
  }
  return {
    open: typeof value.open === "boolean" ? value.open : undefined,
    needsInfo: value.needsInfo === true,
    cycleId: typeof value.cycleId === "string" ? value.cycleId : null,
    cycleName: typeof value.cycleName === "string" ? value.cycleName : null,
    questions,
    draft: value.draft,
  };
}

export default async function ApplyPage() {
  const clerkConfigured = hasClerkRuntimeConfiguration();
  let authUnavailable = false;
  // An unverified primary email throws like an outage but is not one: the
  // applicant has to act, and "reload in a moment" would never come true.
  let emailUnverified = false;
  const isEmailUnverified = (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "EMAIL_UNVERIFIED";
  let destination: Awaited<ReturnType<typeof currentDestination>> = null;
  try { destination = await currentDestination(); } catch (error) {
    if (isEmailUnverified(error)) emailUnverified = true;
    else authUnavailable = true;
  }
  if (destination && destination !== "/apply") redirect(destination);
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  if (!authUnavailable && !emailUnverified && destination === "/apply") {
    try { user = await currentUser(); } catch (error) {
      if (isEmailUnverified(error)) emailUnverified = true;
      else authUnavailable = true;
    }
  }
  const supabase = user ? await createClient() : null;
  // Signed-in applicants need the cycle window too: intake_schema reports
  // open:false for the whole period before opens_at, which is indistinguishable
  // from a closed cycle without it. Fetched alongside the RPCs, not before them,
  // so the extra anon call costs nothing on the wall clock.
  const [recruitment, { data: intake, error: intakeError }, { data: hasPastApplication }, { data: hasHeadshot, error: headshotError }] = await Promise.all([
    fetchPublicRecruitment(),
    supabase ? supabase.rpc("intake_schema") : Promise.resolve({ data: null, error: null }),
    supabase ? supabase.rpc("is_applicant") : Promise.resolve({ data: false }),
    // The photo is stored outside the draft row, so the form has no other way to
    // know a returning applicant already uploaded one and would re-block the step.
    supabase ? supabase.rpc("my_headshot") : Promise.resolve({ data: false, error: null }),
  ]);
  const cycleStatus = recruitment?.cycle ? applicationCycleStatus(recruitment.cycle) : null;
  const upcomingCycle = recruitment?.cycle && isBeforeApplicationOpen(recruitment.cycle) ? recruitment.cycle : null;
  if (intakeError) console.error("intake_schema failed", intakeError);
  const schema = intakeError ? null : parseIntakeSchema(intake);
  // A failed or malformed schema is not the same thing as a closed cycle; never say "closed" for it.
  const snapshot = parseApplicationDraftSnapshot(schema?.draft);
  const schemaUnavailable = Boolean(user) && (!schema || (schema.draft != null && !snapshot));
  if (schemaUnavailable && !intakeError) console.error("intake_schema returned an unusable payload");
  const draft = snapshot?.draft ?? null;
  // Before opens_at the cycle is OPEN, it just has not started, and intake_schema
  // still says open:false. Telling that applicant "Applications closed" sends
  // someone who signed up at 19:45 home fifteen minutes early.
  const openingTimelineUnavailable = schema?.open === false && recruitment.kind === "unavailable";
  const preOpenLabel = upcomingCycle?.opensAt ? `Applications open at ${formatRecruitmentTime(upcomingCycle.opensAt)}` : null;

  return (
    <main className="application-intake min-h-dvh bg-paper text-mecg-navy">
      <header className="border-b border-line bg-white px-6 py-3 sm:px-10">
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
            <span className="hidden text-muted sm:inline">{user ? user.email : "Applicant portal"}</span>
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
        {/* items-start, not items-end: the left column grows tall once the countdown
            mounts under the heading, and bottom-aligning left the status pill stranded
            in whitespace at the far right, level with nothing. Top alignment reads it
            against the eyebrow, which is what a status pill is for. */}
        <div className={`flex flex-wrap items-start justify-between gap-5 ${user ? "" : "text-center"}`}>
          <div className={user ? "" : "mx-auto"}>
            <p className="text-[13px] font-semibold text-mecg-blue">Application intake</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Apply to MECG.</h1>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-muted">
              {user
                ? "Your work saves automatically. Take your time, review everything, then submit once."
                : cycleStatus && !cycleStatus.isOpen
                  ? cycleStatus.detail
                  : "Create an account to begin the application."}
            </p>
            {upcomingCycle?.opensAt ? <ApplicationCountdown opensAt={upcomingCycle.opensAt} /> : null}
          </div>
          {user && !schemaUnavailable && (typeof schema?.open === "boolean" || preOpenLabel) && (
            <div className={`rounded-sm px-4 py-2 text-sm font-semibold ${schema?.open ? "bg-success-wash text-success" : preOpenLabel ? "bg-warning-wash text-warning" : "bg-danger-wash text-danger"}`}>
              {schema?.open ? "Applications open · About 15 minutes" : preOpenLabel ?? (openingTimelineUnavailable ? "Not accepting submissions" : "Applications closed")}
            </div>
          )}
        </div>

        {!user && (
          <section aria-labelledby="application-materials" className="mt-7 border-y border-line py-5 text-left">
            <h2 id="application-materials" className="font-semibold">Before you create an account</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              <li>Have a resume ready as a PDF, up to 10 MB.</li>
              <li>Prepare your written responses and a photo if requested by the application.</li>
              <li>You can save a draft, return to it, and review before submitting.</li>
            </ul>
            <Link href="/join#how-we-evaluate" className="mt-3 inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">See the process and evaluation criteria</Link>
          </section>
        )}

        {user && schema?.needsInfo === true && (
          <div className="mt-5">
            <OperationNotice kind="info">The board asked for a bit more before deciding — please review and resubmit below.</OperationNotice>
          </div>
        )}

        {emailUnverified ? (
          <div className="mt-5">
            <OperationNotice kind="error">
              Your account&apos;s email address has not been verified yet. Open the verification link sent to that
              address, or resend it from your account, then reload this page. Email <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you cannot find it.
            </OperationNotice>
          </div>
        ) : authUnavailable ? (
          <div className="mt-5">
            <OperationNotice kind="error">
              Sign-in services are temporarily unavailable. Reload in a moment; your browser recovery copy has not been removed.
            </OperationNotice>
          </div>
        ) : user && schemaUnavailable ? (
          <div className="mt-5">
            <OperationNotice kind="error">
              The application could not be loaded right now. This is not the same as applications being closed. Reload in
              a moment, and email mecg-board@umich.edu if it keeps happening.
            </OperationNotice>
          </div>
        ) : user && openingTimelineUnavailable ? (
          <div className="mt-5"><OperationNotice kind="info">The application is not accepting submissions right now. We could not load the opening timeline, so we cannot confirm the next opening date. Reload in a moment, or email <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a> if you expected to apply today. Your browser recovery copy has not been removed.</OperationNotice></div>
        ) : user ? (
          <ApplicationForm
            initialName={user.name}
            email={user.email}
            userId={user.id}
            cycleOpen={schema?.open === true}
            preOpenLabel={preOpenLabel}
            cycleId={schema?.cycleId ?? null}
            cycleName={schema?.cycleName ?? null}
            questions={schema?.questions ?? []}
            initialDraft={draft}
            initialRevision={snapshot?.revision ?? null}
            initialHasHeadshot={hasHeadshot === true}
            headshotSupported={!isMissingSchemaObject(headshotError)}
            gradBaseYear={gradTermBaseYear(new Date())}
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
