import type { Database } from "@/lib/supabase/database.types";

type MemberRole = Database["rush"]["Enums"]["member_role"];

export type MemberAccount = {
  id: string;
  name: string;
  role: MemberRole;
  roles: MemberRole[];
  active: boolean;
};

type MembershipRow = {
  user_id: string;
  role: MemberRole;
  active?: boolean;
  profiles: { display_name: string; primary_email?: string | null };
};

// A person can hold more than one membership row in a cycle, so collapse them
// to one account showing the strongest role. Shared by the pipeline, People,
// and Rounds pages, which all need the same roster shape.
const ROLE_PRIORITY: readonly MemberRole[] = ["OWNER", "PANEL", "BOARD", "RECRUITMENT_COMMITTEE", "MEMBER"];

export function memberAccountsFor(
  memberships: ReadonlyArray<MembershipRow>,
): MemberAccount[] {
  const accounts = new Map<string, { id: string; name: string; roles: MemberRole[]; active: boolean }>();
  for (const membership of memberships) {
    const account = accounts.get(membership.user_id);
    if (account) { account.roles.push(membership.role); account.active ||= membership.active !== false; }
    else accounts.set(membership.user_id, { id: membership.user_id, name: membership.profiles.display_name, roles: [membership.role], active: membership.active !== false });
  }
  const result: MemberAccount[] = [];
  for (const account of accounts.values()) {
    result.push({
      id: account.id,
      name: account.name,
      role: ROLE_PRIORITY.find((role) => account.roles.includes(role)) ?? ("MEMBER" as MemberRole),
      roles: [...new Set(account.roles)].sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b)),
      active: account.active,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// Matching display names are not identity evidence. Owners only see an anomaly
// when two distinct profile IDs carry the same non-null normalized email.
export function duplicateAccountIdsFor(memberships: ReadonlyArray<MembershipRow>) {
  const idsByEmail = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const email = membership.profiles.primary_email?.trim().toLowerCase();
    if (!email) continue;
    const ids = idsByEmail.get(email) ?? new Set<string>();
    ids.add(membership.user_id);
    idsByEmail.set(email, ids);
  }
  const duplicateIds = new Set<string>();
  for (const ids of idsByEmail.values()) {
    if (ids.size > 1) for (const id of ids) duplicateIds.add(id);
  }
  return [...duplicateIds];
}
