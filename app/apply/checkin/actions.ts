"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { applicantCheckinSchema } from "@/lib/internal/schema";

// Outcome → next-step copy. Keep short; tell the applicant what to do.
const MESSAGES: Record<string, string> = {
  ok: "Checked in. You're on the open-rush list for this event.",
  invalid:
    "That code didn't match an open rush event. Ask a recruiter for today's phrase, then try again.",
  duplicate: "You're already checked in for that event — nothing else to do.",
  unauthenticated: "Your session expired. Log in again, then enter the event phrase.",
};

export async function submitApplicantCheckin(formData: FormData) {
  await requireApplicant();
  const parsed = applicantCheckinSchema.safeParse({
    event_phrase: formData.get("event_phrase"),
  });
  if (!parsed.success) {
    redirect(`/apply/dashboard?checkin_error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_in_by_phrase", {
    p_phrase: parsed.data.event_phrase,
  });
  if (error) {
    redirect(
      `/apply/dashboard?checkin_error=${encodeURIComponent(
        "Check-in failed. Refresh, confirm you're logged in, and try the phrase again."
      )}`
    );
  }

  const result = typeof data === "string" ? data : "invalid";
  if (result === "ok") {
    redirect(`/apply/dashboard?checkin_success=${encodeURIComponent(MESSAGES.ok)}`);
  }
  redirect(
    `/apply/dashboard?checkin_error=${encodeURIComponent(MESSAGES[result] ?? MESSAGES.invalid)}`
  );
}
