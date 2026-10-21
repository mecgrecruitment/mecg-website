import test from 'node:test';
import assert from 'node:assert/strict';
import { rewrite } from './design-tokens.mjs';

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
  assert.equal(classes('bg-red-50 text-red-800 text-[11px] rounded-2xl'), 'bg-danger-wash text-danger text-xs rounded-xl');
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
