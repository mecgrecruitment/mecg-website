// Pure helpers that turn the hub manifest into what the pages show: one entry
// per project folder (a folder with a README) or per loose document, and a
// plain-text search. Kept free of I/O so they can be tested with fixtures.
import type { HubDoc, HubFile, HubManifest } from "./format";
import { hubDocHref, hubFileHref } from "./paths";

export type HubEntry = {
  key: string;
  title: string;
  href: string;
  updated: string;
  lead: HubDoc | null;
  docs: HubDoc[];
  files: HubFile[];
};

// Folders whose README is a role brief or index, not a project of its own.
const NOT_PROJECT_FOLDERS = new Set(["board/consulting", "generated", "."]);

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

function projectFolders(manifest: HubManifest): Set<string> {
  return new Set(manifest.docs
    .filter((doc) => /(^|\/)README\.md$/i.test(doc.sourcePath) && !NOT_PROJECT_FOLDERS.has(doc.folder))
    .map((doc) => doc.folder));
}

function owningFolder(folder: string, projects: Set<string>): string | null {
  for (let current = folder; current && current !== "."; current = current.includes("/") ? current.slice(0, current.lastIndexOf("/")) : "") {
    if (projects.has(current)) return current;
  }
  return null;
}

export function hubEntries(manifest: HubManifest, sectionId: string): HubEntry[] {
  const projects = projectFolders(manifest);
  const entries = new Map<string, HubEntry>();
  const entryFor = (key: string, seed: () => HubEntry) => entries.get(key) ?? entries.set(key, seed()).get(key)!;
  for (const doc of manifest.docs.filter((item) => item.sectionId === sectionId)) {
    const owner = owningFolder(doc.folder, projects);
    if (!owner) {
      entries.set(`doc:${doc.slug}`, { key: `doc:${doc.slug}`, title: doc.title, href: hubDocHref(doc.slug), updated: doc.updated, lead: doc, docs: [], files: [] });
      continue;
    }
    const entry = entryFor(`folder:${owner}`, () => ({ key: `folder:${owner}`, title: owner, href: "", updated: "", lead: null, docs: [], files: [] }));
    const isLead = doc.folder === owner && /(^|\/)README\.md$/i.test(doc.sourcePath);
    if (isLead) {
      entry.lead = doc;
      entry.title = doc.title;
      entry.href = hubDocHref(doc.slug);
    } else {
      entry.docs.push(doc);
    }
    if (doc.updated > entry.updated) entry.updated = doc.updated;
  }
  for (const file of manifest.files.filter((item) => item.sectionId === sectionId)) {
    const owner = owningFolder(file.folder, projects);
    const entry = owner ? entries.get(`folder:${owner}`) : undefined;
    if (entry) entry.files.push(file);
    else entries.set(`file:${file.id}`, { key: `file:${file.id}`, title: file.name, href: hubFileHref(file.id, file.name), updated: "", lead: null, docs: [], files: [file] });
  }
  for (const entry of entries.values()) {
    entry.docs.sort(byTitle);
    entry.files.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
    // A folder whose README landed in another section still needs a link target.
    if (!entry.href) entry.href = entry.docs[0] ? hubDocHref(entry.docs[0].slug) : hubFileHref(entry.files[0].id, entry.files[0].name);
  }
  return [...entries.values()];
}

export function entryForDoc(manifest: HubManifest, doc: HubDoc): HubEntry | undefined {
  return hubEntries(manifest, doc.sectionId).find((entry) => entry.lead?.slug === doc.slug || entry.docs.some((item) => item.slug === doc.slug));
}

export type HubSearchResult =
  | { kind: "doc"; doc: HubDoc; snippet: string }
  | { kind: "file"; file: HubFile };

export function searchHub(manifest: HubManifest, query: string, limit = 60): HubSearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const docs = manifest.docs
    .map((doc) => {
      const title = doc.title.toLowerCase();
      const text = doc.text.toLowerCase();
      if (!words.every((word) => title.includes(word) || text.includes(word))) return null;
      const score = words.reduce((total, word) => total + (title.includes(word) ? 10 : 0) + Math.min(text.split(word).length - 1, 9), 0);
      return { doc, score, snippet: snippetFor(doc.text, words) };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .map(({ doc, snippet }): HubSearchResult => ({ kind: "doc", doc, snippet }));
  const files = manifest.files
    .filter((file) => words.every((word) => file.sourcePath.toLowerCase().includes(word)))
    .map((file): HubSearchResult => ({ kind: "file", file }));
  return [...docs, ...files].slice(0, limit);
}

function snippetFor(text: string, words: string[]): string {
  const lower = text.toLowerCase();
  const at = Math.max(0, Math.min(...words.map((word) => lower.indexOf(word)).filter((index) => index >= 0)));
  const start = Math.max(0, at - 80);
  const end = Math.min(text.length, at + 180);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

const KIND: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/html; charset=utf-8": "Web page",
  "image/png": "Image",
  "text/csv; charset=utf-8": "CSV",
};

export function fileKind(file: HubFile): string {
  return KIND[file.mime] ?? "File";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUpdated(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
