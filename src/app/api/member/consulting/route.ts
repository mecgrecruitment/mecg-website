import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { readJsonBody } from "@/lib/api-route";
import { analyze } from "@/lib/consulting-workbench/engine";
import { parseProject } from "@/lib/consulting-workbench/schema";
import { parseAssistantRequest } from "@/lib/consulting-workbench/assistant";
import { selectProvider, requestSuggestions } from "@/lib/consulting-workbench/provider";
export const runtime = "nodejs";
export const maxDuration = 60;
const active = new Set<string>();
const recent = new Map<string, number>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Use this tool from the signed-in workspace." }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the workbench." }, { status: 401 });
  const body = await readJsonBody(request, 180_000);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized request." }, { status: body.error === "too_large" ? 413 : 400 });
  if (!parseAssistantRequest(body.data)) return NextResponse.json({ error: "Invalid workspace request." }, { status: 400 });
  const input = body.data;
  if (!hasPermission(user.memberships, input.cycleId, "WORKSPACE_ACCESS")) return NextResponse.json({ error: "Active workspace membership required." }, { status: 403 });
  const parsed = parseProject(input.project);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (analyze(parsed.value, input.module, new Date().toISOString().slice(0, 10)).findings.some(f => f.id.endsWith("-secret"))) return NextResponse.json({ error: "Possible secret detected. Remove it before requesting model assistance." }, { status: 400 });
  // Vercel refreshes the request header at runtime. Never reuse a build-time
  // VERCEL_OIDC_TOKEN in a deployed function after it expires.
  const provider = selectProvider({ enabled: process.env.CONSULTING_AI_ENABLED, vercel: process.env.VERCEL, gatewayKey: process.env.AI_GATEWAY_API_KEY, gatewayModel: process.env.CONSULTING_GATEWAY_MODEL, directKey: process.env.CONSULTING_OPENAI_API_KEY, directModel: process.env.CONSULTING_OPENAI_MODEL }, request.headers.get("x-vercel-oidc-token"));
  if (!provider) return NextResponse.json({ error: "Model assistance is not configured. On Vercel, enable the project's OIDC/Gateway access. Local checks and exports remain available." }, { status: 503 });
  // Best-effort per-instance throttling, not a distributed/team spend budget.
  // Gateway also enforces the account's credits and any configured provider budgets.
  const now = Date.now(); for (const [key, time] of recent) if (now - time > 60_000) recent.delete(key);
  if (active.has(user.id) || recent.has(user.id) || active.size >= 4) return NextResponse.json({ error: "Please wait a minute before another model request." }, { status: 429 });
  active.add(user.id); recent.set(user.id, now);
  try {
    const result = await requestSuggestions(provider, parsed.value, input.module);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    return NextResponse.json({ suggestions: result.suggestions, model: result.model, provider: result.kind, projectRevision: parsed.value.revision }, { headers: { "Cache-Control": "no-store" } });
  }
  finally { active.delete(user.id); }
}
