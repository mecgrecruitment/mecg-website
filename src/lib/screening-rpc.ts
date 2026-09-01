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
    && Array.isArray(value.criteria)
    && value.criteria.every((criterion) =>
      isRecord(criterion)
      && hasString(criterion, "id")
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
  is_active_screening_reviewer: (value) => typeof value === "boolean",
  check_rate_limit: (value) => typeof value === "boolean",
  my_screening_queue: isScreeningQueue,
  screening_admin_overview: isScreeningOverview,
  screening_assignment_detail: isScreeningDetail,
  screening_assignment_inputs: isScreeningAssignmentInputs,
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
  reject_resume_upload: (value) => typeof value === "string",
  authorize_resume_access: (value) => typeof value === "string",
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
  reviewsPerApplication: number;
  assigned: number;
  submitted: number;
  reviewers: Array<{ id: string; name: string; capacity: number }>;
  packets: Array<{
    id: string;
    code: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    applicantName: string;
    content: { responses?: Array<{ question?: string; answer?: string }> };
  }>;
  results?: Array<{ code: string; applicantName: string; recommendation: string; score: number; evidence: string }>;
};

export type ScreeningQueueItem = {
  assignment_id: string;
  candidate_code: string;
  assignment_status: "ASSIGNED" | "SUBMITTED" | "RECUSED" | "LOCKED";
};

export type ScreeningDetail = {
  assignmentId: string;
  candidateCode: string;
  status: string;
  content: { responses?: Array<{ question?: string; answer?: string }> };
  criteria: Array<{ id: string; name: string; description: string; weight: number; required: boolean }>;
};
