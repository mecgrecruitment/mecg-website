import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCss, rewrite } from './design-tokens.mjs';

const classes = (s) => rewrite(`<p className="${s}" />`).out.match(/className="([^"]*)"/)[1];

test('secondary text below the contrast floor becomes the muted token', () => {
  assert.equal(classes('text-mecg-navy/55 sm:text-mecg-navy/70'), 'text-muted sm:text-muted');
});

test('a hover step on secondary text darkens to ink instead of collapsing', () => {
  assert.equal(classes('text-mecg-navy/60 hover:text-mecg-navy/75'), 'text-muted hover:text-mecg-navy');
});

test('raw navy inset shadows become token inset rings', () => {
  assert.equal(classes('shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]'), 'inset-ring inset-ring-line');
  assert.equal(classes('focus:shadow-[inset_0_0_0_1px_rgba(7,13,31,0.28)]'), 'focus:inset-ring focus:inset-ring-mecg-navy/40');
});

test('status shades map to roles and type under 12px is raised', () => {
  assert.equal(classes('bg-red-50 text-red-800 text-[11px] text-[0.65rem] rounded-2xl'), 'bg-danger-wash text-danger text-xs text-xs rounded-xl');
});

test('raw colours without a token are flagged, not rewritten', () => {
  const { out, flags } = rewrite('<p className="bg-[#123456]" />');
  assert.match(out, /bg-\[#123456\]/);
  assert.equal(flags.length, 1);
});

test('classes already on the system are left alone', () => {
  const src = '<p className="text-muted inset-ring inset-ring-line bg-wash rounded-xl text-mecg-navy/35" />';
  assert.deepEqual(rewrite(src).changes, []);
});

test('arbitrary tracking snaps to display, heading or label', () => {
  assert.equal(classes('tracking-[-0.045em] tracking-[-0.01em] tracking-[0.14em]'), 'tracking-display tracking-heading tracking-label');
});

test('CSS rules read colours through tokens; definitions, masks and marked lines pass', () => {
  const css = [
    ':root { --x: #123456; }',
    '.a { color: rgb(7 13 31 / 60%); }',
    '.b { mask-image: radial-gradient(rgb(0 0 0 / 50%), transparent); }',
    '.c { background: hsl(var(--hue) 90% 60%); /* raw: confetti */ }',
    '.d { letter-spacing: -0.04em; }',
  ].join('\n');
  const { out, flags } = checkCss(css);
  assert.deepEqual(flags.map((f) => f.line), [2]);
  assert.match(out, /letter-spacing: var\(--tracking-display\)/);
});

test('odd type steps round up onto 12, 14, 16, 18', () => {
  assert.equal(classes('text-[12.5px] text-[13px] text-[15px] text-[17px]'), 'text-sm text-sm text-base text-lg');
});

test('public ink is navy', () => {
  assert.equal(classes('text-public-ink hover:text-public-ink/80'), 'text-mecg-navy hover:text-mecg-navy/80');
});

test('spacing half steps round up to the 4px rhythm; 0.5 and sizes stay', () => {
  assert.equal(classes('px-2.5 -mt-1.5 gap-x-3.5 p-[18px] mt-0.5 h-1.5 size-3.5'), 'px-3 -mt-2 gap-x-4 p-5 mt-0.5 h-1.5 size-3.5');
});

test('CSS font sizes read the type scale and spacing rounds up to 4px', () => {
  const { out } = checkCss('.a { font-size: 13px; padding: 2px 10px; gap: 6px; margin: 0 auto; color: var(--color-public-ink); }\n.b { font-size: 0.8125rem; font-size: 24px; }');
  assert.equal(out, '.a { font-size: var(--text-sm); padding: 2px 12px; gap: 8px; margin: 0 auto; color: var(--color-mecg-navy); }\n.b { font-size: var(--text-sm); font-size: 24px; }');
});
