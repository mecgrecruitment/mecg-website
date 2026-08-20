import { redirect } from "next/navigation";

// Legacy create URL. Account creation is the unified Supabase signup;
// after confirm + login, role routing picks applicant vs member.
export default function MemberCreateEntry() {
  redirect("/auth/signup");
}
