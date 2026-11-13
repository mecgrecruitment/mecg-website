// Automated UI exercise using an isolated source copy and fictional read-only
// preview. API receipts are intercepted; this does not prove hosted persistence.
import { mkdtemp, mkdir, cp, symlink, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../',import.meta.url));
const parent = path.join(homedir(),'scratch/mecg');
await mkdir(parent,{recursive:true});
const scratch = await mkdtemp(path.join(parent,'member-tools-ui-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0,'127.0.0.1',resolve));
const address = socket.address(); if (!address || typeof address === 'string') throw new Error('No port');
const port = address.port; await new Promise(resolve => socket.close(resolve));
let child; let browser;
try {
  for (const name of ['src','public','scripts','package.json','tsconfig.json','postcss.config.mjs','next-env.d.ts']) await cp(path.join(root,name),path.join(scratch,name),{recursive:true});
  await symlink(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
  child = spawn(process.execPath,['scripts/preview-workspaces.mjs'],{cwd:scratch,env:{...process.env,WORKSPACE_PREVIEW_PORT:String(port)},stdio:['ignore','ignore','pipe']});
  let errors = ''; child.stderr.on('data',data => { errors = (errors + data).slice(-6000); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i=0;i<90;i++) {
    if (child.exitCode !== null) throw new Error(`Preview exited: ${errors}`);
    try { const response = await fetch(`${base}/member/tools/pipeline`,{signal:AbortSignal.timeout(3000)}); if(response.ok){ready=true;break;} } catch {}
    await setTimeout(500);
  }
  if (!ready) throw new Error(`Preview not ready: ${errors}`);
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  for (const tool of ['pipeline','evidence','lab']) {
    await page.goto(`${base}/member/tools/${tool}`);
    await page.getByRole('heading',{name:tool==='pipeline'?'Client & sponsor pipeline':tool==='evidence'?'Project evidence library':'AI consulting lab',exact:true}).waitFor();
    await page.getByText('No records yet.',{exact:false}).waitFor();
    await page.setViewportSize({width:390,height:844});
    if (await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)) throw new Error(`Mobile overflow: ${tool}`);
    if(tool==='lab') { await page.getByText('Open the case pack and submission guide').click(); await page.getByText('EX-01 · Travel guide',{exact:false}).waitFor(); }
    await page.setViewportSize({width:1440,height:1000});
  }
  await page.goto(`${base}/member/tools/pipeline`);
  await page.getByLabel('Company or organization',{exact:true}).fill('Synthetic UI opportunity');
  await page.getByLabel('Opportunity type · Required',{exact:true}).selectOption('Client');
  await page.getByLabel('Stage · Required',{exact:true}).selectOption('Research');
  await page.getByLabel('Business problem or support ask',{exact:false}).fill('Test only');
  await page.getByLabel('Source link',{exact:true}).fill('https://example.com');
  await page.getByLabel('Next action',{exact:true}).fill('Confirm fit');
  await page.route('**/api/member/tools',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Record changed. Reload before saving.'})}));
  await page.getByRole('button',{name:'Add opportunity',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Record changed.'}).waitFor();
  if(await page.getByLabel('Company or organization',{exact:true}).inputValue()!=='Synthetic UI opportunity') throw new Error('Error discarded form');
  await page.unroute('**/api/member/tools');
  await page.route('**/api/member/tools',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})}));
  await page.getByRole('button',{name:'Add opportunity',exact:true}).click();
  await page.getByText('Saved privately.',{exact:false}).waitFor();
  console.log('PASS: three rendered routes, desktop/mobile layout, synthetic case, form entry, conflict feedback, retained values and confirmed-save state. API receipts simulated; database persistence tested separately.');
} finally {
  await browser?.close();
  if(child && child.exitCode === null && child.signalCode === null) { const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited; }
  await rm(scratch,{recursive:true,force:true});
}
