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
