// Member standing: a read-only board rollup of each active member's event
// attendance, project participation and onboarding for one cycle. The database
// returns raw counts and the cycle's thresholds; the active/at-risk judgement
// is made here so the page, tests and docs share one rule.

export type StandingReason = "ATTENDANCE" | "PROJECTS" | "ONBOARDING";

export type StandingThresholds = {
  minAttendancePct: number;
  minProjects: number;
  requireOnboarding: boolean;
};

export type StoredThresholds = StandingThresholds & {
  revision: number;
  updatedAt: string | null;
  // False until the board saves thresholds for this cycle; the defaults apply.
  configured: boolean;
};

export type StandingMember = {
  userId: string;
  name: string;
  roles: string[];
  eventsAttended: number;
  eventsHeld: number;
  projects: number;
  // Null when the member has no onboarding checklist (for example, they joined
  // before onboarding was tracked). Such members are never flagged for it.
  onboardingDone: number | null;
  onboardingTotal: number | null;
};

export type Standing = {
  cycleId: string;
  thresholds: StoredThresholds;
  members: StandingMember[];
};

export type Assessment = {
  status: "ACTIVE" | "AT_RISK";
  reasons: StandingReason[];
  attendancePct: number | null;
};

// Owner-adjustable defaults (docs/features/member-standing.md). They must match
// the column defaults and rush.standing_thresholds_json in the member_standing migration.
export const DEFAULT_THRESHOLDS: StandingThresholds = { minAttendancePct: 50, minProjects: 1, requireOnboarding: true };

export const REASON_LABELS: Record<StandingReason, string> = {
  ATTENDANCE: "Low attendance",
  PROJECTS: "Not staffed",
  ONBOARDING: "Onboarding open",
};

export function assessMember(member: StandingMember, thresholds: StandingThresholds): Assessment {
  const reasons: StandingReason[] = [];
  const attendancePct = member.eventsHeld > 0 ? Math.round((member.eventsAttended / member.eventsHeld) * 100) : null;
  // Compare the exact ratio, not the rounded percentage, so 49.6% never passes 50%.
  if (member.eventsHeld > 0 && member.eventsAttended * 100 < thresholds.minAttendancePct * member.eventsHeld) reasons.push("ATTENDANCE");
  if (member.projects < thresholds.minProjects) reasons.push("PROJECTS");
  if (thresholds.requireOnboarding && member.onboardingTotal !== null && member.onboardingDone !== null
    && member.onboardingDone < member.onboardingTotal) reasons.push("ONBOARDING");
  return { status: reasons.length ? "AT_RISK" : "ACTIVE", reasons, attendancePct };
}

export function sortForReview(members: StandingMember[], thresholds: StandingThresholds): StandingMember[] {
  return [...members].sort((a, b) => {
    const risk = Number(assessMember(b, thresholds).status === "AT_RISK") - Number(assessMember(a, thresholds).status === "AT_RISK");
    return risk || a.name.localeCompare(b.name);
  });
}

export function summarize(members: StandingMember[], thresholds: StandingThresholds) {
  const reasons: Record<StandingReason, number> = { ATTENDANCE: 0, PROJECTS: 0, ONBOARDING: 0 };
  let atRisk = 0;
  for (const member of members) {
    const assessment = assessMember(member, thresholds);
    if (assessment.status === "AT_RISK") atRisk += 1;
    for (const reason of assessment.reasons) reasons[reason] += 1;
  }
  return { total: members.length, active: members.length - atRisk, atRisk, reasons };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isPct = (value: unknown): value is number => isCount(value) && value <= 100;
const isProjectMin = (value: unknown): value is number => isCount(value) && value <= 10;

export function parseThresholds(value: unknown): StoredThresholds | null {
  if (!isRecord(value)) return null;
  const { minAttendancePct, minProjects, requireOnboarding, revision, updatedAt, configured } = value;
  if (!isPct(minAttendancePct) || !isProjectMin(minProjects) || typeof requireOnboarding !== "boolean"
    || !isCount(revision) || (updatedAt !== null && typeof updatedAt !== "string") || typeof configured !== "boolean") return null;
  return { minAttendancePct, minProjects, requireOnboarding, revision, updatedAt, configured };
}

function parseMember(value: unknown): StandingMember | null {
  if (!isRecord(value)) return null;
  const { userId, name, roles, eventsAttended, eventsHeld, projects, onboardingDone, onboardingTotal } = value;
  if (typeof userId !== "string" || !userId || typeof name !== "string") return null;
  if (!Array.isArray(roles) || !roles.every((role) => typeof role === "string")) return null;
  if (!isCount(eventsAttended) || !isCount(eventsHeld) || eventsAttended > eventsHeld || !isCount(projects)) return null;
  const onboardingTracked = onboardingTotal !== null;
  if (onboardingTracked !== (onboardingDone !== null)) return null;
  if (onboardingTracked && (!isCount(onboardingTotal) || !isCount(onboardingDone) || onboardingDone > onboardingTotal)) return null;
  return {
    userId,
    name,
    roles: roles as string[],
    eventsAttended,
    eventsHeld,
    projects,
    onboardingDone: onboardingDone as number | null,
    onboardingTotal: onboardingTotal as number | null,
  };
}

// Returns null for any malformed response so the page shows an unavailable
// state rather than a partial or misleading rollup.
export function parseStanding(value: unknown): Standing | null {
  if (!isRecord(value) || typeof value.cycleId !== "string" || !Array.isArray(value.members)) return null;
  const thresholds = parseThresholds(value.thresholds);
  if (!thresholds) return null;
  const members: StandingMember[] = [];
  for (const entry of value.members) {
    const parsed = parseMember(entry);
    if (!parsed) return null;
    members.push(parsed);
  }
  return { cycleId: value.cycleId, thresholds, members };
}

export function parseThresholdInput(value: unknown): { ok: true; value: StandingThresholds } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid thresholds." };
  if (Object.keys(value).some((key) => !["minAttendancePct", "minProjects", "requireOnboarding"].includes(key))) return { ok: false, error: "Invalid thresholds." };
  const { minAttendancePct, minProjects, requireOnboarding } = value;
  if (!isPct(minAttendancePct)) return { ok: false, error: "Attendance must be a whole percentage from 0 to 100." };
  if (!isProjectMin(minProjects)) return { ok: false, error: "Projects must be a whole number from 0 to 10." };
  if (typeof requireOnboarding !== "boolean") return { ok: false, error: "Choose whether onboarding must be complete." };
  return { ok: true, value: { minAttendancePct, minProjects, requireOnboarding } };
}
