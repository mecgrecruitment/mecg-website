import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

const COOKIE_NAME = "mecg_applicant_session";

export type ApplicantSession = {
  id: string;
  email: string;
  fullName: string | null;
};

function getSecret() {
  const secret =
    process.env.APPLICANT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing APPLICANT_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encode(session: ApplicantSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(raw?: string): ApplicantSession | null {
  if (!raw || !raw.includes(".")) return null;

  const [payload, signature] = raw.split(".");
  const expected = sign(payload);

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.id || !parsed.email) return null;

    return {
      id: parsed.id,
      email: String(parsed.email).toLowerCase(),
      fullName: parsed.fullName || null,
    };
  } catch {
    return null;
  }
}

export async function setApplicantSession(session: ApplicantSession) {
  const jar = await cookies();

  jar.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearApplicantSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getApplicantSession(): Promise<ApplicantSession | null> {
  const jar = await cookies();
  const session = decode(jar.get(COOKIE_NAME)?.value);

  if (!session) return null;

  const supabase = createDemoAdminClient();

  const { data } = await supabase
    .from("demo_applicant_accounts")
    .select("id,email,full_name")
    .eq("id", session.id)
    .eq("email", session.email)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    email: data.email.toLowerCase(),
    fullName: data.full_name || null,
  };
}

export async function requireApplicantSession() {
  const session = await getApplicantSession();

  if (!session) {
    redirect("/apply?error=Please log in first.");
  }

  return session;
}

export async function getSubmittedApplication(email: string) {
  const supabase = createDemoAdminClient();

  const { data } = await supabase
    .from("demo_applications")
    .select("id,email,full_name,created_at,submitted_at,status")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  return data;
}
