import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { readJsonBody } from "@/lib/api-route";
import { analyze } from "@/lib/consulting-workbench/engine";
import { object, parseProject } from "@/lib/consulting-workbench/schema";
import { assistantInput, assistantInstructions, parseAssistantRequest, parseSuggestions, suggestionFormat } from "@/lib/consulting-workbench/assistant";
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
  const apiKey = process.env.CONSULTING_OPENAI_API_KEY, model = process.env.CONSULTING_OPENAI_MODEL;
  if (process.env.CONSULTING_AI_ENABLED !== "true" || !apiKey || !model) return NextResponse.json({ error: "Model assistance is not configured. The workbench checks and exports work without it. Ask the maintainer to configure an approved model route." }, { status: 503 });
  // This is per-process protection, not a distributed budget. Deployment remains
  // disabled until an operator sets provider-side spend/rate limits as documented.
  const now = Date.now(); for (const [key, time] of recent) if (now - time > 60_000) recent.delete(key);
  if (active.has(user.id) || recent.has(user.id) || active.size >= 4) return NextResponse.json({ error: "Please wait a minute before another model request." }, { status: 429 });
  active.add(user.id); recent.set(user.id, now);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45_000), body: JSON.stringify({ model, store: false, max_output_tokens: 6000, instructions: assistantInstructions, input: assistantInput(parsed.value, input.module), text: { format: suggestionFormat(input.module) } }) });
    if (!response.ok) return NextResponse.json({ error: "The model service could not complete this request. No project changes were applied." }, { status: 502 });
    const output: unknown = await response.json();
    if (!object(output) || output.status !== "completed" || !Array.isArray(output.output)) return NextResponse.json({ error: "The model response was incomplete. No changes were applied." }, { status: 502 });
    const text = output.output.filter(object).flatMap(item => Array.isArray(item.content) ? item.content.filter(object).filter(c => c.type === "output_text" && typeof c.text === "string").map(c => String(c.text)) : []).join("");
    let decoded: unknown; try { decoded = JSON.parse(text); } catch { return NextResponse.json({ error: "The model returned unreadable suggestions. No changes were applied." }, { status: 502 }); }
    const suggestions = parseSuggestions(decoded, input.module);
    if (!suggestions.ok) return NextResponse.json({ error: suggestions.error }, { status: 502 });
    return NextResponse.json({ suggestions: suggestions.value, model, projectRevision: parsed.value.revision }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The model request failed or timed out. Your project is unchanged." }, { status: 502 }); }
  finally { active.delete(user.id); }
}
