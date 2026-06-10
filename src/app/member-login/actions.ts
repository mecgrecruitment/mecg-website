"use server";

import { redirect } from "next/navigation";

export async function memberLogin() {
  redirect("/internal");
}
