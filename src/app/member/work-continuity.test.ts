import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { groupCaseWorkspaceState } from "./group-case/workspace-state";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, next: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
const STUBS = ["/evaluation-form.tsx", "/conflict-form.tsx", "/profile-form.tsx", "/buddy-slot-form.tsx", "/workspace-nav.tsx", "/logout-button.tsx"];
registerHooks({ load(url, context, next) {
  const path = url.split("?")[0]!;
  if (!path.endsWith(".tsx")) return next(url, context);
  if (STUBS.some((stub) => path.endsWith(stub))) return { format: "module", shortCircuit: true, source: "export default function Stub() { return null; }" };
  if (path.endsWith("/group-case-roster.tsx")) return { format: "module", shortCircuit: true, source: `import {createElement} from 'react'; export default function Stub({initial,readOnlyReason}) {return createElement('div',{'data-roster-status':initial.roundStatus,'data-read-only-reason':readOnlyReason},'Authoritative Group Case roster');}` };
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
} });

const user = { id: "member", name: "Test Member", email: "member@example.invalid", active: true, memberships: [{ active: true, role: "MEMBER", cycleId: "cycle", cycle: { name: "Synthetic cycle", status: "IN_PROCESS" } }] };
const round = { id: "group-case-round", status: "ACTIVE", closes_at: null };
const groupAssignment = { id: "observation", status: "SUBMITTED", updated_at: "2026-10-16T12:00:00Z", applications: { id: "applicant", pnms: { name: "Partial Group Case Applicant" } }, rounds: { ...round, kind: "GROUP_CASE", name: "Group Case", rubrics: [] }, evaluations: [{ status: "SUBMITTED" }] };
const roster = { roundId: "group-case-round", roundName: "Group Case", roundStatus: "ACTIVE", canSeeSpeedDating: false, criteria: [], progress: { scored: 0, total: 0 }, groups: [] };

type RoundFixture = { id: string; status: string; closes_at: string | null };
function setup(t: test.TestContext, options: { round?: RoundFixture | null; speedDating?: RoundFixture | null; hashStage?: string | null; assignments?: unknown[]; screening?: boolean; committee?: boolean; rpcError?: boolean; ballot?: { id: string; name: string }[]; votes?: { application_id: string; vote: string }[]; speedRoster?: unknown } = {}) {
  const seenStatuses: unknown[] = [];
  t.mock.module("next/image", { defaultExport: function ImageStub() { return null; } });
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers() } });
  t.mock.module("next/navigation", { namedExports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ refresh() {}, push() {} }) } });
  const suppliedRound = options.round === undefined ? round : options.round;
  const client = { from(table: string) {
    let roundKind = "GROUP_CASE";
    const data = table === "evaluation_assignments" ? options.assignments ?? [groupAssignment] : table === "rounds" ? suppliedRound : table === "profiles" ? {} : table === "hash_votes" ? options.votes ?? [] : [];
    const result = { data, error: null };
    const query = {
      select() { return query; }, eq(key: string, value: string) { if (key === "kind") roundKind = value; return query; }, order() { return query; }, limit() { return query; },
      in(_key: string, statuses: unknown) { if (roundKind !== "SPEED_DATING") seenStatuses.push(statuses); return query; },
      maybeSingle() { return Promise.resolve(table === "rounds" && roundKind === "SPEED_DATING" ? { data: options.speedDating ? { ...options.speedDating, kind: "SPEED_DATING" } : null, error: null } : result); },
      then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    };
    return query;
  }, rpc: async (name: string) => ({ data: name === "hash_ballot" ? options.ballot ?? [] : [], error: null }) };
  t.mock.module("@/lib/auth", { namedExports: { requireMember: async () => options.committee ? { ...user, memberships: [{ ...user.memberships[0], role: "RECRUITMENT_COMMITTEE" }] } : { ...user, memberships: [{ ...user.memberships[0], cycle: { ...user.memberships[0].cycle, hash_stage: options.hashStage ?? null } }] } } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/workspace-context", { namedExports: { loadWorkspaceContext: async () => ({ data: { isScreeningReviewer: options.screening === true, hasSpeedDatingRound: false }, error: null }) } });
  t.mock.module("./calibration/load", { namedExports: { loadCalibrationStates: async () => [] } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async (_client: unknown, name: string) => name === "group_case_roster_v2" ? { data: { ...roster, roundStatus: suppliedRound?.status }, error: options.rpcError ? { message: "roster unavailable" } : null } : name === "my_speed_dating_roster" ? { data: options.speedRoster ?? null, error: null } : { data: [], error: null } } });
  return { seenStatuses };
}

