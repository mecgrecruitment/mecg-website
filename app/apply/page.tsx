import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { applicantLogin } from "./actions";
import { getApplicantSession } from "@/lib/applicant-portal/session";
import { SubmitButton } from "./SubmitButton";

export default async function ApplicantLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getApplicantSession();

  if (session) {
    redirect("/apply/dashboard");
  }

  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Applicant Portal</p>
        <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
          Log in.
        </h2>
        <p className="mt-6 max-w-2xl text-white/58">
          Log in with the email you used to create your applicant profile.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <form action={applicantLogin} className="panel grid max-w-xl gap-4 rounded-[2rem] p-6 md:p-8">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="applicant@umich.edu"
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Password</span>
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pendingText="Logging in...">Log In</SubmitButton>

          <Link href="/apply/create" className="text-sm font-bold text-white/60 hover:text-white">
            Don&apos;t have an account? Create one.
          </Link>
        </div>
      </form>
    </div>
  );
}
