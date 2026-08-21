"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormField from "@/components/form-field";
import PortalShell from "@/components/portal-shell";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        router.push(body?.destination ?? "/admin");
        router.refresh();
        return;
      }
      setError("Invalid email or password");
    } catch {
      setError("Could not reach the sign-in service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      eyebrow="Member access"
      title="Sign in to MECG."
      description="Members, Board operators, and Hash panelists use the same account. Your active role determines which workspace opens."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-mecg-navy/40">
        Need access? Contact <a href="mailto:mecg-board@umich.edu" className="underline">mecg-board@umich.edu</a>.
      </p>
      <p className="mt-2 text-center text-xs"><Link href="/forgot-password" className="underline">Forgot your password?</Link></p>
    </PortalShell>
  );
}
