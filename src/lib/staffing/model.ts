// Staffing planner: members tell the board, per cycle, how many hours a week
// they can give client work, their skills and the projects they would most
// like. The board reads that next to each member's current project load
// before staffing a project. Limits mirror
// supabase/migrations/20261118090000_staffing_planner.sql. These checks are
// slightly stricter (UTF-16 length, all-whitespace trim), so anything they
// accept the database accepts too.

export const MAX_WEEKLY_HOURS = 40;
export const MAX_SKILLS = 12;
export const MAX_SKILL_LENGTH = 40;
export const MAX_PREFERRED_PROJECTS = 3;
export const MAX_NOTES_LENGTH = 500;

export type AvailabilityInput = {
  weeklyHours: number;
  skills: string[];
  // Ranked, most wanted first.
  preferredProjectIds: string[];
  notes: string;
};

export type Availability = {
  // False until the member saves for this cycle; weeklyHours is then null.
  submitted: boolean;
  weeklyHours: number | null;
  skills: string[];
  preferredProjectIds: string[];
  notes: string;
  revision: number;
  updatedAt: string | null;
};

export type MyAvailability = Availability & { cycleId: string };

export type PlanMember = Availability & {
  userId: string;
  name: string;
  roles: string[];
  staffedProjectIds: string[];
};

export type ProjectOption = { id: string; title: string; semester: string };

export type PlanProject = ProjectOption & { staffCount: number };

export type StaffingPlan = { cycleId: string; projects: PlanProject[]; members: PlanMember[] };

export type LoadSignal = "NOT_SUBMITTED" | "OPEN" | "STAFFED" | "OVER" | "UNAVAILABLE";

export const LOAD_LABELS: Record<LoadSignal, string> = {
  NOT_SUBMITTED: "Not submitted",
  OPEN: "Open to staff",
  STAFFED: "Staffed",
  OVER: "Staffed, no hours",
  UNAVAILABLE: "No hours this cycle",
};

export const LOAD_TONES: Record<LoadSignal, "navy" | "orange" | "neutral"> = {
  NOT_SUBMITTED: "neutral",
  OPEN: "navy",
  STAFFED: "neutral",
  OVER: "orange",
  UNAVAILABLE: "neutral",
};

export function loadSignal(member: PlanMember): LoadSignal {
  if (!member.submitted || member.weeklyHours === null) return "NOT_SUBMITTED";
  const staffed = member.staffedProjectIds.length > 0;
  if (member.weeklyHours === 0) return staffed ? "OVER" : "UNAVAILABLE";
  return staffed ? "STAFFED" : "OPEN";
}

// Who can take work first: open members, then staffed ones, then members with
// no hours, then members who have not submitted. Within a group, fewer current
// projects and more hours come first, then name.
const SIGNAL_ORDER: Record<LoadSignal, number> = { OPEN: 0, STAFFED: 1, OVER: 2, UNAVAILABLE: 3, NOT_SUBMITTED: 4 };

export function sortForPlanning(members: PlanMember[]): PlanMember[] {
  return [...members].sort((a, b) => {
    const signal = SIGNAL_ORDER[loadSignal(a)] - SIGNAL_ORDER[loadSignal(b)];
    if (signal) return signal;
    const load = a.staffedProjectIds.length - b.staffedProjectIds.length;
    if (load) return load;
    const hours = (b.weeklyHours ?? 0) - (a.weeklyHours ?? 0);
    return hours || a.name.localeCompare(b.name);
  });
}

export function summarizePlan(members: PlanMember[]) {
  let submitted = 0;
  let hours = 0;
  let open = 0;
  for (const member of members) {
    if (!member.submitted) continue;
    submitted += 1;
    hours += member.weeklyHours ?? 0;
    if (loadSignal(member) === "OPEN") open += 1;
  }
  return { members: members.length, submitted, hours, open };
}

export function matchesSkill(member: PlanMember, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || member.skills.some((skill) => skill.toLowerCase().includes(needle));
}

// Trim, drop empties and drop case-insensitive repeats, keeping the first
// spelling and order. The database applies the same rule.
export function parseSkillsText(text: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const skill = raw.trim();
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    skills.push(skill);
  }
  return skills;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const INPUT_KEYS = ["weeklyHours", "skills", "preferredProjectIds", "notes"];

