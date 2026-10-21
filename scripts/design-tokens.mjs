#!/usr/bin/env node
// Enforces the colour, radius and type tokens in docs/DESIGN.md §0.
// `node scripts/design-tokens.mjs` lists off-system classes and exits 1 when any remain.
// `node scripts/design-tokens.mjs --fix` rewrites every class that has a token equivalent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INTERACTIVE = /(^|:)(hover|focus|focus-visible|focus-within|active|group-hover|peer-hover|group-focus-within|group-focus-visible):$/;
const alpha = (s) => (s.startsWith('[') ? Number(s.slice(1, -1)) * 100 : Number(s));
// Inset-edge rgb values found in the codebase, mapped to the token that replaces them.
const INSET_COLOURS = {
  '7,13,31': 'navy', '255,255,255': 'white', '185,28,28': 'danger', '4,120,87': 'success', '180,83,9': 'warning',
  '63,99,175': 'mecg-blue', '38,91,174': 'mecg-blue', '254,144,77': 'mecg-orange', '168,62,11': 'mecg-orange-ink',
};
const between = (lo, hi) => (s) => { const a = alpha(s); return a >= lo && a <= hi; };

// Each rule: a utility pattern (variants excluded) and the token it becomes.
// `to` receives the regex match and the variant prefix; returning null keeps the class.
export const RULES = [
  { why: 'secondary text is one token; navy under 60% fails 4.5:1', re: /^text-mecg-navy\/([\d.[\]]+)$/,
    to: (m, v) => { const a = alpha(m[1]); if (a < 45) return null; if (a >= 80) return 'text-mecg-navy'; return INTERACTIVE.test(v) ? 'text-mecg-navy' : 'text-muted'; } },
  { why: 'public-muted and workspace muted were the same colour', re: /^text-public-muted$/, to: () => 'text-muted' },
  { why: 'secondary text on dark surfaces is white/70', re: /^text-white\/([\d.[\]]+)$/,
    to: (m) => { const a = alpha(m[1]); if (a < 50) return null; return a >= 80 ? 'text-white' : 'text-white/70'; } },
  { why: 'one hairline', re: /^(border(?:-[trblxy])?|divide)-mecg-navy\/([\d.[\]]+)$/,
    to: (m) => { const a = alpha(m[2]); if (a >= 5 && a <= 15) return `${m[1]}-line`; if (a > 15 && a <= 30) return `${m[1]}-line-strong`; return null; } },
  { why: 'edges are inset rings in token colours, not raw rgba shadows', re: /^shadow-\[inset_0_0_0_([12])px_rgba?\((\d+),(\d+),(\d+)(?:,(0?\.\d+))?\)\]$/,
    to: (m, v) => {
      const width = m[1] === '2' ? 'inset-ring-2' : 'inset-ring';
      const a = m[5] === undefined ? 100 : Number(m[5]) * 100;
      const colour = INSET_COLOURS[`${m[2]},${m[3]},${m[4]}`];
      if (!colour) return null;
      if (colour === 'navy') {
        if (INTERACTIVE.test(v) && a >= 24) return `${width} ${v}inset-ring-mecg-navy/40`;
        return `${width} ${v}inset-ring-${a <= 12 ? 'line' : 'line-strong'}`;
      }
      const step = a >= 90 ? '' : `/${[10, 15, 20, 30, 40, 80].reduce((b, x) => (Math.abs(x - a) < Math.abs(b - a) ? x : b))}`;
      return `${width} ${v}inset-ring-${colour}${step}`;
    } },
  { why: 'one elevation for cards, one for popovers', re: /^shadow-\[0_(\d+)px_(\d+)px(?:_-?\d+px)?_rgba?\((?:7,13,31,|18_33_62\/|4_14_40\/)(0?\.\d+)\)\]$/,
    to: (m, v) => { const y = Number(m[1]); if (y <= 2) return 'shadow-xs'; return INTERACTIVE.test(v) || Number(m[3]) >= 0.14 && y < 20 ? 'shadow-pop' : 'shadow-lift'; } },
  { why: 'one neutral wash', re: /^bg-mecg-navy\/([\d.[\]]+)$/, to: (m) => (between(2, 6)(m[1]) ? 'bg-wash' : between(7, 10)(m[1]) ? 'bg-mecg-navy/10' : null) },
  { why: 'one blue tint', re: /^bg-mecg-blue\/([\d.[\]]+)$/, to: (m) => (between(6, 12)(m[1]) ? 'bg-mecg-blue/10' : null) },
  { why: 'one orange tint', re: /^bg-mecg-orange\/([\d.[\]]+)$/, to: (m) => (between(9, 17)(m[1]) ? 'bg-mecg-orange/15' : null) },
  { why: 'one translucent fill on dark', re: /^bg-white\/([\d.[\]]+)$/, to: (m) => (between(5, 11)(m[1]) ? 'bg-white/10' : null) },
  { why: 'one translucent rule on dark', re: /^border(-[trblxy])?-white\/(20|\[0\.2\])$/, to: (m) => `border${m[1] ?? ''}-white/15` },
  { why: 'status roles, not Tailwind shades', re: /^text-(red|rose)-(700|800|900|950)$/, to: () => 'text-danger' },
  { why: 'status roles, not Tailwind shades', re: /^text-(emerald|green)-(700|800|900|950)$/, to: () => 'text-success' },
  { why: 'status roles, not Tailwind shades', re: /^text-amber-(800|900|950)$/, to: () => 'text-warning' },
  { why: 'status roles, not Tailwind shades', re: /^bg-(red|rose)-(50|100)$/, to: () => 'bg-danger-wash' },
  { why: 'status roles, not Tailwind shades', re: /^bg-(emerald|green)-(50|100)(\/\d+)?$/, to: () => 'bg-success-wash' },
  { why: 'status roles, not Tailwind shades', re: /^bg-amber-(50|100)$/, to: () => 'bg-warning-wash' },
  { why: 'status roles, not Tailwind shades', re: /^bg-(red|rose)-(700|800)$/, to: () => 'bg-danger' },
  { why: 'status roles, not Tailwind shades', re: /^bg-(emerald|green)-(700|800)$/, to: () => 'bg-success' },
  { why: 'status roles, not Tailwind shades', re: /^border-amber-300$/, to: () => 'border-warning-edge' },
  { why: 'panels are 12px; 16px was off the scale', re: /^rounded(-[trblse]{1,2})?-2xl$/, to: (m) => `rounded${m[1] ?? ''}-xl` },
  { why: 'nothing below 12px', re: /^text-\[(10|11|11\.5|12)px\]$/, to: () => 'text-xs' },
  { why: 'half-pixel type steps', re: /^text-\[12\.5px\]$/, to: () => 'text-[13px]' },
  { why: 'text-[14px] is text-sm', re: /^text-\[14px\]$/, to: () => 'text-sm' },
];

