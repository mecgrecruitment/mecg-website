import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { applicantCheckinSchema } from "@/lib/internal/schema";
import { CHECKIN_MESSAGES } from "@/lib/internal/checkin-messages";

// Same check-in flow as app/apply/checkin/actions.ts's submitApplicantCheckin,
// but driven by the :code path segment so a scanned QR code (see
// app/internal/events/page.tsx) checks the applicant in without them having to
// type the phrase.
export default async function QrCheckinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireApplicant();
  const { code } = await params;

  const parsed = applicantCheckinSchema.safeParse({ event_phrase: code });
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
    redirect(`/apply/dashboard?checkin_success=${encodeURIComponent(CHECKIN_MESSAGES.ok)}`);
  }
  redirect(
    `/apply/dashboard?checkin_error=${encodeURIComponent(
      CHECKIN_MESSAGES[result] ?? CHECKIN_MESSAGES.invalid
    )}`
  );
}
