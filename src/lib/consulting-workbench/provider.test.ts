import test from "node:test";
import assert from "node:assert/strict";
import { moduleKeys, blankRow } from "./schema";
import { sampleProject } from "./sample";
import { gatewayModel, requestSuggestions, selectProvider } from "./provider";
test("Vercel native identity needs no manually configured provider key", () => {
  const p = selectProvider({ vercel: "1" }, "rotating-platform-token");
  assert.equal(p?.kind, "gateway"); assert.equal(p?.model, gatewayModel);
  assert.equal(p?.url, "https://ai-gateway.vercel.sh/v1/responses");
  assert.equal(selectProvider({}, "client-supplied-header"), null);
  assert.equal(selectProvider({ vercel: "1", enabled: "false" }, "platform-token"), null);
});
test("explicit direct provider remains supported and an absent runtime token fails closed", () => {
  assert.equal(selectProvider({ enabled: "true", directKey: "test", directModel: "test-model" }, null)?.kind, "openai");
  assert.equal(selectProvider({ vercel: "1" }, null), null);
});
test("all nine gateway request contracts remain schema-validated and bounded", async () => {
  const provider = selectProvider({ vercel: "1" }, "synthetic-platform-token"); if (!provider) throw new Error("fixture");
  for (const workflow of moduleKeys) {
    let body: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body));
      const table = workflow === "handoff" ? "handoff" : workflow === "discovery" ? "requirements" : "sources";
      const rows = workflow === "handoff" || workflow === "discovery" ? [{ ...blankRow(table), id: "new", ...(table === "handoff" ? { outcome: "passed", operator: "model" } : { state: "confirmed", confirmation: "model" }) }] : [];
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Synthetic response", tables: rows.length ? [{ table, rows }] : [] }) }] }], usage: { input_tokens: 10, output_tokens: 20 } });
    };
    const result = await requestSuggestions(provider, sampleProject(), workflow, fetcher);
    assert.equal(result.ok, true, workflow); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 3000); assert.equal(body.tools, undefined);
    if (result.ok && workflow === "handoff") assert.equal(result.suggestions.tables[0].rows[0].outcome, "not tested");
    if (result.ok && workflow === "discovery") assert.equal(result.suggestions.tables[0].rows[0].state, "proposed");
  }
});
test("provider auth/billing/transport errors never expose tokens or upstream response bodies", async () => {
  const p = selectProvider({ vercel: "1" }, "must-not-appear"); if (!p) throw new Error("fixture");
  for (const status of [401, 402, 403, 429, 500]) {
    const r = await requestSuggestions(p, sampleProject(), "review", async () => Response.json({ error: "secret-upstream-body" }, { status }));
    assert.equal(r.ok, false); assert.ok(!JSON.stringify(r).includes("must-not-appear")); assert.ok(!JSON.stringify(r).includes("secret-upstream-body"));
  }
  const r = await requestSuggestions(p, sampleProject(), "review", async () => { throw new Error("must-not-appear"); }); assert.equal(r.ok, false);
});
