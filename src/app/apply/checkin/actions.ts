"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

const eventMap: Record<string, string> = {
  BLUEGEAR: "Mass Meeting",
  PROJECT: "Career Panel",
  CLIENT: "Meet the Members",
};

export async function submitDemoCheckin(formData: FormData) {
  const supabase = createDemoAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phrase = String(formData.get("event_phrase") || "").trim().toUpperCase();

  if (!email || !phrase) {
    redirect("/apply/checkin?error=Email and event phrase are required.");
  }

  const eventName = eventMap[phrase] || "Unknown Event";

  const { error } = await supabase.from("demo_checkins").insert({
    email,
    event_phrase: phrase,
    event_name: eventName,
  });

  if (error) {
    redirect(`/apply/checkin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/apply/dashboard?checkedin=1");
}
