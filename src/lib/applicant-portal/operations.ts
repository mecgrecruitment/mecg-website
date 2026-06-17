import "server-only";

import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import type { ApplicantSession } from "./session";

export type PortalResult = {
  ok: boolean;
  message: string;
};

function normalizePhrase(value: string) {
  return value.trim().toUpperCase();
}

export async function checkInApplicant(
  session: ApplicantSession,
  rawPhrase: string
): Promise<PortalResult> {
  const supabase = createDemoAdminClient();
  const phrase = normalizePhrase(rawPhrase);

  if (!phrase) {
    return { ok: false, message: "Enter the event phrase to check in." };
  }

  const { data: event } = await supabase
    .from("demo_events")
    .select("id,title,event_type,attendance_code,active")
    .eq("attendance_code", phrase)
    .eq("active", true)
    .eq("event_type", "Open Rush")
    .maybeSingle();

  if (!event) {
    return {
      ok: false,
      message: "That event phrase is not valid for an open rush event.",
    };
  }

  const { data: existing } = await supabase
    .from("demo_checkins")
    .select("id")
    .eq("email", session.email)
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      message: `You have already checked in for ${event.title}.`,
    };
  }

  const { error } = await supabase.from("demo_checkins").insert({
    email: session.email,
    applicant_name: session.fullName,
    event_id: event.id,
    event_phrase: phrase,
    event_name: event.title,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: `You have already checked in for ${event.title}.`,
      };
    }

    return {
      ok: false,
      message: "Could not record attendance. Please try again.",
    };
  }

  return {
    ok: true,
    message: `Checked in successfully for ${event.title}.`,
  };
}

export async function submitApplicantApplication(
  session: ApplicantSession,
  fields: {
    fullName: string;
    year: string;
    major: string;
    resumeName: string | null;
    whyMecg: string;
    teamwork: string;
    problemSolving: string;
  }
): Promise<PortalResult> {
  const supabase = createDemoAdminClient();

  const fullName = fields.fullName.trim();
  const year = fields.year.trim();
  const major = fields.major.trim();
  const whyMecg = fields.whyMecg.trim();
  const teamwork = fields.teamwork.trim();
  const problemSolving = fields.problemSolving.trim();

  if (!fullName || !year || !major || !whyMecg || !teamwork || !problemSolving) {
    return {
      ok: false,
      message: "Please complete all required application fields.",
    };
  }

  const { data: existing } = await supabase
    .from("demo_applications")
    .select("id")
    .eq("email", session.email)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      message: "Your application has already been submitted.",
    };
  }

  await supabase
    .from("demo_applicant_accounts")
    .update({
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  const { error } = await supabase.from("demo_applications").insert({
    applicant_account_id: session.id,
    full_name: fullName,
    email: session.email,
    year,
    major,
    resume_name: fields.resumeName,
    why_mecg: whyMecg,
    teamwork,
    problem_solving: problemSolving,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "Your application has already been submitted.",
      };
    }

    return {
      ok: false,
      message: "Could not submit your application. Please try again.",
    };
  }

  return {
    ok: true,
    message: "Application submitted successfully.",
  };
}
