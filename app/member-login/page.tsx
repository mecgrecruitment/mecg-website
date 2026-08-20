import { redirect } from "next/navigation";

// Legacy member-login URL. Deep-link into the unified login with the
// internal workspace as the post-auth destination.
export default function MemberLoginEntry() {
  redirect("/auth/login?next=/internal");
}
