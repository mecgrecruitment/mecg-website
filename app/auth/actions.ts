"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  signupSchema,
  forgotSchema,
  resetSchema,
  resendSchema,
  requestAccessSchema,
  firstError,
  safeNextPath,
} from "@/lib/auth/schema";
import { verifyTurnstile } from "@/lib/turnstile";

// Absolute site origin for auth email/OAuth redirects. Prefer an explicit
// NEXT_PUBLIC_SITE_URL (keeps redirects on the URL Supabase allow-lists);
// otherwise derive from the request host.
async function siteOrigin(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "127.0.0.1:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function login(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const nextQ = next ? `&next=${encodeURIComponent(next)}` : "";

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(`/auth/login?error=${encodeURIComponent(firstError(parsed))}${nextQ}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}${nextQ}`);
  }

  if (next) redirect(next);

  // Role resolved exactly as RLS resolves it: members.user_id = auth.uid().
  const { data: role } = await supabase.rpc("current_member_role");
  redirect(role ? "/internal" : "/apply/dashboard");
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(`/auth/signup?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const humanVerified = await verifyTurnstile(formData.get("cf-turnstile-response"));
  if (!humanVerified) {
    redirect(`/auth/signup?error=${encodeURIComponent("Verification failed. Please try again.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/auth/forgot?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();
  // Enumeration-safe: never reveal whether the email exists. The recovery link
  // lands on /auth/callback (exchanges the code) then forwards to /auth/reset.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/auth/reset`,
  });

  redirect(
    `/auth/forgot?message=${encodeURIComponent(
      "If an account exists for that email, a password reset link is on its way."
    )}`
  );
}

export async function updatePassword(formData: FormData) {
  const parsed = resetSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    redirect(`/auth/reset?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/reset?error=${encodeURIComponent(
        "Your reset link has expired. Request a new one."
      )}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
  }

  // Force a fresh login with the new password.
  await supabase.auth.signOut();
  redirect(
    `/auth/login?message=${encodeURIComponent(
      "Password updated. Log in with your new password."
    )}`
  );
}

export async function resendVerification(formData: FormData) {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/auth/verify?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  redirect(
    `/auth/verify?email=${encodeURIComponent(parsed.data.email)}&message=${encodeURIComponent(
      "Verification email resent."
    )}`
  );
}

export async function requestMembership(formData: FormData) {
  const parsed = requestAccessSchema.safeParse({
    full_name: formData.get("full_name"),
    requested_role: formData.get("requested_role") || "member",
  });
  if (!parsed.success) {
    redirect(`/auth/request-access?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/auth/request-access");
  }

  const role = parsed.data.requested_role === "board" ? "board" : "recruitment_committee";
  const { error } = await supabase.rpc("request_membership", {
    p_full_name: parsed.data.full_name,
    p_requested_role: role,
  });
  if (error) {
    redirect(`/auth/request-access?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/auth/request-access?message=${encodeURIComponent(
      "Request submitted. A board member will review it shortly."
    )}`
  );
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/auth/login?error=${encodeURIComponent("Google sign-in is unavailable right now.")}`
    );
  }

  redirect(data.url);
}
