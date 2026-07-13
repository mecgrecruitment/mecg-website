import React from "react";
import { resendVerification } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";

  return (
    <AuthShell
      eyebrow="Email verification"
      title="Check your inbox."
      description="Verify the email connected to your MECG account before continuing to the applicant or member workspace."
    >
        <p className="eyebrow">Verify email</p>
        <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">One step left.</h2>
        <p className="mt-4 text-white/55">
          {email ? (
            <>
              We sent a confirmation link to <strong className="text-white">{email}</strong>.
              Click it to activate your account, then log in.
            </>
          ) : (
            <>We sent you a confirmation link. Click it to activate your account, then log in.</>
          )}
        </p>

        {params.message && (
          <p className="mt-6 rounded-[1rem] border border-white/10 bg-white/[0.05] p-4 text-white/70">
            {params.message}
          </p>
        )}

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <div className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
          <form action={resendVerification} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Didn&apos;t get it? Resend to</span>
              <input
                name="email"
                type="email"
                required
                defaultValue={email}
                autoComplete="email"
                className="portal-field focus-ring"
              />
            </label>
            <button className="rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] hover:border-[var(--orange)]">
              Resend verification
            </button>
          </form>

          <a href="/auth/login" className="text-sm text-white/54 hover:text-white">
            Back to log in.
          </a>
        </div>
    </AuthShell>
  );
}
