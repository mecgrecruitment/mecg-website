import { redirect } from "next/navigation";

// Consolidated onto Supabase auth: /apply/dashboard's requireApplicant() handles
// the auth/role routing (signed-out → /auth/login, member → /internal).
export default function ApplyEntry() {
  redirect("/apply/dashboard");
}
