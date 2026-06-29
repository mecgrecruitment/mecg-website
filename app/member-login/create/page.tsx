import { redirect } from "next/navigation";

// Prospective members create an account via Supabase signup, then request
// access (the post-signup dashboard nudges them to /auth/request-access).
export default function MemberCreateEntry() {
  redirect("/auth/signup");
}
