"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "@/components/workspace-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import FormField from "@/components/form-field";
import OperationNotice from "@/components/operation-notice";
import { CLERK_PASSWORD_MIN_LENGTH } from "@/lib/clerk-password";
import { retryClerkRateLimit } from "@/lib/clerk-retry";

function readableError(error: unknown) {
  if (error && typeof error === "object" && "longMessage" in error && typeof error.longMessage === "string") {
    return error.longMessage;
  }
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    const first = error.errors[0];
    if (first && typeof first === "object") {
      const message = "longMessage" in first ? first.longMessage : "message" in first ? first.message : null;
      if (typeof message === "string") return message;
    }
  }
  return "Account creation is temporarily unavailable. Try signing in if you already have an account.";
}

async function requireClerkSuccess(operation: () => Promise<{ error: unknown | null }>) {
  const result = await operation();
  if (result.error) throw result.error;
}

export default function ApplicantSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Event check-in sends walk-ups here to create an account, so return them to
  // the scan instead of the application they cannot submit yet. Relative paths
  // only, and never protocol-relative: this value comes from the query string.
  const requestedReturn = searchParams.get("redirect_url");
  const returnTo = requestedReturn?.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : null;
  const { signUp, fetchStatus } = useSignUp();
  const [stage, setStage] = useState<"details" | "verification">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const busy = pending || fetchStatus === "fetching";

  function retryNotice(seconds: number) {
    setMessage(`Clerk is handling a signup burst. Retrying automatically in ${seconds} second${seconds === 1 ? "" : "s"}…`);
  }

  // Clerk drops the sign-up attempt as soon as it completes, so any call that
  // touches it afterwards fails with "no sign up attempt was found". When email
  // verification is switched off in the Clerk dashboard the attempt completes
  // inside signUp.password(), which is why both paths finalize through here.
  async function finalizeSignUp() {
    await requireClerkSuccess(() => signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        const destination = session.currentTask ? `/login/tasks/${session.currentTask.key}` : (returnTo ?? "/apply");
        const url = decorateUrl(destination);
        if (url.startsWith("http")) window.location.href = url;
        else router.replace(url);
      },
    }));
    router.refresh();
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const [firstName, ...lastName] = name.trim().split(/\s+/);
      await retryClerkRateLimit(
        () => requireClerkSuccess(() => signUp.password({
          emailAddress: email.trim(),
          password,
          firstName,
          lastName: lastName.join(" ") || undefined,
        })),
        { onWait: retryNotice },
      );
      if (signUp.isTransferable) {
        setError("An account already uses that email. Sign in instead, or reset the password if needed.");
        return;
      }
      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }
      await retryClerkRateLimit(
        () => requireClerkSuccess(() => signUp.verifications.sendEmailCode()),
        { onWait: retryNotice },
      );
      setStage("verification");
      setMessage("We sent a verification code. Check spam or promotions if it is missing.");
    } catch (caught) {
      setError(signUp.isTransferable
        ? "An account already uses that email. Sign in instead, or reset the password if needed."
        : readableError(caught));
      setMessage("");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setPending(true);
    setError("");
    try {
      // Verification attempts are never automatically replayed: one typed code
      // must consume at most one Clerk attempt.
      await requireClerkSuccess(() => signUp.verifications.verifyEmailCode({ code: code.trim() }));
      if (signUp.status !== "complete") {
        setError("That code did not complete verification. Request a new code and try again.");
        return;
      }
      await finalizeSignUp();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (busy) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await retryClerkRateLimit(
        () => requireClerkSuccess(() => signUp.verifications.sendEmailCode()),
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

  async function changeAccountDetails() {
    await signUp.reset();
    setStage("details");
    setCode("");
    setError("");
    setMessage("");
  }

  if (stage === "verification") {
    return (
      <form onSubmit={verify} className="mt-7 space-y-5">
        <FormField label="Verification code" value={code} onChange={(event) => setCode(event.target.value)} required inputMode="numeric" autoComplete="one-time-code" />
        <OperationNotice kind="info">{message}</OperationNotice>
        <OperationNotice kind="error">{error}</OperationNotice>
        <button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">
          {pending ? "Verifying…" : "Verify email"}
        </button>
        <button type="button" onClick={() => void resendCode()} disabled={busy} className="flex min-h-11 w-full items-center justify-center font-semibold underline disabled:opacity-50">
          Send a new code
        </button>
        <button type="button" onClick={() => void changeAccountDetails()} disabled={busy} className="flex min-h-11 w-full items-center justify-center font-semibold underline disabled:opacity-50">
          Change account details
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={createAccount} className="mt-7 space-y-5">
      <FormField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
      <FormField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      <FormField label="Create a password" type="password" minLength={CLERK_PASSWORD_MIN_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" hint={`Use at least ${CLERK_PASSWORD_MIN_LENGTH} characters.`} />
      <OperationNotice kind="info">{message}</OperationNotice>
      <OperationNotice kind="error">{error}</OperationNotice>
      <button type="submit" disabled={busy} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Creating account…" : "Create applicant account"}
      </button>
      <div id="clerk-captcha" />
      <p className="flex min-h-11 items-center justify-center text-center text-sm text-muted">Already have an account? <Link href="/login" className="ml-1 inline-flex min-h-11 items-center font-semibold underline">Sign in</Link></p>
    </form>
  );
}
