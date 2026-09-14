import { isGroupCaseRoster, isGroupCaseScores } from "@/lib/group-case-roster";
import { isSpeedDatingRoster } from "@/lib/speed-dating-roster";

type RpcError = { code?: string; message: string };
type RpcResult<T> = Promise<{ data: T | null; error: RpcError | null }>;
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => RpcResult<unknown> };

type RpcValidator = (value: unknown) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string";
}

function hasNumber(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" && Number.isFinite(value[key]);
}

function hasBoolean(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "boolean";
}

function isWorkspaceContext(value: unknown) {
  if (!isRecord(value)) return false;
  return hasString(value, "cycleId")
    && hasBoolean(value, "isScreeningReviewer")
    && hasNumber(value, "openScreeningCount")
    && Number.isInteger(value.openScreeningCount)
    && Number(value.openScreeningCount) >= 0
    && hasNumber(value, "openEvaluationCount")
    && Number.isInteger(value.openEvaluationCount)
    && Number(value.openEvaluationCount) >= 0
    && hasNumber(value, "openCalibrationCount")
    && Number.isInteger(value.openCalibrationCount)
    && Number(value.openCalibrationCount) >= 0
    && hasNumber(value, "openLiveEventCount")
    && Number.isInteger(value.openLiveEventCount)
    && Number(value.openLiveEventCount) >= 0
    && hasNumber(value, "openTaskCount")
    && Number.isInteger(value.openTaskCount)
    && Number(value.openTaskCount) >= 0
    && hasBoolean(value, "hasGradingEvent")
    && hasBoolean(value, "hasSpeedDatingRound")
    && hasBoolean(value, "hasGroupCaseWork");
}

function isScreeningQueue(value: unknown) {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item)
    && hasString(item, "assignment_id")
    && hasString(item, "candidate_code")
    && ["ASSIGNED", "SUBMITTED", "RECUSED", "LOCKED"].includes(String(item.assignment_status)),
  );
}

function isScreeningOverview(value: unknown) {
  if (!isRecord(value)) return false;
  return hasString(value, "batchId")
    && ["DRAFT", "PUBLISHED", "FROZEN"].includes(String(value.status))
    && hasNumber(value, "reviewsPerApplication")
    && hasNumber(value, "assigned")
    && hasNumber(value, "submitted")
    && Array.isArray(value.reviewers)
    && Array.isArray(value.packets);
}

function isScreeningDetail(value: unknown) {
  if (!isRecord(value)) return false;
  return hasString(value, "assignmentId")
    && hasString(value, "candidateCode")
    && hasString(value, "status")
    && isRecord(value.content)
    && hasBoolean(value, "hasResume")
    && Array.isArray(value.criteria)
    && value.criteria.every((criterion) =>
      isRecord(criterion)
      && hasString(criterion, "id")
      && hasString(criterion, "key")
      && hasString(criterion, "name")
      && hasString(criterion, "description")
      && hasNumber(criterion, "weight")
      && typeof criterion.required === "boolean",
    );
}

function isScreeningAssignmentInputs(value: unknown) {
  if (!isRecord(value)) return false;
  return Array.isArray(value.packets) && Array.isArray(value.reviewers);
}

function objectWith(...fields: Array<[string, "string" | "number"]>): RpcValidator {
  return (value) => {
    if (!isRecord(value)) return false;
    return fields.every(([key, type]) => type === "string" ? hasString(value, key) : hasNumber(value, key));
  };
}

