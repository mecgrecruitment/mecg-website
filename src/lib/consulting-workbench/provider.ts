import { assistantInput, assistantInstructions, parseSuggestions, suggestionFormat, type Suggestions } from "./assistant";
import { object, type Module, type Project } from "./schema";
export const gatewayModel = "openai/gpt-4.1-mini";
export type Provider = { kind: "gateway" | "openai"; url: string; token: string; model: string };
export type ProviderEnvironment = { enabled?: string; vercel?: string; gatewayKey?: string; gatewayModel?: string; directKey?: string; directModel?: string };
export function selectProvider(env: ProviderEnvironment, runtimeOidc: string | null): Provider | null {
  if (env.enabled === "false") return null;
  if (env.enabled === "true" && env.directKey && env.directModel) return { kind: "openai", url: "https://api.openai.com/v1/responses", token: env.directKey, model: env.directModel };
  const token = env.gatewayKey || (env.vercel === "1" ? runtimeOidc : null);
  return token ? { kind: "gateway", url: "https://ai-gateway.vercel.sh/v1/responses", token, model: env.gatewayModel || gatewayModel } : null;
}
export type ProviderResult = { ok: true; suggestions: Suggestions; model: string; kind: Provider["kind"]; inputTokens: number | null; outputTokens: number | null } | { ok: false; status: number; code: string; error: string };
export async function requestSuggestions(provider: Provider, project: Project, workflow: Module, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  try {
    const response = await fetcher(provider.url, { method: "POST", headers: { Authorization: `Bearer ${provider.token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(45_000), body: JSON.stringify({ model: provider.model, store: false, max_output_tokens: 3000, instructions: assistantInstructions, input: assistantInput(project, workflow), text: { format: suggestionFormat(workflow) } }) });
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "AI Gateway could not authorize this project. Check the project's OIDC/Gateway access." : response.status === 402 ? "AI Gateway credit or spend allowance is exhausted. Local checks and exports remain available." : response.status === 429 ? "The AI provider is rate limited. Wait before trying again." : "The AI provider rejected the request. No project changes were applied.";
      return { ok: false, status: response.status === 429 ? 429 : 503, code: `provider_http_${response.status}`, error: message };
    }
    const output: unknown = await response.json();
    if (!object(output) || output.status !== "completed" || !Array.isArray(output.output)) return { ok: false, status: 502, code: "incomplete", error: "The model response was incomplete. No changes were applied." };
    const text = output.output.filter(object).flatMap(item => Array.isArray(item.content) ? item.content.filter(object).filter(c => c.type === "output_text" && typeof c.text === "string").map(c => String(c.text)) : []).join("");
    let decoded: unknown; try { decoded = JSON.parse(text); } catch { return { ok: false, status: 502, code: "invalid_json", error: "The model returned unreadable suggestions. No changes were applied." }; }
    const parsed = parseSuggestions(decoded, workflow);
    if (!parsed.ok) return { ok: false, status: 502, code: "invalid_schema", error: parsed.error };
    const usage = object(output.usage) ? output.usage : {};
    return { ok: true, suggestions: parsed.value, model: provider.model, kind: provider.kind, inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null, outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null };
  } catch { return { ok: false, status: 502, code: "transport", error: "The model request failed or timed out. Your project is unchanged." }; }
}
