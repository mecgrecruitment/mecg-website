import { cp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';


const root = fileURLToPath(new URL('../', import.meta.url));
const preview = path.join(root, '.audit/workspace-preview-app');
const port = Number(process.env.WORKSPACE_PREVIEW_PORT ?? 3010);
const { fixtureResponse } = await import('./workspace-preview/fixtures.mjs');
const fixture = createServer(fixtureResponse);
await new Promise((resolve, reject) => { fixture.once('error', reject); fixture.listen(0, '127.0.0.1', resolve); });
const address = fixture.address();
if (!address || typeof address === 'string') throw new Error('Fixture port unavailable');
const fixtureUrl = `http://127.0.0.1:${address.port}`;
await mkdir(preview, { recursive: true });
await rm(path.join(preview, 'src'), { recursive: true, force: true });
await cp(path.join(root, 'src'), path.join(preview, 'src'), { recursive: true });
for (const name of ['package.json', 'tsconfig.json', 'postcss.config.mjs', 'next-env.d.ts']) await cp(path.join(root, name), path.join(preview, name));
for (const name of ['node_modules', 'public']) {
  try { await symlink(path.join(root, name), path.join(preview, name), 'dir'); } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
await writeFile(path.join(preview, 'next.config.ts'), `import type { NextConfig } from 'next';\nconst config: NextConfig = { experimental: { globalNotFound: true }, serverExternalPackages: ['pdfjs-dist'], turbopack: { root: ${JSON.stringify(root)} } };\nexport default config;\n`);
for (const [template, target] of [['auth.txt', 'src/lib/auth.ts'], ['proxy.txt', 'src/proxy.ts'], ['navigation.txt', 'src/components/preview-navigation.tsx']]) {
  await writeFile(path.join(preview, target), await readFile(path.join(root, 'scripts/workspace-preview', template)));
}
let layout = await readFile(path.join(preview, 'src/app/layout.tsx'), 'utf8');
layout = `import PreviewNavigation from '@/components/preview-navigation';\n${layout}`;
layout = layout.replace('{children}\n    </>', '<PreviewNavigation />{children}\n    </>');
await writeFile(path.join(preview, 'src/app/layout.tsx'), layout);
const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|CLERK|RESEND|TWILIO/.test(key)));
const env = { ...safeEnv, NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-preview-placeholder', SUPABASE_SERVICE_ROLE_KEY: 'local-preview-placeholder', NEXT_PUBLIC_MECG_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY: 'local-preview-placeholder', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '', CLERK_SECRET_KEY: '', E2E_LOCAL_HTTP: '1', PLAYWRIGHT_APPLICATION_HARNESS: '1' };
console.log(`Read-only workspace preview: http://localhost:${port}/admin`);
console.log('Isolated source copy and fictional data. All API writes are blocked.');
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port', String(port), '--hostname', '127.0.0.1'], { cwd: preview, env, stdio: 'inherit' });
const stop = () => { child.kill('SIGTERM'); fixture.close(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.once('exit', code => { fixture.close(); process.exitCode = code ?? 0; });
