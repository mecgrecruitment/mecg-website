import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Board sign in" };

export default function LegacyAdminLoginPage() {
  redirect("/login");
}
