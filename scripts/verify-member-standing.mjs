// Isolated PostgreSQL behavior proof, with minimal identity/membership fixtures.
// Does not connect to Supabase or establish hosted Clerk integration.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
const name = `mecg-member-standing-proof-${process.pid}`;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', stdio: input ? ['pipe','pipe','pipe'] : 'pipe' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker failed');
  return result.stdout;
}
try {
  docker(['run','--name',name,'--network','none','--memory','256m','--cpus','0.5','-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:17-alpine']);
  let ready = false;
  // The image restarts the server once after initdb, so a single successful
  // probe can be the temporary server. Wait for three in a row.
  for (let i = 0, streak = 0; i < 60 && !ready; i++) {
    const ok = spawnSync('docker',['exec',name,'psql','-U','postgres','-tAc','select 1'],{stdio:'ignore'}).status === 0;
    streak = ok ? streak + 1 : 0;
    ready = streak >= 3;
    if (!ready) await setTimeout(500);
  }
  if (!ready) throw new Error('Postgres did not become ready');
  for (const file of ['scripts/member-standing/bootstrap.sql','supabase/migrations/20261118070000_member_standing.sql','scripts/member-standing/assertions.sql']) {
    const output = docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
    if (file.endsWith('assertions.sql')) console.log(output.slice(-1000));
  }
} finally { spawnSync('docker',['rm','-f',name],{stdio:'ignore'}); }
