"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export async function applicantEnter(formData: FormData) {
  const supabase = createDemoAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    redirect("/apply?error=Email and password are required.");
  }

  const { data: existing } = await supabase
    .from("demo_applicant_accounts")
    .select("email,password_text")
    .eq("email", email)
    .maybeSingle();

  if (existing && existing.password_text !== password) {
    redirect("/apply?error=Wrong password for this applicant account.");
  }

  if (!existing) {
    const { error } = await supabase.from("demo_applicant_accounts").insert({
      email,
      password_text: password,
    });

    if (error) {
      redirect(`/apply?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect(`/apply/dashboard?email=${encodeURIComponent(email)}`);
}
