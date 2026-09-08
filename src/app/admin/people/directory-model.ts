export type DirectoryEntry = {
  id: string;
  name: string;
  gradTerm: string;
  major: string;
  position: string;
  bio: string;
  roles: string[];
  imageSrc?: string;
  linkedin?: string;
};

export type DirectoryRoleFilter = "ALL" | "BOARD" | "MEMBER" | "RECRUITMENT_COMMITTEE" | "PANEL";
export type DirectorySort = "NAME" | "ROLE" | "GRADUATION";

const ROLE_PRIORITY = ["OWNER", "BOARD", "RECRUITMENT_COMMITTEE", "PANEL", "MEMBER"];

export function primaryDirectoryRole(roles: string[]) {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? roles[0] ?? "MEMBER";
}

export function directoryInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

export function isProfileIncomplete(person: DirectoryEntry) {
  return !person.position || !person.major || !person.gradTerm;
}

function matchesRole(person: DirectoryEntry, role: DirectoryRoleFilter) {
  if (role === "ALL") return true;
  if (role === "BOARD") return person.roles.some((value) => value === "BOARD" || value === "OWNER");
  return person.roles.includes(role);
}

export function filterAndSortDirectory(
  directory: DirectoryEntry[],
  query: string,
  role: DirectoryRoleFilter,
  sort: DirectorySort,
) {
  const needle = query.trim().toLocaleLowerCase();
  const result = directory.filter((person) => {
    if (!matchesRole(person, role)) return false;
    if (!needle) return true;
    return [person.name, person.position, person.major, person.gradTerm, ...person.roles]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle);
  });

  return result.sort((left, right) => {
    if (sort === "ROLE") {
      const roleDifference = ROLE_PRIORITY.indexOf(primaryDirectoryRole(left.roles)) - ROLE_PRIORITY.indexOf(primaryDirectoryRole(right.roles));
      if (roleDifference) return roleDifference;
    }
    if (sort === "GRADUATION") {
      const graduationDifference = (left.gradTerm || "~~~~").localeCompare(right.gradTerm || "~~~~");
      if (graduationDifference) return graduationDifference;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}
