import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

registerHooks({ load(url, context, next) {
  const path = url.split("?")[0];
  if (!path.endsWith(".tsx")) return next(url, context);
  const source = readFileSync(fileURLToPath(path), "utf8");
  if (source.startsWith('"use client"') || path.endsWith("/workspace-nav.tsx")) return {
    format: "module", shortCircuit: true,
    source: "export default function Stub(){return null;} export function AddApplicantForm(){return null;}",
  };
  return { format: "module", shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
} });

function setup(t, failure) {
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers({ host: "localhost:3000" }) } });
  t.mock.module("next/navigation", { namedExports: { redirect: (path) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } } });
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => ({ name: "Synthetic operator", memberships: [] }) } });
  t.mock.module("@/lib/authorization", { namedExports: { hasPermission: () => true } });
  t.mock.module("@/lib/workspace-cycle", { namedExports: { selectWorkspaceCycle: async () => "cycle" } });
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const event = { id: "event", name: "Synthetic event", cycle_id: "cycle", status: "PUBLISHED", starts_at: future, checkin_opens_at: future, checkin_closes_at: future, checkins: [{ count: 1 }], member_grading: true };
  const rows = {
    rush_cycles: { id: "cycle", name: "Synthetic cycle", status: "IN_PROCESS" },
    rounds: [],
    applications: [{ id: "app", pnm_id: "pnm", status: "FINAL_REVIEW", submitted_at: past, resume_storage_path: "resume", pnms: { name: "Synthetic applicant", contact: "synthetic@example.test", major: "Engineering" } }],
    events: [{ ...event, id: "past", name: "Past synthetic event", starts_at: past }, event],
    event_slots: [], evaluation_assignments: [], referrals: [],
    checkins: [{ pnm_id: "pnm", checked_in_at: future, pnms: { name: "Synthetic applicant" } }],
    event_impressions: [], member_checkins: [],
    messages: [{ id: "message", kind: "EMAIL", recipient: "synthetic@example.test", subject: "Synthetic subject", delivered: true, created_at: past }],
  };
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ from(table) {
    const result = { data: rows[table] ?? [], count: 1, error: table === failure ? new Error("Synthetic lookup failure") : null };
    const query = {
      select() {return query;}, eq() {return query;}, neq() {return query;}, not() {return query;}, order() {return query;}, limit() {return query;},
      single() {return Promise.resolve(result);}, maybeSingle() {return Promise.resolve({ ...result, data: table === "events" ? event : result.data });},
      then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    };
    return query;
  } }) } });
}

test("overview final-review status is not evidence readiness and the next event precedes history", async (t) => {
  setup(t);
  const { default: Page } = await import("./page.tsx?operating=overview");
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /in final review/);
  assert.doesNotMatch(html, /ready for final review|release-ready/i);
  assert.match(html, /filter=FINAL_REVIEW&amp;cycleId=cycle#applicants/);
  assert.ok(html.indexOf("Synthetic event</a>") < html.indexOf("Past events"));
  assert.ok(html.indexOf('aria-label="Cycle priorities"') < html.indexOf('class="recruitment-main'));
});

test("event operating sections precede settings and unavailable observations never become zero", async (t) => {
  setup(t, "event_impressions");
  const { default: Page } = await import("./events/[id]/page.tsx?operating=event");
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "event" }), searchParams: Promise.resolve({}) }));
  assert.match(html, /Observations unavailable/);
  assert.doesNotMatch(html, />0 observations</);
  assert.ok(html.indexOf('id="event-attendance"') < html.indexOf('id="event-settings"'));
  assert.match(html, /<details id="event-settings"/);
  for (const [, target] of html.matchAll(/href="#(event-[^" ]+)"/g)) assert.ok(html.includes(`id="${target}"`));
});

test("message history reports provider acceptance without claiming inbox delivery", async (t) => {
  setup(t);
  const { default: Page } = await import("./messages/page.tsx?operating=history");
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ view: "history" }) }));
  assert.match(html, /Sent to provider/);
  assert.match(html, /not inbox delivery/);
  assert.doesNotMatch(html, />Delivered</);
});

test("failed message history offers recovery rather than an empty send log", async (t) => {
  setup(t, "messages");
  const { default: Page } = await import("./messages/page.tsx?operating=failed-history");
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ view: "history" }) }));
  assert.match(html, /Message history is unavailable/);
  assert.doesNotMatch(html, /Nothing has been sent/);
});
