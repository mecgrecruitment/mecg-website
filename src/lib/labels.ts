// Plain-English wording for everything a person reads on screen.
//
// Database enums used to be rendered raw: every workspace header said
// "Fall 2026 · DECISION_LOCK" and status chips said "FROZEN" or "NEEDS_INFO".
// Those are storage values, not sentences. They stay unchanged in the database
// and in every API payload; only the label people see comes from here.
//
// One map per enum, plus a fallback that title-cases anything unmapped so a new
// enum value degrades to "Needs Info" rather than crashing or leaking SCREAMING_CASE.

const CYCLE_STATUS: Record<string, string> = {
  DRAFT: "Setting up",
  OPEN: "Applications open",
  IN_PROCESS: "Interviews under way",
  DECISION_LOCK: "Voting and decisions",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

const ROUND_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Scheduled",
  ACTIVE: "Open now",
  FROZEN: "Closed to edits",
  FINALIZED: "Final",
  ARCHIVED: "Archived",
};

const APPLICATION_STATUS: Record<string, string> = {
  DRAFT: "Started, not sent",
  SUBMITTED: "Application in",
  NEEDS_INFO: "Waiting on applicant",
  ELIGIBLE: "Passed application round",
  INVITED: "Speed Dating",
  GROUP_CASE: "Group Case",
  IN_PROCESS: "Interview",
  FINAL_REVIEW: "Up for a vote",
  OFFERED: "Offered a spot",
  WAITLISTED: "Waitlisted",
  REJECTED: "Not moving forward",
  WITHDRAWN: "Withdrew",
};

const ASSIGNMENT_STATUS: Record<string, string> = {
  ASSIGNED: "To do",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  LOCKED: "Submitted",
  RECUSED: "You stepped back",
  MISSED: "Missed",
};

const EVALUATION_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  LOCKED: "Submitted",
  SUPERSEDED: "Replaced",
  VOID: "Voided",
};

const DECISION_STATUS: Record<string, string> = {
  PENDING: "Draft",
  APPROVED: "Approved",
  LOCKED: "Ready to send",
  RELEASED: "Sent to applicant",
  SUPERSEDED: "Replaced",
};

const DECISION_OUTCOME: Record<string, string> = {
  OFFER: "Offer a spot",
  WAITLIST: "Waitlist",
  REJECT: "Do not move forward",
  PROCEDURAL_REVIEW: "Needs another look",
};

const EVENT_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Live",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

// A referral's own lifecycle. "Sent" rather than "New" because the member who
// submitted it reads this column too, and to them the meaningful fact is that
// it left their hands.
const REFERRAL_STATUS: Record<string, string> = {
  NEW: "Sent",
  REVIEWED: "Reviewed",
  INVITED: "Invited to apply",
  PASSED: "Not this cycle",
};

const HASH_STAGE: Record<string, string> = {
  APPLICATION: "Application",
  SPEED_DATING: "Speed Dating",
  GROUP_CASE: "Group Case",
  FINAL: "Final",
};

const MEMBER_ROLE: Record<string, string> = {
  MEMBER: "Member",
  BOARD: "Board",
  PANEL: "Hash panel",
  OWNER: "Owner",
  RECRUITMENT_COMMITTEE: "Recruitment committee",
};

// Last resort for a value no map covers: NEEDS_INFO -> "Needs info".
function titleCase(value: string) {
  const words = value.replaceAll("_", " ").toLowerCase().trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

function lookup(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "";
  return map[value] ?? titleCase(value);
}

export const cycleStatusLabel = (value: string | null | undefined) => lookup(CYCLE_STATUS, value);
export const roundStatusLabel = (value: string | null | undefined) => lookup(ROUND_STATUS, value);
export const applicationStatusLabel = (value: string | null | undefined) => lookup(APPLICATION_STATUS, value);
export const assignmentStatusLabel = (value: string | null | undefined) => lookup(ASSIGNMENT_STATUS, value);
export const evaluationStatusLabel = (value: string | null | undefined) => lookup(EVALUATION_STATUS, value);
export const decisionStatusLabel = (value: string | null | undefined) => lookup(DECISION_STATUS, value);
export const decisionOutcomeLabel = (value: string | null | undefined) => lookup(DECISION_OUTCOME, value);
export const eventStatusLabel = (value: string | null | undefined) => lookup(EVENT_STATUS, value);
export const memberRoleLabel = (value: string | null | undefined) => lookup(MEMBER_ROLE, value);
export const hashStageLabel = (value: string | null | undefined) => lookup(HASH_STAGE, value);
export const referralStatusLabel = (value: string | null | undefined) => lookup(REFERRAL_STATUS, value);

// The order the board moves a referral through, for building a dropdown.
export const REFERRAL_STATUSES = ["NEW", "REVIEWED", "INVITED", "PASSED"] as const;

// Anything else that arrives as a raw enum string and has no dedicated map.
export const statusLabel = titleCase;
