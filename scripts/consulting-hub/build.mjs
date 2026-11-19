#!/usr/bin/env node
// Builds content/consulting-hub.enc from the MECG operations workspace.
//
//   CONSULTING_HUB_KEY=<base64 32 bytes> node scripts/consulting-hub/build.mjs [--source <ops repo>] [--key-file <path>]
//   node scripts/consulting-hub/build.mjs --new-key   # prints a fresh key
//
// What goes in, and how it is grouped, is read from <ops repo>/board/consulting/hub/hub.json
// so that no company or contact name ever appears in this public repository.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encryptHub, decryptHub, packHub, parseHubKey } from "../../src/lib/consulting-hub/format.ts";
import { isSafeExternal, renderMarkdown } from "../../src/lib/consulting-hub/render.ts";
import { HUB_ROOT, hubDocHref, hubFileHref } from "../../src/lib/consulting-hub/paths.ts";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

if (args.includes("--new-key")) {
  console.log(randomBytes(32).toString("base64"));
  process.exit(0);
}

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.resolve(flag("--source") ?? process.env.MECG_OPS_ROOT ?? "/home/rahil/.t3/projects/mecg");
const keyFile = flag("--key-file");
const key = parseHubKey(keyFile ? readFileSync(keyFile, "utf8") : process.env.CONSULTING_HUB_KEY);
if (!key) {
  console.error("Set CONSULTING_HUB_KEY or pass --key-file with a base64 32-byte key (generate one with --new-key).");
  process.exit(1);
}
const config = JSON.parse(readFileSync(path.join(sourceRoot, "board/consulting/hub/hub.json"), "utf8"));
const outputPath = path.join(siteRoot, "content/consulting-hub.enc");

const MIME = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".csv": "text/csv; charset=utf-8",
};
const INLINE = new Set([".pdf", ".png", ".html"]);

const toPosix = (value) => value.split(path.sep).join("/");
const matches = (relative, pattern) => path.matchesGlob(relative, pattern);

function walk(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.isFile()) found.push(toPosix(path.relative(sourceRoot, full)));
  }
  return found;
}

const docExtensions = new Set(config.documentExtensions);
const fileExtensions = new Set(config.fileExtensions);
const sectionFor = (relative) => config.sections.find((section) => section.paths.some((pattern) => matches(relative, pattern)))?.id;

const candidates = walk(sourceRoot).filter((relative) => {
  const extension = path.extname(relative).toLowerCase();
  if (!docExtensions.has(extension) && !fileExtensions.has(extension)) return false;
  if (config.includeExceptions.includes(relative)) return true;
  if (config.exclude.some((pattern) => matches(relative, pattern))) return false;
  return relative.startsWith("board/consulting/") || Boolean(sectionFor(relative));
});

const MORE = { id: "more", title: "Everything else", description: "Other consulting working files: loop logs, reviews and supporting notes." };

// Slugs drop the board/consulting/ prefix; anything from elsewhere in the workspace sits under related/.
function slugFor(relative) {
  const withoutExtension = relative.replace(/\.md$/i, "").toLowerCase();
  if (withoutExtension.startsWith("board/consulting/")) return withoutExtension.slice("board/consulting/".length);
  return `related/${withoutExtension.replace(/^board\//, "")}`;
}
const fileIdFor = (relative) => createHash("sha256").update(relative).digest("hex").slice(0, 16);

const docPaths = candidates.filter((relative) => docExtensions.has(path.extname(relative).toLowerCase()));
const filePaths = candidates.filter((relative) => fileExtensions.has(path.extname(relative).toLowerCase()));
const docBySource = new Map(docPaths.map((relative) => [relative, slugFor(relative)]));
const fileBySource = new Map(filePaths.map((relative) => [relative, { id: fileIdFor(relative), name: path.basename(relative) }]));
const GENERATED = { "hub:tasks": "tasks", "hub:decisions": "decisions" };

