import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// B1 (PRD §9.1/§11.1): role resolution for the internal zone. RLS is the
// security boundary (SEC-16) — these helpers only decide routing/rendering.
// Role comes from the caller's own members row (readable under RLS), never
// from the JWT (SEC-7).

export type MemberRole = "board" | "recruitment_committee" | "general_member";

export type Member = {
  id: string;
  full_name: string | null;
  email: string;
  role: MemberRole;
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  board: "Board",
  recruitment_committee: "Recruitment Committee",
  general_member: "Member",
};

export const COMMITTEE_OR_ABOVE: MemberRole[] = [
  "board",
  "recruitment_committee",
];

export async function getMember(): Promise<Member | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, email, role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  return member ?? null;
}

// Per-page gate. With no `allowed` list, any live member passes; otherwise the
// member's role must be in the list (pass COMMITTEE_OR_ABOVE for committee
// surfaces, ["board"] for board-only).
export async function requireMember(allowed?: MemberRole[]): Promise<Member> {
  const member = await getMember();

  if (!member) {
    redirect("/auth/login?message=Member login required.");
  }
  if (allowed && !allowed.includes(member.role)) {
    redirect("/internal");
  }

  return member;
}

export const requireCommittee = () => requireMember(COMMITTEE_OR_ABOVE);
export const requireBoard = () => requireMember(["board"]);

export type Applicant = {
  id: string;
  email: string;
  fullName: string | null;
};

export type NavIdentity =
  | { kind: "member"; href: "/internal"; label: string }
  | { kind: "applicant"; href: "/apply/dashboard"; label: string };

// Non-redirecting session summary for chrome that renders on every page (the
// public site header): who's logged in, and where their "you" link should
// go. Returns null for a signed-out visitor — unlike requireMember/
// requireApplicant, this never redirects.
export async function getNavIdentity(): Promise<NavIdentity | null> {
  // Public marketing pages must remain available during static previews and
  // content QA even when the authenticated portal has not been configured.
  // Gated helpers still fail closed through createClient(); only the optional
  // identity affordance in the public header degrades to its signed-out state.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (member) {
    return { kind: "member", href: "/internal", label: ROLE_LABELS[member.role] };
  }

  return { kind: "applicant", href: "/apply/dashboard", label: "Dashboard" };
}

// Applicant gate: an authenticated user with NO members row. A signed-out user
// is sent to login; a member is routed to their own portal.
export async function requireApplicant(): Promise<Applicant> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/apply/dashboard");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (member) {
    redirect("/internal");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  };
}
