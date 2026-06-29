import { redirect } from "next/navigation";

// Members log in through the unified Supabase auth; login role-routes to /internal.
export default function MemberLoginEntry() {
  redirect("/auth/login");
}
