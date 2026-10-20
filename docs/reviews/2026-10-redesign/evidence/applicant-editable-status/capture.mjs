import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const publicShell = await (await fetch(`${base}/home`)).text();
const styles = [...publicShell.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(([tag]) => tag).join('');
assert.ok(styles, 'Current local Next stylesheet links must be available');
const bodyClass = publicShell.match(/<body[^>]*class="([^"]*)"/)?.[1] ?? '';
const browser = await chromium.launch();
const results = [];
for (const [size, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  let fixtureDocument = '';
  await page.route(`${base}/apply/test-harness/applicant-status-proof*`, (route) => route.fulfill({ contentType: 'text/html', body: fixtureDocument }));
  for (const name of ['draft-open', 'needs_info-open', 'draft-closed', 'needs_info-closed']) {
    const fixture = await readFile(`.audit/applicant-editable-status/fixtures/${name}.html`, 'utf8');
    fixtureDocument = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${base}">${styles}</head><body class="${bodyClass}">${fixture}</body></html>`;
    await page.goto(`${base}/apply/test-harness/applicant-status-proof?fixture=${name}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const styled = await page.locator('main').evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(styled, 'rgba(0, 0, 0, 0)', 'Current local CSS must style the real PortalShell');
    const heading = await page.locator('h1').textContent();
    assert.equal(heading, name.startsWith('draft') ? 'Your application is a draft.' : 'Your application needs changes.');
    assert.equal(await page.locator('section').first().locator('ol').count(), 0, 'Pre-review hero must have no fake pipeline steps');
    const action = page.locator('section[aria-labelledby="next-action-heading"]');
    if (name.endsWith('open')) assert.equal(await action.locator('a').getAttribute('href'), '/apply');
    else { assert.equal(await action.locator('a').getAttribute('href'), 'mailto:mecg-board@umich.edu'); assert.equal(await page.locator('a[href="/apply"]').count(), 0); }
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noOverflow, `${name}/${size} must not overflow horizontally`);
    await page.screenshot({ path: `.audit/applicant-editable-status/${name}-${size}.png`, fullPage: true });
    results.push({ fixture: name, viewport, heading, nextAction: await action.innerText(), noHorizontalOverflow: noOverflow, heroPipelineSteps: 0 });
  }
  await page.close();
}
await browser.close();
await writeFile('.audit/applicant-editable-status/visual-results.json', JSON.stringify({ scope: 'Actual server-rendered dashboard and PortalShell with synthetic own-RPC fixtures; image framework adapter and interactive child stubs; current local CSS; no authenticated/provider journey', results }, null, 2));
console.log(`PASS ${results.length} synthetic SSR layout captures and status/action checks`);