export function parseAvailabilityInput(value: unknown): { ok: true; value: AvailabilityInput } | { ok: false; error: string } {
  if (!isRecord(value) || Object.keys(value).some((key) => !INPUT_KEYS.includes(key))) return { ok: false, error: "Invalid form." };
  const { weeklyHours, skills, preferredProjectIds, notes } = value;
  if (!isCount(weeklyHours) || weeklyHours > MAX_WEEKLY_HOURS) return { ok: false, error: `Weekly hours must be a whole number from 0 to ${MAX_WEEKLY_HOURS}.` };
  const skillError = `List up to ${MAX_SKILLS} different skills, each 1 to ${MAX_SKILL_LENGTH} characters.`;
  if (!isStringList(skills) || skills.length > MAX_SKILLS) return { ok: false, error: skillError };
  const trimmed = skills.map((skill) => skill.trim());
  if (trimmed.some((skill) => !skill || skill.length > MAX_SKILL_LENGTH)) return { ok: false, error: skillError };
  if (!isStringList(preferredProjectIds) || preferredProjectIds.length > MAX_PREFERRED_PROJECTS
    || preferredProjectIds.some((id) => !id || id.length > 100) || new Set(preferredProjectIds).size !== preferredProjectIds.length) {
    return { ok: false, error: `Choose up to ${MAX_PREFERRED_PROJECTS} different projects.` };
  }
  if (typeof notes !== "string" || notes.trim().length > MAX_NOTES_LENGTH) return { ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` };
  return { ok: true, value: { weeklyHours, skills: parseSkillsText(trimmed.join("\n")), preferredProjectIds, notes: notes.trim() } };
}

function parseAvailability(value: Record<string, unknown>): Availability | null {
  const { submitted, weeklyHours, skills, preferredProjectIds, notes, revision, updatedAt } = value;
  if (typeof submitted !== "boolean" || !isStringList(skills) || !isStringList(preferredProjectIds) || typeof notes !== "string"
    || !isCount(revision) || (updatedAt !== null && typeof updatedAt !== "string")) return null;
  if (submitted ? !isCount(weeklyHours) || weeklyHours > MAX_WEEKLY_HOURS || revision < 1 : weeklyHours !== null || revision !== 0) return null;
  return { submitted, weeklyHours: weeklyHours as number | null, skills, preferredProjectIds, notes, revision, updatedAt };
}

// Parsers return null for any malformed response so pages show an
// unavailable state rather than partial data.
export function parseMyAvailability(value: unknown): MyAvailability | null {
  if (!isRecord(value) || typeof value.cycleId !== "string" || !value.cycleId) return null;
  const availability = parseAvailability(value);
  return availability ? { cycleId: value.cycleId, ...availability } : null;
}

function parseProject(value: unknown): PlanProject | null {
  if (!isRecord(value)) return null;
  const { id, title, semester, staffCount } = value;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof semester !== "string" || !isCount(staffCount)) return null;
  return { id, title, semester, staffCount };
}

function parsePlanMember(value: unknown): PlanMember | null {
  if (!isRecord(value)) return null;
  const { userId, name, roles, staffedProjectIds } = value;
  if (typeof userId !== "string" || !userId || typeof name !== "string" || !isStringList(roles) || !isStringList(staffedProjectIds)) return null;
  const availability = parseAvailability(value);
  return availability ? { userId, name, roles, staffedProjectIds, ...availability } : null;
}

export function parsePlan(value: unknown): StaffingPlan | null {
  if (!isRecord(value) || typeof value.cycleId !== "string" || !Array.isArray(value.projects) || !Array.isArray(value.members)) return null;
  const projects: PlanProject[] = [];
  for (const entry of value.projects) {
    const project = parseProject(entry);
    if (!project) return null;
    projects.push(project);
  }
  const members: PlanMember[] = [];
  for (const entry of value.members) {
    const member = parsePlanMember(entry);
    if (!member) return null;
    members.push(member);
  }
  return { cycleId: value.cycleId, projects, members };
}
