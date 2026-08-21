import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { resolveAuthDestination, type AccessRole, type AuthDestination } from "@/lib/auth-destination";

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

type RushClient = SupabaseClient<Database, "rush">;

export async function destinationForUser(
  supabase: RushClient,
  userId: string,
): Promise<AuthDestination> {
  const [profileResult, membershipResult, applicantResult] = await Promise.all([
    supabase.from("profiles").select("active").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("role").eq("user_id", userId).eq("active", true),
    supabase.rpc("is_applicant"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (applicantResult.error) throw applicantResult.error;

  return resolveAuthDestination({
    active: profileResult.data?.active === true,
    roles: (membershipResult.data ?? []).map((membership) => membership.role as AccessRole),
    hasApplication: applicantResult.data === true,
  });
}

export async function currentDestination(): Promise<AuthDestination | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return destinationForUser(supabase, data.user.id);
}

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
  if (!user) redirect("/login");
  return user;
}

export async function requireMember() {
  const user = await requireUser();
  const hasInternalRole = user.memberships.some((membership) =>
    ["MEMBER", "BOARD", "PANEL", "OWNER"].includes(membership.role),
  );
  if (!hasInternalRole) redirect(await currentDestination() ?? "/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const hasAdminRole = user.memberships.some((membership) =>
    ["BOARD", "PANEL", "OWNER"].includes(membership.role),
  );
  if (!hasAdminRole) redirect(await currentDestination() ?? "/login");
  return user;
}

export async function requireBoard() {
  const user = await requireUser();
  const board = user.memberships.some((membership) =>
    ["BOARD", "OWNER"].includes(membership.role),
  );
  if (!board) redirect(await currentDestination() ?? "/login");
  return user;
}
