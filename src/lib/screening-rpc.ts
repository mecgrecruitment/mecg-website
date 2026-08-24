type RpcError = { code?: string; message: string };
type RpcResult<T> = Promise<{ data: T | null; error: RpcError | null }>;
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => RpcResult<unknown> };

export function screeningRpc<T>(client: unknown, name: string, args?: Record<string, unknown>) {
  return (client as RpcClient).rpc(name, args) as RpcResult<T>;
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
