import { redirect } from "next/navigation";

// The approval-status view now lives on /auth/request-access (reads the
// caller's own membership_requests row).
export default function MemberPendingEntry() {
  redirect("/auth/request-access");
}
