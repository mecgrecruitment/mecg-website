"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";

const MESSAGES: Record<string, string> = {
  ok: "Checked in. See you there!",
  invalid: "That code didn't match an open rush event. Double-check and try again.",
  duplicate: "You're already checked in for that event.",
  unauthenticated: "Please log in first.",
};

export async function submitApplicantCheckin(formData: FormData) {
  await requireApplicant();
  const supabase = await createClient();
  const phrase = String(formData.get("event_phrase") || "");

  const { data, error } = await supabase.rpc("check_in_by_phrase", { p_phrase: phrase });
  if (error) {
    redirect(`/apply/dashboard?checkin_error=${encodeURIComponent(error.message)}`);
  }

  const result = typeof data === "string" ? data : "invalid";
  if (result === "ok") {
    redirect(`/apply/dashboard?checkin_success=${encodeURIComponent(MESSAGES.ok)}`);
  }
  redirect(`/apply/dashboard?checkin_error=${encodeURIComponent(MESSAGES[result] ?? MESSAGES.invalid)}`);
}
