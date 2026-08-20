import { redirect } from "next/navigation";

// Legacy applicant create URL → unified signup. After verify + login,
// non-members land on the applicant dashboard.
export default function ApplyCreateEntry() {
  redirect("/auth/signup");
}
