import { redirect } from "next/navigation";

// Account creation is now the unified Supabase signup.
export default function ApplyCreateEntry() {
  redirect("/auth/signup");
}
