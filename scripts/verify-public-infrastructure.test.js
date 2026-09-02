import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDnsName, verifyClerkDns } from "./verify-public-infrastructure.mjs";

test("DNS names normalize case and the absolute-name suffix", () => {
  assert.equal(normalizeDnsName("Frontend-API.Clerk.Services."), "frontend-api.clerk.services");
});

test("public infrastructure accepts the complete Clerk CNAME contract", async () => {
  const expected = new Map([
    ["clerk.mecgmichigan.com", "frontend-api.clerk.services"],
    ["accounts.mecgmichigan.com", "accounts.clerk.services"],
    ["clkmail.mecgmichigan.com", "mail.j9fyrp9lip0l.clerk.services"],
    ["clk._domainkey.mecgmichigan.com", "dkim1.j9fyrp9lip0l.clerk.services"],
    ["clk2._domainkey.mecgmichigan.com", "dkim2.j9fyrp9lip0l.clerk.services"],
  ]);
  await verifyClerkDns(async (host) => [`${expected.get(host)}.`]);
});

test("public infrastructure reports unresolved Clerk records", async () => {
  await assert.rejects(
    verifyClerkDns(async () => { throw Object.assign(new Error("missing"), { code: "ENOTFOUND" }); }),
    /clerk\.mecgmichigan\.com: ENOTFOUND/u,
  );
});
