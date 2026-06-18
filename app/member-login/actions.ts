"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { clearInternalSession, setInternalSession } from "@/lib/internal-portal/session";

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

export async function memberLogin(formData: FormData) {
  const supabase = createDemoAdminClient();

  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    redirect("/member-login?error=Email and password are required.");
  }

  const { data: account } = await supabase
    .from("demo_internal_accounts")
    .select("id,email,password_text,full_name,role,approval_status,active")
    .eq("email", email)
    .maybeSingle();

  if (!account) {
    redirect("/member-login?error=No internal account found. Create a request first.");
  }

  if (account.password_text !== password) {
    redirect("/member-login?error=Incorrect password.");
  }

  if (account.approval_status !== "approved" || !account.active) {
    redirect(`/member-login/pending?email=${encodeURIComponent(email)}`);
  }

  await setInternalSession({
    id: account.id,
    email: account.email,
    fullName: account.full_name,
    role: account.role,
  });

  redirect("/internal");
}

export async function requestInternalAccount(formData: FormData) {
  const supabase = createDemoAdminClient();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") || "").trim();
  const requestedRoleRaw = String(formData.get("requested_role") || "member").trim();

  const requestedRole = requestedRoleRaw === "board" ? "board" : "member";

  if (!fullName || !email || !password) {
    redirect("/member-login/create?error=Name, email, and password are required.");
  }

  const { data: existing } = await supabase
    .from("demo_internal_accounts")
    .select("email,approval_status,active")
    .eq("email", email)
    .maybeSingle();

  if (existing?.approval_status === "approved" && existing.active) {
    redirect("/member-login?error=An approved account already exists. Please log in.");
  }

  if (existing) {
    await supabase
      .from("demo_internal_accounts")
      .update({
        full_name: fullName,
        password_text: password,
        requested_role: requestedRole,
        approval_status: "pending",
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    redirect(`/member-login/pending?email=${encodeURIComponent(email)}`);
  }

  await supabase.from("demo_internal_accounts").insert({
    full_name: fullName,
    email,
    password_text: password,
    requested_role: requestedRole,
    role: "member",
    approval_status: "pending",
    active: false,
  });

  redirect(`/member-login/pending?email=${encodeURIComponent(email)}`);
}

export async function memberLogout() {
  await clearInternalSession();
  redirect("/member-login");
}
