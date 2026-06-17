"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import {
  clearApplicantSession,
  setApplicantSession,
} from "@/lib/applicant-portal/session";

export async function applicantLogin(formData: FormData) {
  const supabase = createDemoAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    redirect("/apply?error=Email and password are required.");
  }

  const { data: account } = await supabase
    .from("demo_applicant_accounts")
    .select("id,email,password_text,full_name")
    .eq("email", email)
    .maybeSingle();

  if (!account) {
    redirect("/apply?error=No account found. Please create an applicant account first.");
  }

  if (account.password_text !== password) {
    redirect("/apply?error=Incorrect password.");
  }

  await setApplicantSession({
    id: account.id,
    email: account.email,
    fullName: account.full_name || null,
  });

  redirect("/apply/dashboard");
}

export async function applicantCreateAccount(formData: FormData) {
  const supabase = createDemoAdminClient();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!fullName || !email || !password) {
    redirect("/apply/create?error=Full name, email, and password are required.");
  }

  const { data: existing } = await supabase
    .from("demo_applicant_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    redirect("/apply?error=An account already exists. Please log in.");
  }

  const { data: created, error } = await supabase
    .from("demo_applicant_accounts")
    .insert({
      full_name: fullName,
      email,
      password_text: password,
    })
    .select("id,email,full_name")
    .single();

  if (error || !created) {
    redirect("/apply/create?error=Could not create account. Please try again.");
  }

  await setApplicantSession({
    id: created.id,
    email: created.email,
    fullName: created.full_name || fullName,
  });

  redirect("/apply/dashboard");
}

export async function applicantLogout() {
  await clearApplicantSession();
  redirect("/apply");
}