// Custom rush RPCs are not present in the generated Supabase types. Validate
// their results here before a caller can treat an assertion as trusted data.
// Mutation RPCs whose return values are not consumed do not need a validator.
const RPC_VALIDATORS: Record<string, RpcValidator> = {
  workspace_context: isWorkspaceContext,
  is_active_screening_reviewer: (value) => typeof value === "boolean",
  check_rate_limit: (value) => typeof value === "boolean",
  my_screening_queue: isScreeningQueue,
  screening_admin_overview: isScreeningOverview,
  screening_assignment_detail: isScreeningDetail,
  screening_assignment_inputs: isScreeningAssignmentInputs,
  approve_screening_packets: (value) => isRecord(value) && hasNumber(value, "approved") && Array.isArray(value.failed),
  // Void RPC: PostgREST hands back an empty body, which supabase-js reports as null.
  reset_screening_batch: (value) => value == null || value === "",
  reassign_screening_reader: (value) => typeof value === "number" && Number.isInteger(value) && value >= 0,
  begin_headshot_upload: objectWith(["path", "string"]),
  attach_headshot: (value) =>
    isRecord(value) && (value.previousPath === null || typeof value.previousPath === "string"),
  authorize_headshot_access: (value) => typeof value === "string",
  my_headshot: (value) => typeof value === "boolean",
  begin_resume_upload: objectWith(["documentId", "string"], ["path", "string"]),
  my_ready_resume: objectWith(["path", "string"], ["filename", "string"]),
  pending_resume_upload: objectWith(
    ["documentId", "string"],
    ["path", "string"],
    ["declaredSize", "number"],
    ["filename", "string"],
  ),
  finalize_resume_upload: objectWith(
    ["documentId", "string"],
    ["path", "string"],
    ["filename", "string"],
    ["size", "number"],
    ["pageCount", "number"],
  ),
  hash_tally: (value) => Array.isArray(value) && value.every((item) =>
    isRecord(item)
    && hasString(item, "application_id")
    && hasNumber(item, "yes_count")
    && hasNumber(item, "no_count")
    && hasNumber(item, "unsure_count")
    && hasNumber(item, "total_votes")
    && hasNumber(item, "quorum")
    && ["PENDING", "OFFER", "REJECT"].includes(String(item.outcome)),
  ),
  reject_resume_upload: (value) => typeof value === "string",
  authorize_resume_access: (value) => typeof value === "string",
  authorize_screening_resume: (value) => typeof value === "string",
  my_speed_dating_roster: isSpeedDatingRoster,
  rate_speed_dating_applicant: (value) =>
    isRecord(value) && hasString(value, "applicationId") && hasNumber(value, "score") && hasString(value, "note")
    && hasNumber(value, "session") && hasString(value, "savedAt"),
  group_case_roster: isGroupCaseRoster,
  rate_group_case_applicant: (value) =>
    isRecord(value) && hasString(value, "applicationId") && isGroupCaseScores(value.scores) && hasString(value, "note")
    && hasString(value, "savedAt"),
};

export async function screeningRpc<T>(client: unknown, name: string, args?: Record<string, unknown>) {
  const result = await (client as RpcClient).rpc(name, args);
  if (result.error) return { data: null, error: result.error };
  if (result.data === null) return result as Awaited<RpcResult<T>>;

  const validator = RPC_VALIDATORS[name];
  if (validator && !validator(result.data)) {
    return {
      data: null,
      error: {
        code: "RPC_SHAPE",
        message: `RPC ${name} returned an invalid response`,
      },
    };
  }

  return result as Awaited<RpcResult<T>>;
}

export type ScreeningOverview = {
  batchId: string;
  status: "DRAFT" | "PUBLISHED" | "FROZEN";
  // Set once an Owner releases the closed ranking to Board and the Recruitment Committee.
  releasedAt?: string | null;
  reviewsPerApplication: number;
  assigned: number;
  submitted: number;
  reviewers: Array<{ id: string; name: string; capacity: number; assigned: number; submitted: number }>;
  packets: Array<{
    id: string;
    code: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    applicantName: string;
    content: { responses?: Array<{ question?: string; answer?: string }> };
    // Absent for FROZEN batches when the viewer is not Board or Owner.
    assignments?: Array<{ reviewerId: string; reviewerName: string; status: string }>;
  }>;
  results?: Array<{
    code: string;
    applicationId: string;
    applicantName?: string;
    classYear: string | null;
    major: string | null;
    // Names of the cycle events the applicant checked in to, in date order. Context for the board, never scored.
    events: string[];
    reviewerId?: string;
    reviewerName?: string;
    recommendation: "ADVANCE" | "HOLD" | "DECLINE";
    score: number;
    evidence?: string;
    submittedAt: string;
    ratings: Array<{ key: string; name: string; weight: number; score: number; note?: string | null }>;
  }>;
};

export type ScreeningQueueItem = {
  assignment_id: string;
  candidate_code: string;
  assignment_status: "ASSIGNED" | "SUBMITTED" | "RECUSED" | "LOCKED";
};

export type WorkspaceContext = {
  cycleId: string;
  isScreeningReviewer: boolean;
  openScreeningCount: number;
  openEvaluationCount: number;
  openCalibrationCount: number;
  openLiveEventCount: number;
  openTaskCount: number;
  hasGradingEvent: boolean;
  hasSpeedDatingRound: boolean;
  hasGroupCaseWork: boolean;
};

export type ScreeningDetail = {
  assignmentId: string;
  candidateCode: string;
  status: string;
  content: { responses?: Array<{ question?: string; answer?: string }> };
  hasResume: boolean;
  criteria: Array<{ id: string; key: string; name: string; description: string; weight: number; required: boolean }>;
};
