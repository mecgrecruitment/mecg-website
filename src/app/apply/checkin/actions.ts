"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export async function submitDemoCheckin(formData: FormData) {
  const supabase = createDemoAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phrase = String(formData.get("event_phrase") || "").trim().toUpperCase();

  if (!email || !phrase) {
    redirect("/apply/checkin?error=Email and event phrase are required.");
  }

  const { data: event, error: eventError } = await supabase
    .from("demo_events")
    .select("title,attendance_code,active")
    .eq("attendance_code", phrase)
    .eq("active", true)
    .maybeSingle();

  if (eventError || !event) {
    redirect("/apply/checkin?error=Invalid attendance code. Please check the event phrase and try again.");
  }

  const { error } = await supabase.from("demo_checkins").insert({
    email,
    event_phrase: phrase,
    event_name: event.title,
  });

  if (error) {
    redirect(`/apply/checkin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/apply/dashboard?email=${encodeURIComponent(email)}&checkedin=1`);
}
