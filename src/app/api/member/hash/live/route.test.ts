import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const USER = { id: "member", memberships: [{ role: "MEMBER", cycleId: "cycle", active: true }] };
const VISIBLE = { id: "presenter", name: "Visible applicant", major: null, class_year: null };

function importRoute(key: string) {
  return import(`./route.ts?case=${key}`) as Promise<typeof import("./route.ts")>;
}

// Conflict/stage/decision filtering belongs to hash_ballot. Exercise both an
// empty ballot and a ballot containing someone other than the selected presenter.
for (const hasOtherApplicant of [false, true]) {
  test(`Hash excludes presenter and requested notes absent from caller ballot (other applicant: ${hasOtherApplicant})`, async (t) => {
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("service role bypass"); } } });
    const client = {
      from: (table: string) => {
        assert.equal(table, "rush_cycles");
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { hash_presenting_application_id: "presenter" }, error: null }) }) }) };
      },
      rpc: async (name: string, args: unknown) => {
        assert.equal(name, "hash_ballot", "must never load notes for an excluded applicant");
        assert.deepEqual(args, { target_cycle_id: "cycle" });
        return { data: hasOtherApplicant ? [{ ...VISIBLE, id: "other" }] : [], error: null };
      },
    };
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
    const { GET } = await importRoute(`excluded-${hasOtherApplicant}`);
    const response = await GET(new NextRequest("http://localhost/api/member/hash/live?applicationId=presenter"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { presentingId: null, presenting: null, applicationId: null, notes: [] });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
}

for (const requested of ["", "?applicationId=other", "?applicationId=hidden"]) {
  test(`Hash uses caller ballot metadata and gates notes for request ${requested || "presenter"}`, async (t) => {
    const notesFor: string[] = [];
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { hash_presenting_application_id: "presenter" }, error: null }) }) }) }),
      rpc: async (name: string, args: { target_application_id?: string }) => {
        if (name === "hash_ballot") return { data: [VISIBLE, { ...VISIBLE, id: "other" }], error: null };
        assert.equal(name, "hash_applicant_notes");
        notesFor.push(args.target_application_id ?? "");
        return { data: [{ source: "GROUP_CASE", note: "Evidence" }], error: null };
      },
    }) } });
    const { GET } = await importRoute(`visible-${requested}`);
    const response = await GET(new NextRequest(`http://localhost/api/member/hash/live${requested}`));
    const body = await response.json();
    assert.deepEqual(body.presenting, { id: "presenter", name: "Visible applicant", meta: "", decided: null });
    assert.equal(body.presentingId, "presenter");
    assert.deepEqual(notesFor, requested.includes("hidden") ? [] : [requested.includes("other") ? "other" : "presenter"]);
    assert.equal(body.applicationId, requested.includes("hidden") ? null : requested.includes("other") ? "other" : "presenter");
  });
}

for (const user of [null, { memberships: [] }, USER]) {
  test(`Hash rejects missing membership or ballot eligibility: ${JSON.stringify(user)}`, async (t) => {
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => {
      assert.equal(user, USER);
      return {
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { hash_presenting_application_id: "presenter" }, error: null }) }) }) }),
        rpc: async () => ({ data: null, error: { code: "42501", message: "membership required" } }),
      };
    } } });
    const { GET } = await importRoute(`auth-${JSON.stringify(user)}`);
    const response = await GET(new NextRequest("http://localhost/api/member/hash/live"));
    assert.equal(response.status, user === null ? 401 : 403);
    assert.equal(JSON.stringify(await response.json()).includes("presenter"), false);
  });
}
