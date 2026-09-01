"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FormField from "@/components/form-field";

const errorMessages: Record<string, string> = {
  INVALID_NAME: "Enter your full name.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_PASSWORD: "Use a password with at least 8 characters.",
  RATE_LIMITED: "Too many signup attempts. Wait a minute and try again.",
  SIGNUP_FAILED: "The account could not be created. Try signing in if you already have an account.",
  ROUTING_UNAVAILABLE: "The account was created, but the application page could not be loaded. Sign in to continue.",
};

export default function ApplicantSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(errorMessages[body?.code] ?? "Account creation is temporarily unavailable.");
        return;
      }
      const body = await response.json().catch(() => null);
      if (body?.verificationRequired) {
        setMessage("Check your email and open the verification link. You will return here to finish the application.");
        return;
      }
      router.replace(body?.destination ?? "/apply");
      router.refresh();
    } catch {
      setError("Account creation is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <FormField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
      <FormField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      <FormField
        label="Create a password"
        type="password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        autoComplete="new-password"
        hint="Use at least 8 characters. You will verify your email before submitting."
      />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <div role="status" className="rounded-xl bg-mecg-blue/10 p-4 text-sm text-mecg-navy"><p>{message}</p><p className="mt-2 text-mecg-navy/70">If it is missing, check spam or promotions. You can also change your details and try again to request a new verification email.</p><button type="button" onClick={() => setMessage("")} className="mt-3 min-h-11 font-semibold underline underline-offset-2">Change details or try again</button></div>}
      <button type="submit" disabled={pending || Boolean(message)} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Creating account..." : "Create applicant account"}
      </button>
      <p className="flex min-h-11 items-center justify-center text-center text-sm text-mecg-navy/55">Already have an account? <Link href="/login" className="ml-1 inline-flex min-h-11 items-center font-semibold underline">Sign in</Link></p>
    </form>
  );
}
