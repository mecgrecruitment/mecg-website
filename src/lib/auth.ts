import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { hasEditableIntakeApplication, resolveAuthDestination, type AccessRole, type AuthDestination } from "@/lib/auth-destination";
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
      hash_stage: string | null;
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

  const access = {
    active: profileResult.data?.active === true,
    memberships: (membershipResult.data ?? []).map((membership) => ({
      role: membership.role as AccessRole,
      cycleStatus: membership.rush_cycles.status,
    })),
    hasApplication: applicantResult.data === true,
    canStartApplication: canStartResult.data === true,
    hasEditableApplication: false,
  };
  const destination = resolveAuthDestination(access);
  if (destination !== "/applicant") return destination;
  // A saved new-cycle draft makes can_start_application false, while a past
  // submission still makes is_applicant true. Check the authoritative editable
  // intake before routing someone away from their saved work. Internal roles
  // never need this extra applicant-only read.
  const intakeResult = await supabase.rpc("intake_schema");
  if (intakeResult.error) throw intakeResult.error;
  return resolveAuthDestination({ ...access, hasEditableApplication: hasEditableIntakeApplication(intakeResult.data) });
}

export async function currentDestination(): Promise<AuthDestination | null> {
  const identity = await resolveCurrentIdentity();
  if (!identity) return null;
  const supabase = await createClient();
  return destinationForUser(supabase, identity.appUserId);
}

// Memoized per server render, so a layout, page and component share one lookup.
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const identity = await resolveCurrentIdentity();
  if (!identity) return null;
  const supabase = await createClient();

  const [{ data: profile, error: profileError }, { data: membershipRows, error: membershipError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, primary_email, active")
      .eq("id", identity.appUserId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, cycle_id, role, active, rush_cycles!inner(id, name, status, hash_stage, created_at)")
      .eq("user_id", identity.appUserId)
      .eq("active", true),
  ]);
  // A failed profile lookup is a dependency failure, not evidence that the
  // session is invalid. API routes can now distinguish it from a real 401.
  if (profileError) throw profileError;
  if (!profile?.active) return null;
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
        hash_stage: membership.rush_cycles.hash_stage,
        createdAt: new Date(membership.rush_cycles.created_at),
      },
    })),
  };
});

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
