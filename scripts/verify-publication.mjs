// Build once against a local public-RPC fixture, then publish and withdraw a
// synthetic case without rebuilding. Never contacts a real Supabase project.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { once } from "node:events";

const root = resolve(import.meta.dirname, "..");
const work = await mkdtemp(join(tmpdir(), "mecg-publication-proof-"));
await mkdir(join(root, ".audit"), { recursive: true });
const log = [];
let projects = [];
const fixture = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url?.endsWith("/rpc/public_projects")) res.end(JSON.stringify(projects));
  else if (req.url?.includes("/rpc/")) res.end("{}");
  else { res.statusCode = 404; res.end('{}'); }
});
await new Promise((done) => fixture.listen(0, "127.0.0.1", done));
const address = fixture.address();
if (!address || typeof address === "string") throw new Error("Fixture port unavailable");
const cleanEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: tmpdir(),
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-publication-fixture",
  E2E_LOCAL_HTTP: "1",
};
let server;
const next = join(root, "node_modules/next/dist/bin/next");
function run(args) {
  const child = spawn(process.execPath, [next, ...args], { cwd: work, env: cleanEnv, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => log.push(chunk.toString()));
  return child;
}
function attribute(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]?.replaceAll("&amp;", "&");
}
function metadata(html, key) {
  const tags = html.match(/<meta\b[^>]*>/g) ?? [];
  return tags.filter((tag) => attribute(tag, "property") === key || attribute(tag, "name") === key).map((tag) => attribute(tag, "content"));
}
try {
  for (const directory of ["src", "public"]) await cp(join(root, directory), join(work, directory), { recursive: true });
  for (const name of ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) await cp(join(root, name), join(work, name));
  await symlink(join(root, "node_modules"), join(work, "node_modules"), "dir");
  const build = run(["build", "--webpack"]);
  const [buildExit] = await once(build, "exit");
  assert.equal(buildExit, 0, "isolated production build must pass");
  // Port 0 lets the OS choose an unused local port; parse the ready server's URL.
  server = run(["start", "--hostname", "127.0.0.1", "--port", "0"]);
  let base;
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Production server did not become ready")), 30000);
    server.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { base = match[0]; clearTimeout(timer); done(); }
    });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Production server exited early")); });
  });
  // A production artifact must not expose fictional private-workspace fixtures.
  for (const route of ["/apply/test-harness/reading", "/apply/test-harness/usability", "/apply/test-harness/screening"]) {
    const response = await fetch(`${base}${route}`, { redirect: "manual" });
    // Next can stream a notFound() boundary with HTTP 200 after headers flush.
    // Verify the rendered boundary and absence of fixture content as well.
    assert.ok([200, 404].includes(response.status), `${route} must render its unavailable boundary`);
    const html = await response.text();
    assert.match(html, /This page does not exist/, `${route} must show the unavailable page`);
    assert.doesNotMatch(html, /Fictional Board application|Fictional usability checks|Synthetic screening verification|data-application-harness-ready/, `${route} must not expose fixture content`);
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200, "the configured synthetic public RPC must support production startup and health checks");
  const path = "/work/synthetic-publication-proof";
  // Publication boundary is empty when the production build is made.
  projects = [{
    slug: "synthetic-publication-proof", title: "Synthetic publication proof",
    clientLabel: "Synthetic fixture only", industry: "Test fixture", semester: "Test cycle",
    decision: "Can a reviewed project publish without a rebuild?", context: "No real client is represented.",
    methods: ["Synthetic method"], deliverables: ["Synthetic handoff"], constraints: [], memberWork: [],
  }];
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, "a newly published slug must render after build");
  const html = await response.text();
  assert.match(html, /Synthetic publication proof/);
  for (const key of ["og:image", "twitter:image"]) {
    const urls = metadata(html, key);
    assert.equal(urls.length, 1, `${key} must resolve to one unambiguous image`);
    assert.ok(urls[0]?.includes(path), `${key} must use this project's generated image route; received ${JSON.stringify(urls)}`);
    const url = new URL(urls[0]);
    const image = await fetch(`${base}${url.pathname}${url.search}`);
    assert.equal(image.status, 200, `${key}'s actual generated URL must exist`);
    assert.match(image.headers.get("content-type") ?? "", /image\/png/);
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${key} must render a real PNG`);
  }
  projects = [];
  const withdrawn = await fetch(`${base}${path}`);
  assert.equal(withdrawn.status, 404, "withdrawn publication must stop rendering without a rebuild");
  const result = { status: "passed", buildInitialProjects: 0, publishedWithoutRebuild: true, imagesRendered: ["og:image", "twitter:image"], withdrawnWithoutRebuild: true, testHarnessesHidden: true, configuredStartupHealthy: true };
  console.log(JSON.stringify(result, null, 2));
  await writeFile(join(root, ".audit/publication-proof-result.json"), JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  await writeFile(join(root, ".audit/publication-proof-failure.log"), log.join(""));
  throw error;
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  fixture.closeAllConnections();
  await new Promise((done) => fixture.close(done));
  await rm(work, { recursive: true, force: true });
}
