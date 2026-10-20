import assert from "node:assert/strict";
import test from "node:test";
import robots from "./robots";
import { PUBLIC_MARKETING_PATHS, SITE_URL } from "@/lib/seo";

test("robots permits public crawling and excludes account and token-bearing routes", () => {
  const result = robots();
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);
  assert.ok(!Array.isArray(result.rules));
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  assert.equal(rules?.userAgent, "*");
  assert.equal(rules?.allow, "/");
  assert.ok(Array.isArray(rules?.disallow));
  for (const path of ["/admin", "/member", "/applicant", "/apply", "/checkin", "/auth", "/api", "/login", "/sign-up", "/forgot-password", "/reset-password", "/access-denied"]) {
    assert.ok(rules.disallow.includes(path), `missing crawl exclusion: ${path}`);
  }
  for (const path of PUBLIC_MARKETING_PATHS) assert.ok(!rules.disallow.includes(path));
});

test("sitemap includes only public routes and the approved project loader's slugs", async (t) => {
  let approvedSlugs: string[] = [];
  t.mock.module("@/lib/projects/public-projects", {
    namedExports: { getPublicProjectSlugs: async () => approvedSlugs },
  });
  const { default: sitemap } = await import("./sitemap");
  const publicUrls = PUBLIC_MARKETING_PATHS.map((path) => `${SITE_URL}${path}`);
  assert.deepEqual((await sitemap()).map((entry) => entry.url), publicUrls);
  approvedSlugs = ["approved-example"];
  const entries = await sitemap();
  assert.deepEqual(entries.map((entry) => entry.url), [...publicUrls, `${SITE_URL}/work/approved-example`]);
  assert.ok(entries.every((entry) => !entry.lastModified), "do not invent content modification dates");
});
