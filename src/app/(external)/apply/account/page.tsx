import { redirect } from "next/navigation";

// Superseded by the public, anonymous /apply intake (PRD §8.9: applicants are
// not auth users, SEC-8). Kept only so old links keep working.
export default function ApplyAccountPage() {
  redirect("/apply");
}
