"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

export async function checkIn(formData: FormData) {
  const eventId = String(formData.get("event_id") || "");
  const phrase = String(formData.get("phrase") || "").trim().toUpperCase();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Log in before checking in.");
  }

  const { data: event, error: eventError } = await supabase
    .from("recruitment_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    redirect("/apply/checkin?error=Event not found.");
  }

  const now = Date.now();
  const opens = event.checkin_opens_at ? new Date(event.checkin_opens_at).getTime() : 0;
  const closes = event.checkin_closes_at ? new Date(event.checkin_closes_at).getTime() : Infinity;

  if (now < opens || now > closes) {
    redirect("/apply/checkin?error=Check-in is not open for this event.");
  }

  if (event.checkin_phrase && phrase !== String(event.checkin_phrase).toUpperCase()) {
    redirect("/apply/checkin?error=Incorrect event phrase.");
  }

  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      method: "event_passphrase",
    },
    {
      onConflict: "event_id,user_id",
    }
  );

  if (error) {
    redirect(`/apply/checkin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/apply/dashboard?message=Checked in successfully.");
}
