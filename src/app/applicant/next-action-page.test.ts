import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile the real page's JSX in the loader worker, including mock.module's
// inspection of component dependencies. Node's native TS loader cannot read TSX.
register(`data:text/javascript,${encodeURIComponent(`
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  import ts from ${JSON.stringify(import.meta.resolve("typescript"))};
  export async function load(url, context, nextLoad) {
    if (!new URL(url).pathname.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  }
`)}`, import.meta.url);

test("dashboard next action and schedule recover from an isolated schedule RPC failure", async (t) => {
  let scheduleFailed = true;
  let releasedOutcome: string | null = null;
  let deadlineFailed = false;
  let deadline: unknown = null;
  let omitDeadline = false;
  let showRecruitmentEvent = false;
  let accepted = false;
  let onboarding: unknown[] = [];
  const rpcCalls: string[] = [];
  let receiptRow: { id: string; status: string; submitted_at: string | null } | null = null;
  const client = {
    async rpc(name: string) {
      rpcCalls.push(name);
      if (name === "applicant_dashboard") return { data: [{
        application_id: "app-1", applicant_name: "Test Applicant", cycle_name: "Fall 2026",
        display_status: "SUBMITTED", released_outcome: releasedOutcome, offer_response: accepted ? "ACCEPTED" : null,
        has_resume: true, responses: [{ key: "why", prompt: "Why MECG?", answer: "Applicant response stays visible." }],
      }], error: null };
      if (name === "applicant_schedule") return {
        data: scheduleFailed ? null : {},
        error: scheduleFailed ? { code: "503", message: "Schedule service unavailable" } : null,
      };
      if (name === "my_offer_deadlines") return { data: omitDeadline ? {} : { "app-1": deadline }, error: deadlineFailed ? { message: "unavailable" } : null };
      if (name === "public_recruitment") return { data: showRecruitmentEvent ? { events: [{ id: "event-1", name: "Group Case evening", startsAt: "2099-10-17T19:00:00Z", location: "Michigan Union" }] } : null, error: null };
      if (name === "my_member_onboarding") return { data: onboarding, error: null };
      if (name === "can_start_application") return { data: false, error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      if (table === "applications") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: receiptRow, error: null }) }) }) };
      return { select() { return { async order() { return { data: [], error: null }; } }; } }; },
  };
  const empty = () => null;
  t.mock.module("@/lib/auth", { namedExports: { requireUser: async () => ({}), currentDestination: async () => "/applicant" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/components/portal-shell", { defaultExport: ({ children }: { children: ReactNode }) => createElement("main", null, children) });
  t.mock.module("@/components/logout-button", { defaultExport: empty });
  t.mock.module("./actions", { namedExports: { BuddyButton: empty, OfferButtons: empty, SlotButton: empty, SurveyForm: empty, WithdrawButton: empty } });
  for (const path of ["./status-refresh", "./headshot-upload", "./resume-replace", "./onboarding", "./schedule-action"]) {
    t.mock.module(path, { defaultExport: empty });
  }
  const logs = t.mock.method(console, "error", () => {});
  const { default: Dashboard } = await import("./page");
  const render = async (submitted?: string) => renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({ submitted }) }));

  await t.test("failure preserves the application and shows real retry/contact controls without empty claims", async () => {
    const html = await render();
    assert.ok(rpcCalls.includes("applicant_schedule"));
    assert.match(html, /Your schedule could not be loaded/);
    assert.match(html, /action="\/applicant#applicant-schedule" method="get"/);
    assert.match(html, /type="submit"[^>]*>Retry schedule lookup/);
    assert.match(html, /href="mailto:mecg-board@umich.edu"[^>]*>Contact recruitment team/);
    assert.match(html, /Applicant response stays visible/);
    assert.match(html, /Resume on file/);
    assert.doesNotMatch(html, /caught up|No action needed|No RSVPs yet|>Confirmed</);
    assert.equal(logs.mock.callCount(), 1);
  });

  await t.test("an offer keeps priority while schedule failure remains recoverable", async () => {
    releasedOutcome = "OFFER";
    const html = await render();
    assert.match(html, /Respond to your offer/);
    assert.match(html, /Your schedule could not be loaded/);
    assert.doesNotMatch(html, /caught up|No RSVPs yet/);
  });

  await t.test("an unavailable offer deadline never implies an open window even with stale future or expired data", async () => {
    deadlineFailed = true;
    for (const value of ["2099-01-01T00:00:00Z", "2020-01-01T00:00:00Z"]) {
      deadline = value;
      const html = await render();
      assert.match(html, /Check your offer response window/);
      assert.match(html, /Your response window may have closed/);
      assert.match(html, /Retry offer deadline lookup/);
      assert.doesNotMatch(html, /Respond to your offer|Respond by|This offer expired on/);
    }
    deadlineFailed = false;
    deadline = null;
  });

  await t.test("malformed deadline entries are unknown while contractual missing keys mean no deadline", async () => {
    for (const value of ["not-a-date", "2026-02-30T00:00:00Z", 123, {}]) {
      deadline = value;
      const html = await render();
      assert.match(html, /Check your offer response window/);
      assert.match(html, /Retry offer deadline lookup/);
      assert.doesNotMatch(html, /Invalid date|Respond to your offer|Respond by/);
    }
    omitDeadline = true;
    assert.match(await render(), /Respond to your offer/);
    assert.doesNotMatch(await render(), /Retry offer deadline lookup/);
    omitDeadline = false;
    deadline = null;
  });

  await t.test("submission banner requires the owned application and authoritative submitted state", async () => {
    receiptRow = { id: "app-1", status: "SUBMITTED", submitted_at: "2026-10-16T12:00:00Z" };
    assert.doesNotMatch(await render("1"), /Application received/);
    assert.doesNotMatch(await render("forged-application"), /Application received/);
    const received = await render("app-1");
    assert.match(received, /Application received/);
    assert.match(received, /Assigned reviewers may view your original resume, which can identify you/);
    assert.doesNotMatch(received, /anonymous first-pass/);
    receiptRow = { id: "app-1", status: "DRAFT", submitted_at: null };
    assert.doesNotMatch(await render("app-1"), /Application received/);
  });

  await t.test("a subsequent successful lookup restores genuine empty-state copy", async () => {
    releasedOutcome = null;
    scheduleFailed = false;
    const html = await render();
    assert.match(html, /You&#x27;re caught up/);
    assert.match(html, /No RSVPs yet/);
    assert.doesNotMatch(html, /Your schedule could not be loaded|Retry schedule lookup/);
  });

  await t.test("published recruitment dates are optional while the personal schedule stays directly available", async () => {
    showRecruitmentEvent = true;
    const html = await render();
    assert.match(html, /<details class="applicant-timeline[^>]*><summary[^>]*>Recruitment dates/);
    assert.doesNotMatch(html, /<details[^>]*open[^>]*class="applicant-timeline/);
    assert.ok(html.indexOf('id="applicant-schedule"') < html.indexOf('class="applicant-timeline'));
    assert.match(html, /Group Case evening/);
    assert.match(html, /href="\/api\/events\/event-1\/ics"/);
    assert.match(html, /Michigan Union/);
    assert.match(html, /<details class="applicant-record-disclosure[^>]*><summary[^>]*>Application answers/);
    showRecruitmentEvent = false;
  });

  await t.test("accepted applicants are not assigned Board-owned onboarding work", async () => {
    accepted = true;
    releasedOutcome = "OFFER";
    onboarding = [
      { applicationId: "app-1", key: "CONTACT_CONFIRMATION", completedAt: "2026-10-17T12:00:00Z" },
      { applicationId: "app-1", key: "ORIENTATION", completedAt: null },
    ];
    const html = await render();
    assert.match(html, /Your steps are complete/);
    assert.match(html, /MECG is completing the remaining onboarding steps/);
    assert.doesNotMatch(html, /1 step for you to complete/);
    onboarding[0] = { applicationId: "app-1", key: "CONTACT_CONFIRMATION", completedAt: null };
    assert.match(await render(), /1 step for you to complete/);
    accepted = false;
    onboarding = [];
  });

  await t.test("released rejection does not invent a personal selection rationale", async () => {
    releasedOutcome = "REJECT";
    const html = await render();
    assert.match(html, /Thank you for the time you put into your application/);
    assert.doesNotMatch(html, /competitive process|cohort fit|not a shortfall/);
  });
});
