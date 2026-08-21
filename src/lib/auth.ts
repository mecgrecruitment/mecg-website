import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  memberships: Array<{
    id: string;
    cycleId: string;
    role: "MEMBER" | "BOARD" | "PANEL" | "OWNER";
    active: boolean;
    cycle: {
      id: string;
      name: string;
      status: string;
      createdAt: Date;
    };
  }>;
};

export async function currentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile?.active) return null;

  const { data: membershipRows, error: membershipError } = await supabase
    .from("memberships")
    .select("id, cycle_id, role, active, rush_cycles!inner(id, name, status, created_at)")
    .eq("user_id", authData.user.id)
    .eq("active", true);
  if (membershipError) throw membershipError;

  return {
    id: authData.user.id,
    email: authData.user.email ?? "",
    name: profile.display_name,
    active: profile.active,
    memberships: (membershipRows ?? []).map((membership) => ({
      id: membership.id,
      cycleId: membership.cycle_id,
      role: membership.role,
      active: membership.active,
      cycle: {
        id: membership.rush_cycles.id,
        name: membership.rush_cycles.name,
        status: membership.rush_cycles.status,
        createdAt: new Date(membership.rush_cycles.created_at),
      },
    })),
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireBoard() {
  const user = await requireUser();
  const board = user.memberships.some((membership) =>
    ["BOARD", "OWNER"].includes(membership.role),
  );
  if (!board) redirect("/member");
  return user;
}
