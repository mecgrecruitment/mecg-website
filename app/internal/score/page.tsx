import { redirect } from "next/navigation";

export default function ScoreRedirect() {
  redirect("/internal/scoring");
}
