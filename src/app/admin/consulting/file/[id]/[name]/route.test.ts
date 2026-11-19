// design-owner: client:mecg because it tests the MECG workspace consulting hub.
import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { HubBundle } from "@/lib/consulting-hub/format";

// Synthetic bundle; the real hub is only ever loaded from the encrypted file.
const bundle = {
  manifest: {
    files: [
      { id: "pdf1", name: "brief.pdf", mime: "application/pdf", inline: true, sandbox: false, offset: 0, size: 4 },
      { id: "web1", name: "dash.html", mime: "text/html; charset=utf-8", inline: true, sandbox: true, offset: 4, size: 6 },
      { id: "doc1", name: "plan.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false, sandbox: false, offset: 10, size: 2 },
    ],
  },
  blob: Buffer.from("%PDF<html>PK"),
} as unknown as HubBundle;

const member = (role: string) => ({ id: "u1", memberships: [{ active: true, role, cycleId: "c1" }] });

async function call(t: test.TestContext, user: unknown, id: string, name: string, status: "ready" | "missing-key" = "ready") {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user } });
  t.mock.module("@/lib/consulting-hub/load", {
    namedExports: {
      isBoardMember: (candidate: { memberships: Array<{ active: boolean; role: string }> }) =>
        candidate.memberships.some((membership) => membership.active && ["BOARD", "OWNER"].includes(membership.role)),
      loadConsultingHub: async () => (status === "ready" ? { status, bundle } : { status }),
      findHubFile: (hub: HubBundle, fileId: string, fileName: string) => hub.manifest.files.find((file) => file.id === fileId && file.name === fileName),
    },
  });
  const { GET } = await import(`./route.ts?case=${Math.random()}`);
  return GET(new NextRequest(`http://localhost/admin/consulting/file/${id}/${name}`), { params: Promise.resolve({ id, name }) }) as Promise<Response>;
}

test("members who are not on the board get a 404, not the file", async (t) => {
  const res = await call(t, member("MEMBER"), "pdf1", "brief.pdf");
  assert.equal(res.status, 404);
});

test("a board member gets the exact bytes, inline, uncached", async (t) => {
  const res = await call(t, member("BOARD"), "pdf1", "brief.pdf");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition") ?? "", /^inline;/);
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(Buffer.from(await res.arrayBuffer()).toString(), "%PDF");
  assert.equal(res.headers.get("content-security-policy"), null);
});

test("hub HTML is served in a sandbox", async (t) => {
  const html = await call(t, member("OWNER"), "web1", "dash.html");
  assert.match(html.headers.get("content-security-policy") ?? "", /^sandbox allow-scripts/);
  assert.equal(Buffer.from(await html.arrayBuffer()).toString(), "<html>");
});

test("Office files download instead of opening", async (t) => {
  const docx = await call(t, member("BOARD"), "doc1", "plan.docx");
  assert.match(docx.headers.get("content-disposition") ?? "", /^attachment;/);
});

test("an id with the wrong name does not serve anything", async (t) => {
  assert.equal((await call(t, member("BOARD"), "pdf1", "other.pdf")).status, 404);
});

test("an unconfigured hub answers 503", async (t) => {
  assert.equal((await call(t, member("BOARD"), "pdf1", "brief.pdf", "missing-key")).status, 503);
});