// Classes that have no token equivalent yet and should not grow. Reported, never rewritten.
export const FLAGS = [
  { why: 'raw colour in an arbitrary value; add a token in globals.css', re: /^(?:bg|text|border|ring|fill|stroke|outline)-\[(?:#|rgb|hsl|oklch)/ },
  { why: 'raw rgba box-shadow; use inset-ring-line, inset-ring-line-strong or shadow-lift/pop', re: /^shadow-\[[^\]]*rgba?\(/ },
];

const CLASS = /(?<=^|[\s"'`{])((?:[a-z0-9\-@[\]&_=.\/]+:)*)(-?[a-z][\w\-./[\]%(),#]*)(?=$|[\s"'`}])/gm;

export function rewrite(source) {
  const changes = [];
  const flags = [];
  const out = source.replace(CLASS, (whole, variants, util) => {
    for (const rule of RULES) {
      const m = util.match(rule.re);
      if (!m) continue;
      const next = rule.to(m, variants);
      if (next && next !== util) { changes.push({ from: whole, to: variants + next, why: rule.why }); return variants + next; }
      return whole;
    }
    for (const flag of FLAGS) if (flag.re.test(util)) flags.push({ cls: whole, why: flag.why });
    return whole;
  });
  return { out, changes, flags };
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const fix = process.argv.includes('--fix');
  let pending = 0;
  let flagged = 0;
  const byWhy = new Map();
  for (const file of walk(path.join(root, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const { out, changes, flags } = rewrite(source);
    const rel = path.relative(root, file);
    for (const c of changes) byWhy.set(c.why, (byWhy.get(c.why) ?? 0) + 1);
    if (fix && out !== source) fs.writeFileSync(file, out);
    if (!fix) for (const c of changes) console.log(`${rel}: ${c.from} → ${c.to} (${c.why})`);
    for (const f of flags) console.log(`${rel}: ${f.cls} (${f.why})`);
    pending += changes.length;
    flagged += flags.length;
  }
  for (const [why, n] of byWhy) console.error(`${fix ? 'rewrote' : 'off-system'} ${n}× ${why}`);
  console.error(`${fix ? 'Rewrote' : 'Found'} ${pending} off-system classes; ${flagged} raw colour values flagged.`);
  if (!fix && pending + flagged > 0) process.exitCode = 1;
}
