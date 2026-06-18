import { redirect } from "next/navigation";

export default function CheckinPageRedirect() {
  redirect("/apply/dashboard");
}
