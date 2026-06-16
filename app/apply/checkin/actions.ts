"use server";

import { redirect } from "next/navigation";
import { requireApplicantSession } from "@/lib/applicant-portal/session";
import { checkInApplicant } from "@/lib/applicant-portal/operations";

export async function submitApplicantCheckin(formData: FormData) {
  const session = await requireApplicantSession();
  const phrase = String(formData.get("event_phrase") || "");
  const result = await checkInApplicant(session, phrase);

  if (!result.ok) {
    redirect(`/apply/dashboard?checkin_error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/apply/dashboard?checkin_success=${encodeURIComponent(result.message)}`);
}

/* Backward-compatible alias in case another page still imports the old name. */
export const submitDemoCheckin = submitApplicantCheckin;
