// Markdown to HTML for the consulting hub. Runs only in the build script
// (scripts/consulting-hub/build.mjs), never in the app, so `marked` stays a
// dev dependency. The output is later set with dangerouslySetInnerHTML, so raw
// HTML in the source is escaped and every link goes through `resolve`.
import { Marked, type Tokens } from "marked";

export type ResolvedLink = { href: string; external: boolean };
export type LinkResolver = (href: string) => ResolvedLink | null;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "section";
}

// Only web, mail and in-page links survive; anything else (javascript:, data:,
// file paths outside the hub) must be resolved to a hub URL or dropped.
export function isSafeExternal(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

export function renderMarkdown(source: string, resolve: LinkResolver): { html: string; title: string | null; text: string } {
  const usedIds = new Map<string, number>();
  let title: string | null = null;
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text);
      },
      heading({ tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1 && title === null) title = text.replace(/[*_`]/g, "").trim();
        const base = headingId(inner);
        const seen = usedIds.get(base) ?? 0;
        usedIds.set(base, seen + 1);
        const id = seen ? `${base}-${seen}` : base;
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title: linkTitle, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const target = href.startsWith("#") ? { href, external: false } : resolve(href);
        if (!target) return `<span class="consulting-doc-unlinked" title="Not in the hub">${inner}</span>`;
        const titleAttr = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : "";
        const externalAttrs = target.external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(target.href)}"${titleAttr}${externalAttrs}>${inner}</a>`;
      },
      image({ href, text }: Tokens.Image) {
        const target = resolve(href);
        if (!target || target.external) return escapeHtml(text);
        return `<img src="${escapeHtml(target.href)}" alt="${escapeHtml(text)}" loading="lazy">`;
      },
    },
  });
  const rendered = marked.parse(source) as string;
  const html = rendered
    .replaceAll("<table>", '<div class="consulting-doc-table"><table>')
    .replaceAll("</table>", "</table></div>");
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { html, title, text };
}