async function memberMarkup(caseName: string) {
  const { default: Page } = await import(`./page.tsx?case=${caseName}`) as typeof import("./page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}
async function groupCaseMarkup(caseName: string) {
  const { default: Page } = await import(`./group-case/page.tsx?case=${caseName}`) as typeof import("./group-case/page");
  return renderToStaticMarkup(await Page());
}

test("My work never labels saved Group Case observations immutable or completed", async (t) => {
  setup(t);
  const html = await memberMarkup("partial-group-case");
  assert.match(html, /Continue Group Case observations/);
  assert.match(html, /Saved evidence can still be edited/);
  assert.match(html, /href="\/member\/group-case\?cycleId=cycle"/);
  assert.doesNotMatch(html, /Partial Group Case Applicant|Your evaluation is locked/);
});

test("My work retains written evaluation immutability and finished work", async (t) => {
  setup(t, { assignments: [{ ...groupAssignment, rounds: { ...groupAssignment.rounds, kind: "INTERVIEW", name: "Written evaluation" }, applications: { id: "written", pnms: { name: "Written Applicant" } } }] });
  const html = await memberMarkup("written-immutable");
  assert.match(html, /Your evaluation is locked/);
  assert.match(html, /Written Applicant/);
});

for (const status of ["FROZEN", "FINALIZED", "ARCHIVED"]) {
  test(`My work and Group Case retain the ${status.toLowerCase()} review path`, async (t) => {
    const { seenStatuses } = setup(t, { round: { ...round, status } });
    const work = await memberMarkup(`work-${status}`);
    assert.match(work, /Review saved observations/);
    assert.match(work, /Grading closed/);
    assert.doesNotMatch(work, /Continue Group Case observations|Your evaluation is locked|Partial Group Case Applicant/);
    const dedicated = await groupCaseMarkup(`roster-${status}`);
    assert.match(dedicated, /Authoritative Group Case roster/);
    assert.match(dedicated, /data-read-only-reason="This round is read-only/);
    assert.doesNotMatch(dedicated, /No Group Case round is ready/);
    assert.ok(seenStatuses.every((statuses) => Array.isArray(statuses) && statuses.includes(status)));
  });
}

test("an active round past its deadline is read-only and never an open My work task", async (t) => {
  setup(t, { round: { ...round, closes_at: "2000-01-01T00:00:00Z" } });
  assert.doesNotMatch(await memberMarkup("expired-work"), /Continue Group Case observations/);
  assert.match(await groupCaseMarkup("expired-roster"), /data-read-only-reason="This round is read-only/);
});

test("active work continues through the dedicated workspace without inferred quality", async (t) => {
  setup(t);
  const html = await groupCaseMarkup("active-roster");
  assert.match(html, /Save what you observed, then check whether your review qualifies/);
  assert.match(html, /data-roster-status="ACTIVE"/);
  assert.doesNotMatch(html, /data-read-only-reason=/);
});

test("committee-only accounts cannot load the member roster", async (t) => {
  setup(t, { committee: true });
  const html = await groupCaseMarkup("committee");
  assert.match(html, /Group Case grading is for members/);
  assert.doesNotMatch(html, /Authoritative Group Case roster/);
});

test("screening reviewers do not receive Group Case tasks or workspace summaries", async (t) => {
  setup(t, { screening: true });
  const html = await memberMarkup("screening");
  assert.doesNotMatch(html, /Continue Group Case observations|Group Case observations<\/h3>/);
});

test("roster service failure does not masquerade as no published round", async (t) => {
  setup(t, { rpcError: true });
  await assert.rejects(groupCaseMarkup("unavailable"), /roster unavailable/);
});

test("workspace state describes availability, without claiming review validity", () => {
  assert.equal(groupCaseWorkspaceState({ status: "ACTIVE", closes_at: null }).kind, "active");
  assert.equal(groupCaseWorkspaceState({ status: "ACTIVE", closes_at: "2000-01-01T00:00:00Z" }).kind, "read-only");
  assert.equal(groupCaseWorkspaceState({ status: "PUBLISHED", closes_at: null }).kind, "preview");
  assert.equal(groupCaseWorkspaceState({ status: "ACTIVE", closes_at: "invalid" }).kind, "read-only");
});


test("published Speed Dating is preparation rather than an open grading task", async (t) => {
  setup(t, { round: null, speedDating: { id: "speed", status: "PUBLISHED", closes_at: null } });
  const html = await memberMarkup("published-speed");
  assert.match(html, /Prepare for Speed Dating/);
  assert.doesNotMatch(html, /Grade Speed Dating/);
});

test("active Speed Dating is discoverable and expired grading is not", async (t) => {
  setup(t, { round: null, speedDating: { id: "speed", status: "ACTIVE", closes_at: null } });
  assert.match(await memberMarkup("active-speed"), /Grade Speed Dating/);
});

test("expired Speed Dating never appears as an open task", async (t) => {
  setup(t, { round: null, speedDating: { id: "speed", status: "ACTIVE", closes_at: "2000-01-01T00:00:00Z" } });
  assert.doesNotMatch(await memberMarkup("expired-speed"), /Grade Speed Dating/);
});

test("Hash appears on My work only when this role is eligible for the open stage", async (t) => {
  setup(t, { round: null, hashStage: "SPEED_DATING" });
  assert.match(await memberMarkup("eligible-hash"), /Review your Hash ballot/);
});

test("My work shows the member's own ballot progress in their own vote colours", async (t) => {
  setup(t, { round: null, hashStage: "SPEED_DATING", ballot: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }], votes: [{ application_id: "a", vote: "YES" }, { application_id: "c", vote: "NO" }] });
  const html = await memberMarkup("hash-progress");
  assert.match(html, /Voted 2 of 3/);
  assert.match(html, /data-state="YES"[^]*data-state="empty"[^]*data-state="NO"/);
});

test("a finished ballot says so without hiding the way back in", async (t) => {
  setup(t, { round: null, hashStage: "SPEED_DATING", ballot: [{ id: "a", name: "A" }], votes: [{ application_id: "a", vote: "UNSURE" }] });
  const html = await memberMarkup("hash-complete");
  assert.match(html, /Ballot complete/);
  assert.match(html, /Review your Hash ballot/);
});

test("the Speed Dating task counts the member's own ratings", async (t) => {
  const applicant = (applicationId: string, score: number | null) => ({ applicationId, name: applicationId, score, note: "", session: null, savedAt: null });
  setup(t, { round: null, speedDating: { id: "speed", status: "ACTIVE", closes_at: null }, speedRoster: { roundId: "speed", roundName: "Speed Dating", roundStatus: "ACTIVE", criterion: null, rubricReady: true, progress: { scored: 1, total: 2 }, applicants: [applicant("x", 4), applicant("y", null)] } });
  const html = await memberMarkup("speed-progress");
  assert.match(html, /1 of 2 rated/);
  assert.match(html, /data-state="done"[^]*data-state="empty"/);
});

test("members do not receive the committee-only application Hash task", async (t) => {
  setup(t, { round: null, hashStage: "APPLICATION" });
  assert.doesNotMatch(await memberMarkup("ineligible-hash"), /Review your Hash ballot/);
});


test("committee-only members receive neither member grading tasks nor preparation", async (t) => {
  setup(t, { committee: true, speedDating: { id: "speed", status: "ACTIVE", closes_at: null } });
  assert.doesNotMatch(await memberMarkup("committee-work"), /Grade Speed Dating|Continue Group Case observations|Prepare for Speed Dating/);
});
