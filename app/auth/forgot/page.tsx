import React from "react";
import { requestPasswordReset } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset password."
      description="Enter the @umich.edu email on your MECG account. If it exists, we send a reset link."
    >
      <p className="eyebrow">Reset password</p>
      <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">
        Get a link.
      </h2>
      <p className="mt-4 text-white/55">
        Use the same @umich.edu address you signed up with. We never say whether
        that address has an account.
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

      <form action={requestPasswordReset} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
        <label className="grid gap-2">
          <span className="text-sm font-bold">UMich email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="uniqname@umich.edu"
            className="portal-field focus-ring"
          />
        </label>

        <button className="button-primary focus-ring cursor-pointer">
          Send reset link
        </button>

        <a href="/auth/login" className="text-sm text-white/54 hover:text-white">
          Back to log in.
        </a>
      </form>
    </AuthShell>
  );
}
