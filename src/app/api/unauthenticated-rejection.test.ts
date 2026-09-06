import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Every guarded route handler, invoked as an unauthenticated caller, must
// reject before it touches Supabase. Session routes get `currentUser()`
// stubbed to null; cron routes get a CRON_SECRET with no matching
// Authorization header. Adding a route is one row below.
//
// "./" is relative to src/app/api. Four handlers live outside it, under
// src/app/{admin,member,applicant}, and are reached with "../"; they are as
// privileged as anything in the table, so they belong in it.
//
// Deliberately excluded (not guarded, so nothing to assert):
//   account/password, admin/login, admin/logout, auth/forgot-password,
//   auth/login, auth/logout, auth/reset-password, auth/signup, contact,
//   events/[id]/ics, health, interest  - public or self-authenticating routes
//   webhooks/clerk                     - signature-verified webhook, no session
// Every route that returns 401/403 from its own source is in the table.

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Guard = "session" | "cron";
type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const ROUTES: Array<{ path: string; methods: Method[]; expect: number; guard?: Guard }> = [
  { path: "./admin/applications/[id]/headshot/route.ts", methods: ["GET"], expect: 401 },
  { path: "./admin/applications/[id]/resume/route.ts", methods: ["GET"], expect: 401 },
  { path: "./admin/decisions/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/events/[id]/assisted-checkin/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/events/[id]/rotate/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/events/[id]/route.ts", methods: ["PATCH", "DELETE"], expect: 401 },
  { path: "./admin/events/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/export/route.ts", methods: ["GET"], expect: 401 },
  { path: "./admin/hash-results/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/messages/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/notifications/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/operations/route.ts", methods: ["GET"], expect: 401 },
  { path: "./admin/projects/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/referrals/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/rush/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/screening/route.ts", methods: ["POST"], expect: 401 },
  { path: "./admin/setup/route.ts", methods: ["POST"], expect: 401 },
  { path: "./applicant/buddy/route.ts", methods: ["POST"], expect: 401 },
  { path: "./applicant/offer/route.ts", methods: ["POST"], expect: 401 },
  { path: "./applicant/rsvp/route.ts", methods: ["POST"], expect: 401 },
  { path: "./applicant/survey/route.ts", methods: ["POST"], expect: 401 },
  { path: "./applicant/withdraw/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/draft/route.ts", methods: ["GET", "POST"], expect: 401 },
  { path: "./apply/headshot/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/resume/attach/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/resume/cancel/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/resume/finalize/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/resume/route.ts", methods: ["GET"], expect: 401 },
  { path: "./apply/resume/start/route.ts", methods: ["POST"], expect: 401 },
  { path: "./apply/route.ts", methods: ["POST"], expect: 401 },
  { path: "./checkin/[token]/route.ts", methods: ["POST"], expect: 401 },
  { path: "./maintenance/notifications/route.ts", methods: ["GET", "POST"], expect: 401, guard: "cron" },
  { path: "./maintenance/prune-resumes/route.ts", methods: ["GET", "POST"], expect: 401, guard: "cron" },
  { path: "./maintenance/reminders/route.ts", methods: ["GET", "POST"], expect: 401, guard: "cron" },
  { path: "./member/buddy/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/conflicts/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/evaluations/[assignmentId]/draft/route.ts", methods: ["GET", "PUT", "DELETE"], expect: 401 },
  { path: "./member/evaluations/[assignmentId]/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/hash-votes/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/impressions/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/profile/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/referrals/route.ts", methods: ["POST"], expect: 401 },
  { path: "./member/screening/draft/route.ts", methods: ["GET", "PUT"], expect: 401 },
  { path: "./member/screening/route.ts", methods: ["POST"], expect: 401 },
  { path: "../admin/people/onboarding/route.ts", methods: ["POST"], expect: 401 },
  { path: "../applicant/onboarding/route.ts", methods: ["POST"], expect: 401 },
  { path: "../applicant/schedule/route.ts", methods: ["POST"], expect: 401 },
  { path: "../member/calibration/acknowledge/route.ts", methods: ["POST"], expect: 401 },
];

function request(path: string, method: Method) {
  const pathname = path.replace(/^\.\.\//, "/").replace(/^\.\//, "/api/").replace(/\/route\.ts$/, "");
  return new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : "{}",
  });
}

for (const row of ROUTES) {
  for (const method of row.methods) {
    test(`${row.path} ${method} -> ${row.expect}`, async (t) => {
      t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
      t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true, clientIp: () => "203.0.113.7" } });
      t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
      t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
      const previousSecret = process.env.CRON_SECRET;
      if (row.guard === "cron") process.env.CRON_SECRET = "test-cron-secret";
      try {
        const mod = (await import(`${row.path}?case=unauth-${method}`)) as Record<string, Handler>;
        const handler = mod[method];
        assert.equal(typeof handler, "function", `${row.path} does not export ${method}`);
        const res = await handler!(request(row.path, method), { params: Promise.resolve({ id: "x", assignmentId: "x", token: "x" }) });
        assert.equal(res.status, row.expect);
      } finally {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
      }
    });
  }
}
