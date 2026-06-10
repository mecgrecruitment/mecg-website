"use server";

import { redirect } from "next/navigation";

export async function submitMockApplication() {
  redirect("/apply/dashboard?submitted=1");
}
