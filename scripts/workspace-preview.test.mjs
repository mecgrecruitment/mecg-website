import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fixtureResponse } from './workspace-preview/fixtures.mjs';

test('workspace fixture is isolated, filters sample records, and rejects table writes', async () => {
  const server = createServer(fixtureResponse);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const one = await fetch(`${base}/rest/v1/applications?id=eq.preview-app-4`, { headers: { Accept: 'application/vnd.pgrst.object+json' } });
    assert.equal((await one.json()).pnms.name, 'Taylor Brooks');
    const rejected = await fetch(`${base}/rest/v1/applications`, { method: 'POST', body: '{}' });
    assert.equal(rejected.status, 405);
    const all = await fetch(`${base}/rest/v1/applications`);
    assert.equal((await all.json()).length, 6);
    const roster = await fetch(`${base}/rest/v1/rpc/group_case_roster_v2`, { method: 'POST' });
    assert.equal((await roster.json()).groups[0].applicants.length, 4);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
