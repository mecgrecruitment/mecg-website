import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { resolveAuthDestination, type AccessRole, type AuthDestination } from "@/lib/auth-destination";
import { hasPermission } from "@/lib/authorization";
import { resolveCurrentIdentity } from "@/lib/identity/clerk-server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  memberships: Array<{
    id: string;
    cycleId: string;
    role: "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";
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
  const [profileResult, membershipResult, applicantResult, canStartResult] = await Promise.all([
    supabase.from("profiles").select("active").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("role, rush_cycles!inner(status)").eq("user_id", userId).eq("active", true),
    supabase.rpc("is_applicant"),
    supabase.rpc("can_start_application"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (applicantResult.error) throw applicantResult.error;
  // Deliberately not fatal. This function is on the sign-in, sign-up and
  // auth-callback paths, so throwing here takes down authentication for
  // everyone. can_start_application is an additive capability check, and false
  // reproduces exactly the routing that existed before it, so a database that
  // has not had the migration applied yet degrades to the old behaviour instead
  // of locking every user out. Logged, because silently answering false would
  // hide a real outage.
  if (canStartResult.error) console.error("can_start_application failed, treating as false", canStartResult.error);

  return resolveAuthDestination({
    active: profileResult.data?.active === true,
    memberships: (membershipResult.data ?? []).map((membership) => ({
      role: membership.role as AccessRole,
      cycleStatus: membership.rush_cycles.status,
    })),
    hasApplication: applicantResult.data === true,
    canStartApplication: canStartResult.data === true,
  });
}

export async function currentDestination(): Promise<AuthDestination | null> {
  const identity = await resolveCurrentIdentity();
  if (!identity) return null;
  const supabase = await createClient();
  return destinationForUser(supabase, identity.appUserId);
}

export async function currentUser(): Promise<CurrentUser | null> {
  const identity = await resolveCurrentIdentity();
  if (!identity) return null;
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, primary_email, active")
    .eq("id", identity.appUserId)
    .maybeSingle();
  if (profileError || !profile?.active) return null;

  const { data: membershipRows, error: membershipError } = await supabase
    .from("memberships")
    .select("id, cycle_id, role, active, rush_cycles!inner(id, name, status, created_at)")
    .eq("user_id", identity.appUserId)
    .eq("active", true);
  if (membershipError) throw membershipError;

  return {
    id: identity.appUserId,
    email: profile.primary_email ?? "",
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
    hasPermission([membership], membership.cycleId, "WORKSPACE_ACCESS"),
  );
  if (!hasInternalRole) redirect(await currentDestination() ?? "/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const hasAdminRole = user.memberships.some((membership) =>
    ["BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role)
    && hasPermission([membership], membership.cycleId, "WORKSPACE_ACCESS"),
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
