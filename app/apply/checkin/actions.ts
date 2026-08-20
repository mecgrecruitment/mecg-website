"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { applicantCheckinSchema } from "@/lib/internal/schema";
import { CHECKIN_MESSAGES as MESSAGES } from "@/lib/internal/checkin-messages";

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
