import test from "node:test";
import assert from "node:assert/strict";
import { sampleProject } from "@/lib/consulting-workbench/sample";
const user = { id: "synthetic-member", active: true, memberships: [{ cycleId: "cycle", role: "MEMBER", active: true }] };
const input = () => ({ cycleId: "cycle", module: "discovery", project: sampleProject() });
const request = (payload: unknown, origin = "https://example.com") => new Request("https://example.com/api/member/consulting", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
async function route(id: string): Promise<typeof import("./route")> { return import(`./route.ts?${id}`); }
test("cross-origin and signed-out requests cannot invoke a model", async t => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  const { POST } = await route("signed-out");
  assert.equal((await POST(request(input(), "https://attacker.invalid"))).status, 403);
  assert.equal((await POST(request(input()))).status, 401);
});
test("wrong cycle, invalid data class and oversized bodies fail closed", async t => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  const { POST } = await route("boundaries");
  assert.equal((await POST(request({ ...input(), cycleId: "other" }))).status, 403);
  assert.equal((await POST(request({ ...input(), project: { ...sampleProject(), dataClass: "confidential" } }))).status, 400);
  assert.equal((await POST(request({ ...input(), padding: "x".repeat(190000) }))).status, 413);
});
test("unconfigured provider is an explicit unavailable state, not simulated AI success", async t => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  const old = process.env.CONSULTING_AI_ENABLED; process.env.CONSULTING_AI_ENABLED = "false";
  t.after(() => { if (old === undefined) delete process.env.CONSULTING_AI_ENABLED; else process.env.CONSULTING_AI_ENABLED = old; });
  const { POST } = await route("unavailable"); const res = await POST(request(input())); assert.equal(res.status, 503);
  assert.match((await res.json()).error, /not configured/);
});
test("configured adapter sends no tools, disables response storage and strips model confirmations", async t => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  const previous = { enabled: process.env.CONSULTING_AI_ENABLED, key: process.env.CONSULTING_OPENAI_API_KEY, model: process.env.CONSULTING_OPENAI_MODEL };
  process.env.CONSULTING_AI_ENABLED = "true"; process.env.CONSULTING_OPENAI_API_KEY = "synthetic-test-key"; process.env.CONSULTING_OPENAI_MODEL = "synthetic-test-model";
  t.after(() => { for (const [name, value] of Object.entries({ CONSULTING_AI_ENABLED: previous.enabled, CONSULTING_OPENAI_API_KEY: previous.key, CONSULTING_OPENAI_MODEL: previous.model })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  let sent: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    sent = JSON.parse(String(options.body));
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Draft need", tables: [{ table: "requirements", rows: [sampleProject().records.requirements[0]] }] }) }] }] });
  });
  const { POST } = await route("configured"); const response = await POST(request(input()));
  assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.suggestions.tables[0].rows[0].state, "proposed"); assert.equal(sent.store, false); assert.equal(sent.tools, undefined);
  assert.equal((await POST(request(input()))).status, 429);
});
