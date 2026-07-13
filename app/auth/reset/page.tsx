import React from "react";
import { updatePassword } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";

// Reached after the recovery link hits /auth/callback (which exchanges the code
// and forwards here with a live recovery session). updatePassword verifies the
// session server-side, so a direct visit without a valid link is rejected.
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new key."
      description="Set a new password for the account connected to this verified recovery session."
    >
        <p className="eyebrow">Reset password</p>
        <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">New password.</h2>
        <p className="mt-4 text-white/55">Choose a new password for your account.</p>

        {params.error && (
          <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {params.error}
          </p>
        )}

        <form action={updatePassword} className="panel mt-8 grid gap-4 rounded-[2rem] p-7">
          <label className="grid gap-2">
            <span className="text-sm font-bold">New password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="portal-field focus-ring"
            />
            <span className="text-xs text-white/40">At least 8 characters.</span>
          </label>

          <button className="button-primary focus-ring cursor-pointer">
            Update password
          </button>
        </form>
    </AuthShell>
  );
}
