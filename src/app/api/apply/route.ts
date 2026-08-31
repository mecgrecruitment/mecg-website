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
  if (!(await checkRateLimit(`apply:${ip}`))) {
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
    try {
      await sendEmail({
        to: user.email,
        subject: "We received your MECG application",
        html: wrapEmail(
          `<p>Hi ${intake.name},</p><p>We've received your MECG application. Our board will review it and follow up with next steps.</p>`,
          { label: "View your application", href: "https://mecgmichigan.com/applicant" },
        ),
      });
    } catch (emailError) {
      console.error("application confirmation email failed", emailError);
    }
  }
  return NextResponse.json({ applicationId }, { status: submittedNow ? 201 : 200 });
}
