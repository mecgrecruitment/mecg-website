import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

const COOKIE_NAME = "mecg_internal_session";

export type InternalRole = "member" | "board";

export type InternalSession = {
  id: string;
  email: string;
  fullName: string;
  role: InternalRole;
};

function getSecret() {
  const secret =
    process.env.INTERNAL_SESSION_SECRET ||
    process.env.APPLICANT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing INTERNAL_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encode(session: InternalSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function normalizeRole(role: string): InternalRole {
  return role === "board" ? "board" : "member";
}

function decode(raw?: string): InternalSession | null {
  if (!raw || !raw.includes(".")) return null;

  const [payload, signature] = raw.split(".");
  const expected = sign(payload);

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.id || !parsed.email || !parsed.fullName || !parsed.role) return null;

    return {
      id: parsed.id,
      email: String(parsed.email).toLowerCase(),
      fullName: String(parsed.fullName),
      role: normalizeRole(String(parsed.role)),
    };
  } catch {
    return null;
  }
}

export async function setInternalSession(session: InternalSession) {
  const jar = await cookies();

  jar.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearInternalSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getInternalSession(): Promise<InternalSession | null> {
  const jar = await cookies();
  const decoded = decode(jar.get(COOKIE_NAME)?.value);

  if (!decoded) return null;

  const supabase = createDemoAdminClient();

  const { data } = await supabase
    .from("demo_internal_accounts")
    .select("id,email,full_name,role,approval_status,active")
    .eq("id", decoded.id)
    .eq("email", decoded.email)
    .maybeSingle();

  if (!data || !data.active || data.approval_status !== "approved") {
    return null;
  }

  return {
    id: data.id,
    email: data.email.toLowerCase(),
    fullName: data.full_name,
    role: normalizeRole(data.role),
  };
}

export async function requireInternalSession() {
  const session = await getInternalSession();

  if (!session) {
    redirect("/member-login?error=Please log in with an approved internal account.");
  }

  return session;
}

export async function requireRole(roles: InternalRole[]) {
  const session = await requireInternalSession();

  if (!roles.includes(session.role)) {
    redirect("/internal?error=You do not have access to that page.");
  }

  return session;
}

export function isBoard(role: InternalRole) {
  return role === "board";
}
