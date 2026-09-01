import type { Database } from "@/lib/supabase/database.types";

type MemberRole = Database["rush"]["Enums"]["member_role"];

// A person can hold more than one membership row in a cycle, so collapse them
// to one account showing the strongest role. Shared by the pipeline, People,
// and Rounds pages, which all need the same roster shape.
const ROLE_PRIORITY: readonly MemberRole[] = ["OWNER", "PANEL", "BOARD", "RECRUITMENT_COMMITTEE", "MEMBER"];

export function memberAccountsFor(
  memberships: ReadonlyArray<{ user_id: string; role: MemberRole; profiles: { display_name: string } }>,
) {
  const accounts = new Map<string, { id: string; name: string; roles: MemberRole[] }>();
  for (const membership of memberships) {
    const account = accounts.get(membership.user_id);
    if (account) account.roles.push(membership.role);
    else accounts.set(membership.user_id, { id: membership.user_id, name: membership.profiles.display_name, roles: [membership.role] });
  }
  return Array.from(accounts.values())
    .map((account) => ({
      id: account.id,
      name: account.name,
      role: ROLE_PRIORITY.find((role) => account.roles.includes(role)) ?? ("MEMBER" as MemberRole),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
