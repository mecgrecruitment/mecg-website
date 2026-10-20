import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MARKETING_METADATA, ORGANIZATION_JSON_LD, PUBLIC_MARKETING_PATHS, PUBLIC_ROBOTS, ROOT_METADATA, SITE_URL, marketingBreadcrumbs, marketingMetadata } from "./seo";
import { serializeJsonLd } from "./json-ld";

// Importing the metadata module exercises the same objects exported by the
// layouts without loading Clerk, CSS, or rendering an authenticated page.
test("private routes default to noindex and marketing explicitly opts in", () => {
  assert.deepEqual(ROOT_METADATA.robots, { index: false, follow: false });
  assert.deepEqual(PUBLIC_ROBOTS, { index: true, follow: true });
  const root = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const marketing = readFileSync(new URL("../app/(marketing)/layout.tsx", import.meta.url), "utf8");
  assert.match(root, /export const metadata: Metadata = ROOT_METADATA/);
  assert.match(marketing, /export const metadata: Metadata = \{ robots: PUBLIC_ROBOTS \}/);
  assert.equal(ROOT_METADATA.alternates, undefined, "private routes must not inherit a public canonical");
});

test("every non-home marketing route supplies a complete page-specific social card", () => {
  for (const [route, metadata] of Object.entries(MARKETING_METADATA)) {
    const canonical = `${SITE_URL}/${route}`;
    assert.deepEqual(metadata.alternates, { canonical });
    assert.equal(metadata.openGraph?.title, `${metadata.title} | MECG`);
    assert.equal(metadata.openGraph?.description, metadata.description);
    assert.equal(metadata.openGraph?.url, canonical);
    assert.equal(metadata.openGraph?.siteName, ORGANIZATION_JSON_LD.name);
    assert.ok(metadata.openGraph && "type" in metadata.openGraph);
    assert.ok(metadata.twitter && "card" in metadata.twitter);
    assert.equal(metadata.twitter.card, "summary_large_image");
    assert.equal(metadata.twitter.description, metadata.description);
    assert.ok(metadata.openGraph.images);
    assert.ok(metadata.twitter.images);
    assert.deepEqual(metadata.robots, PUBLIC_ROBOTS);
    const page = readFileSync(new URL(`../app/(marketing)/${route}/page.tsx`, import.meta.url), "utf8");
    assert.ok(page.includes(`export const metadata: Metadata = MARKETING_METADATA.${route}`));
  }
  assert.deepEqual(PUBLIC_MARKETING_PATHS.filter((path) => path !== "/home").sort(), Object.keys(MARKETING_METADATA).map((route) => `/${route}`).sort());
});

test("case study canonical and social image identify the same approved project", () => {
  const metadata = marketingMetadata({
    title: "Example client question",
    description: "An approved decision statement.",
    path: "/work/example",
    image: "/work/example/opengraph-image",
  });
  assert.equal(metadata.alternates?.canonical, `${SITE_URL}/work/example`);
  assert.equal(metadata.openGraph?.url, `${SITE_URL}/work/example`);
  assert.deepEqual(metadata.openGraph?.images, [{
    url: `${SITE_URL}/work/example/opengraph-image`, width: 1200, height: 630, alt: "Example client question",
  }]);
  assert.deepEqual(metadata.twitter?.images, [{ url: `${SITE_URL}/work/example/opengraph-image`, alt: "Example client question" }]);
});

test("structured data uses canonical breadcrumbs and safely preserves approved text", () => {
  const title = "Client </script> question";
  const breadcrumbs = marketingBreadcrumbs([
    { name: "Home", path: "/home" },
    { name: "Client Services", path: "/work" },
    { name: title, path: "/work/example" },
  ]);
  assert.deepEqual(breadcrumbs.itemListElement.map((item) => [item.position, item.item]), [
    [1, `${SITE_URL}/home`], [2, `${SITE_URL}/work`], [3, `${SITE_URL}/work/example`],
  ]);
  const serialized = serializeJsonLd(breadcrumbs);
  assert.equal(serialized.includes("</script>"), false);
  assert.deepEqual(JSON.parse(serialized), breadcrumbs);
  assert.equal(ORGANIZATION_JSON_LD["@type"], "Organization");
  assert.equal(ORGANIZATION_JSON_LD.url, `${SITE_URL}/home`);
  assert.equal(ORGANIZATION_JSON_LD.email, "mecg-board@umich.edu");
});

test("colocated metadata files own generated image URLs when requested", () => {
  const metadata = marketingMetadata({ title: "Published case", description: "Approved description", path: "/work/published", image: null });
  assert.ok(metadata.openGraph && !("images" in metadata.openGraph));
  assert.ok(metadata.twitter && !("images" in metadata.twitter));
});