function resolverFor(fromRelative) {
  const baseDirectory = path.posix.dirname(fromRelative);
  return (rawHref) => {
    // Agents often write absolute file:// links with a line suffix (plan.md:65, #L7-L13).
    const href = rawHref.trim().replace(/^file:\/\//i, "");
    if (GENERATED[href]) return { href: hubDocHref(GENERATED[href]), external: false };
    if (isSafeExternal(href)) return { href, external: true };
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
    const [pathPart, ...hashParts] = href.split("#");
    const rawHash = hashParts.join("#");
    const hash = rawHash && !/^L\d/.test(rawHash) ? `#${rawHash}` : "";
    let decoded;
    try {
      decoded = decodeURIComponent(pathPart.split("?")[0]).replace(/:\d+(?::\d+)?$/, "");
    } catch {
      return null;
    }
    let target;
    if (decoded.startsWith("/")) {
      if (!decoded.startsWith(`${sourceRoot}/`)) return null;
      target = decoded.slice(sourceRoot.length + 1);
    } else {
      target = path.posix.normalize(path.posix.join(baseDirectory, decoded));
    }
    target = target.replace(/\/$/, "");
    if (target.startsWith("..")) return null;
    if (target === config.decisions.file) return { href: hubDocHref("decisions"), external: false };
    if (target === config.tasks.csv) return { href: hubDocHref("tasks"), external: false };
    const asReadme = `${target}/README.md`;
    if (docBySource.has(target)) return { href: `${hubDocHref(docBySource.get(target))}${hash}`, external: false };
    if (docBySource.has(asReadme)) return { href: `${hubDocHref(docBySource.get(asReadme))}${hash}`, external: false };
    const file = fileBySource.get(target);
    if (file) return { href: hubFileHref(file.id, file.name), external: false };
    return null;
  };
}

const updatedOn = (relative) => statSync(path.join(sourceRoot, relative)).mtime.toISOString().slice(0, 10);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const cell = (value) => (value ?? "").replace(/\s+/g, " ").replaceAll("|", "\\|").trim();
const linkPaths = (value) => cell(value).replace(/\b((?:board|operations|sources|templates)\/[\w./-]*[\w/])/g, (match) => `[${match}](${match})`);

function tasksMarkdown() {
  const [header, ...rows] = parseCsv(readFileSync(path.join(sourceRoot, config.tasks.csv), "utf8"));
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const roleMatch = new RegExp(config.tasks.roleMatch, "i");
  const relevant = rows.filter((row) => row.length > 1 && roleMatch.test(row[column.role] ?? ""));
  const done = (status) => /^(completed|deployed)/.test(status);
  const table = (list) => [
    "| ID | Task | Owner | Status | Done when | Result |",
    "| --- | --- | --- | --- | --- | --- |",
    ...list.map((row) => `| ${cell(row[column.id])} | ${cell(row[column.title])} | ${cell(row[column.owner])} | ${cell(row[column.status]).replaceAll("_", " ")} | ${cell(row[column.completion_check])} | ${linkPaths(row[column.result])} |`),
  ].join("\n");
  const open = relevant.filter((row) => !done(row[column.status]));
  const finished = relevant.filter((row) => done(row[column.status]));
  return [
    "# Consulting tasks",
    `Every row in operations/tasks.csv whose role includes consulting: ${relevant.length} tasks, ${open.length} still open. Status and owners are as recorded; "proposed" owners have not accepted.`,
    `## Open (${open.length})`, open.length ? table(open) : "None.",
    `## Done (${finished.length})`, finished.length ? table(finished) : "None.",
  ].join("\n\n");
}

function decisionsMarkdown() {
  const lines = readFileSync(path.join(sourceRoot, config.decisions.file), "utf8").split("\n");
  const match = new RegExp(config.decisions.match, "i");
  const tableHeader = lines.filter((line) => /^\| (Date|---)/.test(line)).slice(0, 2);
  const rows = lines.filter((line) => /^\| \d{4}-/.test(line) && match.test(line));
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("## ") || !match.test(lines[index])) continue;
    const block = [lines[index]];
    for (let next = index + 1; next < lines.length && !lines[next].startsWith("## ") && !lines[next].startsWith("| "); next += 1) block.push(lines[next]);
    sections.push(block.join("\n").trim());
  }
  return [
    "# Consulting decisions",
    "Confirmed decisions from operations/decisions.md that concern consulting, paid projects or client campaigns. Anything not listed here is still a proposal.",
    [...tableHeader, ...rows].join("\n"),
    ...sections.map((section) => section.replace(/^## /, "### ")),
  ].join("\n\n");
}

// The page header already shows the title, so drop a leading H1 from the body.
const withoutLeadingTitle = (html) => html.replace(/^<h1 id="[^"]*">[\s\S]*?<\/h1>\n/, "");

const docs = [];
for (const relative of docPaths) {
  const { html, title, text } = renderMarkdown(readFileSync(path.join(sourceRoot, relative), "utf8"), resolverFor(relative));
  docs.push({
    slug: docBySource.get(relative),
    title: title ?? path.basename(relative, ".md"),
    sectionId: sectionFor(relative) ?? MORE.id,
    folder: path.posix.dirname(relative),
    sourcePath: relative,
    updated: updatedOn(relative),
    html: withoutLeadingTitle(html),
    text: text.slice(0, 40000),
  });
}
for (const [slug, markdown, source, base] of [["tasks", tasksMarkdown(), config.tasks.csv, "README.md"], ["decisions", decisionsMarkdown(), config.decisions.file, config.decisions.file]]) {
  const { html, title, text } = renderMarkdown(markdown, resolverFor(base));
  docs.push({ slug, title: title ?? slug, sectionId: "start", folder: "generated", sourcePath: source, updated: updatedOn(source), html: withoutLeadingTitle(html), text });
}

const files = filePaths.map((relative) => {
  const extension = path.extname(relative).toLowerCase();
  return {
    id: fileBySource.get(relative).id,
    name: path.basename(relative),
    sectionId: sectionFor(relative) ?? MORE.id,
    folder: path.posix.dirname(relative),
    sourcePath: relative,
    mime: MIME[extension],
    inline: INLINE.has(extension),
    sandbox: extension === ".html",
  };
});

const overview = renderMarkdown(readFileSync(path.join(sourceRoot, config.overview), "utf8"), resolverFor(config.overview));
const usedSections = new Set([...docs, ...files].map((item) => item.sectionId));
const sections = [...config.sections.map(({ id, title, description }) => ({ id, title, description })), MORE].filter((section) => usedSections.has(section.id));

const container = packHub(
  { version: 1, title: config.title, generatedAt: new Date().toISOString(), overviewHtml: overview.html, sections, docs, files },
  filePaths.map((relative) => readFileSync(path.join(sourceRoot, relative))),
);
const encrypted = encryptHub(container, key);
// Prove the written file opens with the same key before replacing anything.
const check = decryptHub(encrypted, key);
if (check.manifest.docs.length !== docs.length || check.manifest.files.length !== files.length) throw new Error("Round-trip check failed");
if (!existsSync(path.dirname(outputPath))) mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, encrypted);

const unlinked = docs.reduce((count, doc) => count + (doc.html.match(/consulting-doc-unlinked/g) ?? []).length, 0);
console.log(JSON.stringify({
  output: path.relative(siteRoot, outputPath),
  root: HUB_ROOT,
  docs: docs.length,
  files: files.length,
  sections: sections.map((section) => `${section.id}:${docs.filter((doc) => doc.sectionId === section.id).length}+${files.filter((file) => file.sectionId === section.id).length}`),
  plaintextBytes: container.length,
  encryptedBytes: encrypted.length,
  linksNotInHub: unlinked,
}, null, 2));
