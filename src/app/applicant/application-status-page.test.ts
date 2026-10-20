import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, writeFile } from "node:fs/promises";
register(`data:text/javascript,${encodeURIComponent(`
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  import ts from ${JSON.stringify(import.meta.resolve("typescript"))};
  export async function load(url, context, nextLoad) {
    if (!new URL(url).pathname.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    return { format: "module", shortCircuit: true, source: outputText };
  }
`)}`, import.meta.url);

test("actual applicant dashboard distinguishes saved drafts and requested changes throughout hero and history", async (t) => {
  let status = "DRAFT"; let access: "open" | "closed" | "failed" | "wrong-cycle" | "malformed" = "open";
  let schedule: "empty" | "booked" | "failed" = "empty"; let events = false; let olderDecision = false; let historyEditable = false; let canStart = false;
  let receipt: { id: string; status: string; submitted_at: string | null } | null = null;
  const current = () => ({ application_id: "app-current", applicant_name: "Synthetic Applicant", cycle_name: "Fall synthetic cycle", display_status: historyEditable ? "SUBMITTED" : status, released_outcome: null, offer_response: null, has_resume: true, responses: [{ key: "why", prompt: "Why?", answer: "Current private answer." }] });
  const older = () => ({ ...current(), application_id: "app-older", cycle_name: "Earlier synthetic cycle", display_status: historyEditable ? status : "REJECT", released_outcome: historyEditable ? null : "REJECT", responses: [{ key: "why", prompt: "Why?", answer: "Earlier private answer." }] });
  const calls: { table: string; ids?: string[] }[] = [];
  const client = {
    async rpc(name: string) {
      if (name === "applicant_dashboard") return { data: [current(), ...(olderDecision || historyEditable ? [older()] : [])], error: null };
      if (name === "applicant_schedule") return { data: schedule === "booked" ? { rsvps: [{ slotId: "booked", eventId: "event", eventName: "Booked introduction", startsAt: "2099-01-01T12:00:00Z", endsAt: "2099-01-01T13:00:00Z", location: "GG Brown" }] } : {}, error: schedule === "failed" ? { message: "Schedule unavailable" } : null };
      if (name === "can_start_application") return { data: canStart, error: null };
      if (name === "intake_schema") return { data: access === "closed" ? { open: false, cycleId: null, draft: null } : access === "malformed" ? { open: true, cycleId: "fall", needsInfo: status === "NEEDS_INFO", draft: {} } : { open: true, cycleId: access === "wrong-cycle" ? "different" : "fall", needsInfo: status === "NEEDS_INFO", draft: { name: "Synthetic Applicant", revision: "10000000-0000-4000-8000-000000000001" } }, error: access === "failed" ? { message: "Intake unavailable" } : null };
      if (name === "public_recruitment") return { data: { events: events ? [{ id: "public-event", name: "Public introduction", startsAt: "2099-01-01T12:00:00Z", location: "GG Brown" }] : [] }, error: null };
      if (name === "my_offer_deadlines") return { data: {}, error: null };
      return { data: [], error: null };
    },
    from(table: string) {
      return { select() { return {
        async in(_column: string, ids: string[]) { calls.push({ table, ids }); return { data: ids.map((id) => ({ id, cycle_id: historyEditable ? "earlier" : "fall", status })), error: null }; },
        eq() { return { async maybeSingle() { return { data: receipt, error: null }; } }; },
        async order() { return { data: [], error: null }; },
      }; } };
    },
  };
  t.mock.module("next/image", { defaultExport: ({ src, alt, width, height, className, style }: { src: string; alt: string; width: number; height: number; className?: string; style?: CSSProperties }) => createElement("img", { src, alt, width, height, className, style }) });
  t.mock.module("@/lib/auth", { namedExports: { requireUser: async () => ({}), currentDestination: async () => "/apply" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const empty = () => null;
  t.mock.module("@/components/logout-button", { defaultExport: empty });
  t.mock.module("./actions", { namedExports: { BuddyButton: empty, OfferButtons: empty, SlotButton: empty, SurveyForm: empty, WithdrawButton: empty } });
  for (const path of ["./status-refresh", "./headshot-upload", "./resume-replace", "./onboarding", "./schedule-action"]) t.mock.module(path, { defaultExport: empty });
  t.mock.method(console, "error", () => {});
  const { default: Dashboard } = await import("./page");
  const render = async (submitted?: string) => renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({ submitted }) }));
  const capture = async (name: string, html: string) => {
    if (process.env.APPLICANT_STATUS_CAPTURE !== "1") return;
    await mkdir(".audit/applicant-editable-status/fixtures", { recursive: true });
    await writeFile(`.audit/applicant-editable-status/fixtures/${name}.html`, html);
  };
  for (const editableStatus of ["DRAFT", "NEEDS_INFO"]) {
    await t.test(`${editableStatus} hero and current history retain the required application task with empty or booked schedules`, async () => {
      status = editableStatus; access = "open"; olderDecision = true; historyEditable = false;
      for (const scheduleState of ["empty", "booked", "failed"] as const) {
        schedule = scheduleState; events = scheduleState === "booked";
        const html = await render("app-current");
        assert.match(html, editableStatus === "DRAFT" ? /<h1[^>]*>Your application is a draft\.<\/h1>/ : /<h1[^>]*>Your application needs changes\.<\/h1>/);
        assert.match(html, editableStatus === "DRAFT" ? /Current application · Draft · Not submitted/ : /Current application · Changes requested · Resubmission needed/);
        assert.match(html, editableStatus === "DRAFT" ? /href="\/apply"[^>]*>Continue application/ : /href="\/apply"[^>]*>Review and resubmit/);
        assert.doesNotMatch(html, /caught up|No action needed|moving through review|Application received/);
        const hero = html.slice(html.indexOf("<h1")).split("</section>")[0]; assert.doesNotMatch(hero, /<ol|Submitted|aria-current="step"/);
        assert.match(html, /Earlier private answer|Current private answer/); assert.match(html, /Resume on file/); assert.match(html, /Decision released/);
        if (scheduleState === "empty") await capture(`${editableStatus.toLowerCase()}-open`, html);
        if (scheduleState === "booked") { assert.match(html, /Booked introduction/); assert.match(html, /Public introduction/); }
        if (scheduleState === "failed") { assert.match(html, /Your schedule could not be loaded/); assert.match(html, /Retry schedule lookup/); assert.doesNotMatch(html, /No RSVPs yet/); }
      }
      assert.ok(calls.some(({ table, ids }) => table === "applications" && ids?.length === 1 && ids[0] === "app-current"));
    });
    await t.test(`${editableStatus} closed, failed and mismatched-cycle access never promises editing or invents a deadline`, async () => {
      status = editableStatus; historyEditable = false; olderDecision = false; schedule = "empty"; events = false;
      for (const state of ["closed", "failed", "wrong-cycle", "malformed"] as const) {
        access = state; const html = await render();
        if (state === "closed") await capture(`${editableStatus.toLowerCase()}-closed`, html);
        assert.doesNotMatch(html, /href="\/apply"|caught up|moving through review|deadline has passed|Applications closed/);
        assert.match(html, /href="mailto:mecg-board@umich.edu"[^>]*>Contact recruitment team/);
        assert.match(html, state === "failed" || state === "malformed" ? /Application access could not be verified/ : /Application editing is unavailable/);
      }
    });
    await t.test(`${editableStatus} earlier history stays truthful beside a genuinely submitted current application`, async () => {
      status = editableStatus; access = "open"; historyEditable = true; olderDecision = false; schedule = "empty";
      const html = await render(); const earlier = html.slice(html.indexOf('Earlier synthetic cycle'));
      assert.match(earlier, editableStatus === "DRAFT" ? /Earlier application · Draft · Not submitted/ : /Earlier application · Changes requested · Resubmission needed/);
      assert.doesNotMatch(earlier.split('</details>')[0], /moving through review|Submitted|aria-current="step"|href="\/apply"/);
      assert.match(html, /Your application is moving through review/); assert.match(html, /Earlier private answer/);
    });
  }
  await t.test("an earlier closed draft does not block an authoritative opportunity to start a new cycle", async () => {
    status = "DRAFT"; access = "wrong-cycle"; historyEditable = false; olderDecision = false; canStart = true;
    const html = await render(); assert.match(html, /Start this cycle&#x27;s application/); assert.match(html, /href="\/apply"[^>]*>Start application/); assert.match(html, /Draft · Not submitted/); canStart = false;
  });
  await t.test("received confirmation remains tied to a real submission and retains identifying-resume disclosure", async () => {
    status = "SUBMITTED"; historyEditable = false; olderDecision = false; receipt = { id: "app-current", status: "SUBMITTED", submitted_at: "2026-10-16T12:00:00Z" };
    const html = await render("app-current"); assert.match(html, /Application received/); assert.match(html, /Assigned reviewers may view your original resume, which can identify you/);
    for (const editableStatus of ["DRAFT", "NEEDS_INFO"]) { status = editableStatus; receipt = { id: "app-current", status, submitted_at: null }; assert.doesNotMatch(await render("app-current"), /Application received/); }
  });
});
