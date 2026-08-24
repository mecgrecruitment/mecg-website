import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentDestination, currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationDraft } from "@/lib/workflow";
import LogoutButton from "@/components/logout-button";
import ApplicantSignupForm from "./applicant-signup-form";
import ApplicationForm from "./application-form";

export default async function ApplyPage() {
  const destination = await currentDestination();
  if (destination && destination !== "/apply") redirect(destination);
  const user = destination === "/apply" ? await currentUser() : null;
  const supabase = user ? await createClient() : null;
  const { data: intake } = supabase ? await supabase.rpc("intake_schema") : { data: null };
  const schema = intake && typeof intake === "object" ? intake as { open?: boolean; cycleName?: string | null; questions?: { key: string; prompt: string; inputType: string; required: boolean }[]; draft?: unknown } : null;
  const draft = parseApplicationDraft(schema?.draft);

  return (
    <main className="grid min-h-dvh bg-mecg-navy text-white lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="project-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <Link href="/home" className="relative w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange">
          <Image src="/logos/mecg-white.svg" alt="MECG home" width={150} height={40} priority className="h-10 w-auto" style={{ width: "auto" }} />
        </Link>
        <div className="relative max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange">Rush / 2026</p>
          <h1 className="mt-6 text-balance text-6xl font-semibold leading-[0.98] tracking-[-0.055em]">Your next project starts here.</h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-white/60">Create an account, verify your email, and submit one application for the current rush cycle.</p>
        </div>
        <p className="relative font-mono text-xs uppercase tracking-[0.15em] text-white/35">Michigan Engineering Consulting Group</p>
      </aside>

      <section className="flex min-h-dvh items-center bg-white px-6 py-8 text-mecg-navy sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/home" className="rounded-xl bg-mecg-navy px-3 py-2"><Image src="/logos/mecg-white.svg" alt="MECG home" width={107} height={32} priority /></Link>
            <Link href="/home" className="text-sm text-mecg-navy/55">Back to site</Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">Application intake</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Apply to MECG.</h2>
          <p className="mt-5 max-w-lg text-pretty leading-7 text-mecg-navy/60">
            {user ? "Your email is verified. Complete the questions, upload a PDF resume, and submit." : "Create an applicant account first. We will send an email verification link before opening the application."}
          </p>
          {user ? <><ApplicationForm initialName={user.name} email={user.email} cycleOpen={schema?.open === true} cycleName={schema?.cycleName ?? null} questions={schema?.questions ?? []} initialDraft={draft} /><div className="mt-5 text-center"><LogoutButton /></div></> : <ApplicantSignupForm />}
          <p className="mt-6 text-center text-xs leading-5 text-mecg-navy/60">Questions? Email <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a>.</p>
        </div>
      </section>
    </main>
  );
}
