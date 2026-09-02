import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { sendEmail, wrapEmail } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationIntake } from "@/lib/workflow";

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before applying" }, { status: 401 });
  const parsedBody = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsedBody.error === "too_large") {
    return NextResponse.json({ error: "Application payload is too large" }, { status: 413 });
  }
  if (parsedBody.error) {
    return NextResponse.json({ error: "Invalid application payload" }, { status: 400 });
  }
  const intake = parseApplicationIntake(parsedBody.data, user.email);
  if (!intake) {
    return NextResponse.json({ error: "A valid name, resume, answers, and consent are required" }, { status: 400 });
  }
  const supabase = await createClient();
  const ip = clientIp(req);
  // Two buckets, not one. The per-user key keeps a shared campus NAT from 429ing
  // a whole lecture hall, but it cannot be the ceiling: with user.id in the key
  // the IP is only a discriminator, so one host minting Clerk accounts gets one
  // full bucket per account. The IP-only bucket is the ceiling that survives
  // that (limits: supabase/migrations/20260902160000_apply_ip_rate_limit_ceiling.sql).
  if (!(await checkRateLimit(`apply:${user.id}:${ip}`)) || !(await checkRateLimit(`apply-ip:${ip}`))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const { data, error } = await supabase.rpc("submit_application", {
    applicant_name: intake.name,
    applicant_contact: user.email,
    preferred_name: intake.preferredName ?? undefined,
    phone: intake.phone ?? undefined,
    class_year: intake.classYear,
    major: intake.major,
    linkedin_url: intake.linkedinUrl ?? undefined,
    resume_storage_path: intake.resumeStoragePath,
    answers: intake.answers,
    consent: true,
    uniqname: intake.uniqname,
    college: intake.college,
    grad_term: intake.gradTerm ?? undefined,
    accessibility_notes: intake.accessibilityNotes ?? undefined,
  });
  if (error) {
    console.error("submit_application failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not submit application");
    return NextResponse.json(errorBody, { status });
  }
  const result = data;
  if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.applicationId !== "string" || typeof result.submittedNow !== "boolean") {
    console.error("submit_application returned an invalid result", result);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  const { applicationId, submittedNow } = result;
  if (submittedNow) {
    const subject = "We received your MECG application";
    let delivered = false;
    try {
      delivered = await sendEmail({
        to: user.email,
        subject,
        html: wrapEmail(
          `<p>Hi ${intake.name},</p><p>We've received your MECG application. Our board will review it and follow up with next steps.</p>`,
          { label: "View your application", href: "https://mecgmichigan.com/applicant" },
        ),
      }) === true;
    } catch (emailError) {
      console.error("application confirmation email failed", emailError);
    }
    // Logged either way. A send that failed is exactly the case the board needs
    // to see, so it must not be the case that goes unrecorded.
    const { error: logError } = await supabase.rpc("log_message", {
      target_application_id: applicationId,
      message_kind: "APPLICATION_RECEIVED",
      message_recipient: user.email,
      message_subject: subject,
      was_delivered: delivered,
    });
    if (logError) console.error("message log failed", logError);
  }
  return NextResponse.json({ applicationId }, { status: submittedNow ? 201 : 200 });
}
