import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationIntake } from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in before applying" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const intake = parseApplicationIntake(body, user.email);
  if (!intake) {
    return NextResponse.json({ error: "A valid name, resume, answers, and consent are required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_application", {
    applicant_name: intake.name,
    applicant_contact: user.email,
    preferred_name: intake.preferredName ?? undefined,
    phone: intake.phone ?? undefined,
    class_year: intake.classYear ?? undefined,
    major: intake.major ?? undefined,
    linkedin_url: intake.linkedinUrl ?? undefined,
    resume_storage_path: intake.resumeStoragePath,
    answers: intake.answers,
    consent: true,
  });
  if (error) {
    const status = error.code === "55000" ? 409 : error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  await supabase.rpc("set_applicant_profile", {
    uniqname: intake.uniqname ?? undefined,
    college: intake.college ?? undefined,
    grad_term: intake.gradTerm ?? undefined,
    accessibility_notes: intake.accessibilityNotes ?? undefined,
  });
  return NextResponse.json({ applicationId: data }, { status: 201 });
}
