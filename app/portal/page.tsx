import { redirect } from "next/navigation";

// Legacy chooser URL. One login path — role routing after auth sends
// applicants to /apply/dashboard and members to /internal.
export default function PortalPage() {
  redirect("/auth/login");
}
