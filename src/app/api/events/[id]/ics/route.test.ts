import test from "node:test";
import assert from "node:assert/strict";

const EVENT = {
  id: "event-1",
  name: "Info Night, Round 2; \"Bring a friend\"\nRSVP required",
  startsAt: "2026-09-10T18:00:00.000Z",
  endsAt: "2026-09-10T19:00:00.000Z",
  location: "Chrysler Center, Room 220; ask for MECG",
};

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

test("GET /api/events/[id]/ics escapes commas, semicolons, backslashes, and newlines per RFC 5545", async (t) => {
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => ({ rpc: async () => ({ data: { events: [EVENT] }, error: null }) }) },
  });
  const { GET } = await importRoute("escaping");
  const res = await GET(new Request("http://localhost/api/events/event-1/ics"), params("event-1"));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body.includes("SUMMARY:Info Night\\, Round 2\\; \"Bring a friend\"\\nRSVP required"), true);
  assert.equal(body.includes("LOCATION:Chrysler Center\\, Room 220\\; ask for MECG"), true);
  // Unescaped structural characters must not appear inside the SUMMARY/LOCATION values.
  assert.equal(/SUMMARY:[^\r\n]*[,;](?!\\)/.test(body.replace(/\\[,;]/g, "")), false);
});

test("GET /api/events/[id]/ics escapes a literal backslash", async (t) => {
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async () => ({ data: { events: [{ ...EVENT, name: "Case night \\ prep", location: null }] }, error: null }),
      }),
    },
  });
  const { GET } = await importRoute("backslash");
  const res = await GET(new Request("http://localhost/api/events/event-1/ics"), params("event-1"));
  const body = await res.text();
  assert.equal(body.includes("SUMMARY:Case night \\\\ prep"), true);
});

test("GET /api/events/[id]/ics returns 404 for an unknown id", async (t) => {
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => ({ rpc: async () => ({ data: { events: [] }, error: null }) }) },
  });
  const { GET } = await importRoute("not-found");
  const res = await GET(new Request("http://localhost/api/events/missing/ics"), params("missing"));
  assert.equal(res.status, 404);
});
