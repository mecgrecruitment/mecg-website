import React from "react";
import { signup } from "../actions";
import { AuthShell } from "@/components/portal/AuthShell";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { safeNextPath } from "@/lib/auth/schema";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const loginHref = next
    ? `/auth/login?next=${encodeURIComponent(next)}`
    : "/auth/login";

  return (
    <AuthShell
      eyebrow="New account"
      title="Create an account."
      description="Use your University of Michigan email (@umich.edu). Same login later for applications or, after board approval, member tools."
    >
      <p className="eyebrow">Create account</p>
      <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em] md:text-5xl">
        Sign up.
      </h2>
      <p className="mt-4 text-white/55">
        After signup you must confirm your @umich.edu address before logging in
        (Auth email). Delivery depends on Supabase Auth being configured — see
        the next screen if the message does not arrive.
      </p>

      {params.error && (
        <p className="mt-6 rounded-[1rem] border border-red-400/40 bg-red-500/10 p-4 text-red-100">
          {params.error}
        </p>
      )}

      <div className="panel mt-8 grid gap-5 rounded-[2rem] p-7">
        <form action={signup} className="grid gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold">Full name</span>
            <input
              name="full_name"
              required
              autoComplete="name"
              className="portal-field focus-ring"
            />
          </label>

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
            <span className="text-xs text-white/40">Must end in @umich.edu.</span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Password</span>
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

          <TurnstileWidget />

          <button className="button-primary focus-ring cursor-pointer">
            Create account
          </button>
        </form>

        <a href={loginHref} className="text-sm text-white/54 hover:text-white">
          Already have an account? Log in.
        </a>
      </div>
    </AuthShell>
  );
}
