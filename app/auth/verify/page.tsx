import React from "react";
import { resendVerification } from "../actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";

  return (
    <main className="min-h-screen px-5 py-20 text-white md:px-8">
      <section className="container max-w-xl">
        <p className="eyebrow">Verify email</p>
        <h1 className="display mt-5 text-6xl uppercase">Check your inbox.</h1>
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
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
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
      </section>
    </main>
  );
}
