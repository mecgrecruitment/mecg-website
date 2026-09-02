"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";
import { CLERK_PASSWORD_MIN_LENGTH } from "@/lib/clerk-password";
import { retryClerkRateLimit } from "@/lib/clerk-retry";

function readableError(error: unknown) {
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    const first = error.errors[0];
    if (first && typeof first === "object") {
      const message = "longMessage" in first ? first.longMessage : "message" in first ? first.message : null;
      if (typeof message === "string") return message;
    }
  }
  return "Account creation is temporarily unavailable. Try signing in if you already have an account.";
}
export default function ApplicantSignupForm() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [stage, setStage] = useState<"details" | "verification">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function retryNotice(seconds: number) {
    setMessage(`Clerk is handling a signup burst. Retrying automatically in ${seconds} second${seconds === 1 ? "" : "s"}…`);
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!isLoaded || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const [firstName, ...lastName] = name.trim().split(/\s+/);
      await retryClerkRateLimit(
        () => signUp.create({ emailAddress: email.trim(), password, firstName, lastName: lastName.join(" ") || undefined }),
        { onWait: retryNotice },
      );
      await retryClerkRateLimit(
        () => signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
        { onWait: retryNotice },
      );
      setStage("verification");
      setMessage("We sent a verification code. Check spam or promotions if it is missing.");
    } catch (caught) {
      setError(readableError(caught));
      setMessage("");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!isLoaded || pending) return;
    setPending(true);
    setError("");
    try {
      // Verification attempts are never automatically replayed: one typed code
      // must consume at most one Clerk attempt.
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== "complete" || !result.createdSessionId) {
        setError("That code did not complete verification. Request a new code and try again.");
        return;
      }
      await setActive({ session: result.createdSessionId });
      router.replace("/apply");
      router.refresh();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (!isLoaded || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await retryClerkRateLimit(
        () => signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
        { onWait: retryNotice },
      );
      setMessage("We sent a new verification code. Check spam or promotions if it is missing.");
    } catch (caught) {
      setError(readableError(caught));
      setMessage("");
    } finally {
      setPending(false);
    }
  }

  if (stage === "verification") {
    return (
      <form onSubmit={verify} className="mt-7 space-y-5">
        <FormField label="Verification code" value={code} onChange={(event) => setCode(event.target.value)} required autoComplete="one-time-code" />
        <OperationNotice kind="info">{message}</OperationNotice>
        <OperationNotice kind="error">{error}</OperationNotice>
        <button type="submit" disabled={!isLoaded || pending} className="button-primary w-full disabled:opacity-50">
          {pending ? "Verifying…" : "Verify email"}
        </button>
        <button type="button" onClick={() => void resendCode()} disabled={!isLoaded || pending} className="flex min-h-11 w-full items-center justify-center font-semibold underline disabled:opacity-50">
          Send a new code
        </button>
        <button type="button" onClick={() => { setStage("details"); setCode(""); setError(""); setMessage(""); }} className="flex min-h-11 w-full items-center justify-center font-semibold underline">
          Change account details
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={createAccount} className="mt-7 space-y-5">
      <FormField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
      <FormField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      <FormField label="Create a password" type="password" minLength={CLERK_PASSWORD_MIN_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" hint={`Use at least ${CLERK_PASSWORD_MIN_LENGTH} characters. You will verify your email before submitting.`} />
      <OperationNotice kind="info">{message}</OperationNotice>
      <OperationNotice kind="error">{error}</OperationNotice>
      <button type="submit" disabled={!isLoaded || pending} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Creating account…" : "Create applicant account"}
      </button>
      <div id="clerk-captcha" />
      <p className="flex min-h-11 items-center justify-center text-center text-sm text-mecg-navy/55">Already have an account? <Link href="/login" className="ml-1 inline-flex min-h-11 items-center font-semibold underline">Sign in</Link></p>
    </form>
  );
}
