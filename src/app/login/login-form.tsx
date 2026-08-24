"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FormField from "@/components/form-field";

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  EMAIL_NOT_CONFIRMED: "Verify your email before signing in.",
  ROUTING_UNAVAILABLE: "Your account was verified, but your workspace could not be loaded. Try again.",
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.destination !== "string") {
        setError(errorMessages[body?.code] ?? "Sign-in is temporarily unavailable.");
        return;
      }
      router.replace(body.destination);
      router.refresh();
    } catch {
      setError("Sign-in is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-5">
        <FormField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <FormField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={submitting} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="mt-5 flex flex-col text-center text-sm">
        <Link href="/forgot-password" className="flex min-h-11 items-center justify-center underline">Forgot your password?</Link>
        <Link href="/apply" className="flex min-h-11 items-center justify-center text-mecg-navy/60 underline">New applicant? Create an account</Link>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-mecg-navy/40">
        Internal access is assigned by the MECG Board. Contact <a href="mailto:mecg-board@umich.edu" className="inline-flex min-h-11 items-center underline">mecg-board@umich.edu</a> for help.
      </p>
    </>
  );
}
