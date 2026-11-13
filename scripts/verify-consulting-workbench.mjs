// Real client component in a tiny isolated Next app. No checkout copy, secrets,
// live auth or client data. API responses are explicit transport fixtures.
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const parent = path.join(homedir(), 'scratch/mecg/consulting-build'); await mkdir(parent, {recursive:true});
const scratch = await mkdtemp(path.join(parent, 'ui-'));
const socket = createServer(); await new Promise(r => socket.listen(0,'127.0.0.1',r)); const address = socket.address(); if (!address || typeof address === 'string') throw new Error('No port'); const port = address.port; await new Promise(r => socket.close(r));
let child; let browser;
try {
  await mkdir(path.join(scratch,'app'));
  await symlink(path.join(root,'node_modules'), path.join(scratch,'node_modules'),'dir');
  await writeFile(path.join(scratch,'package.json'),JSON.stringify({private:true,scripts:{dev:'next dev'},dependencies:{next:'16.3.8',react:'19.2.8','react-dom':'19.2.8'}}));
  await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','esnext'],jsx:'react-jsx',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,strict:true,skipLibCheck:true,noEmit:true,paths:{'@/*':[path.join(root,'src/*')]}}}));
  await writeFile(path.join(scratch,'next.config.mjs'),`export default {experimental:{externalDir:true},devIndicators:false,webpack(config){config.resolve.alias['@']=${JSON.stringify(path.join(root,'src'))};return config;}};`);
  await writeFile(path.join(scratch,'postcss.config.mjs'),`export default {plugins:{'@tailwindcss/postcss':{}}};`);
  const identity = path.join(root,'src/app/identity.css'); const identityImport = await access(identity).then(()=>`@import ${JSON.stringify(identity)};`).catch(()=>'');
  await writeFile(path.join(scratch,'app/style.css'),`@import ${JSON.stringify(path.join(root,'src/app/globals.css'))};\n${identityImport}\n@source ${JSON.stringify(path.join(root,'src'))};`);
  await writeFile(path.join(scratch,'app/layout.tsx'),`import './style.css'; import {display} from ${JSON.stringify(path.join(root,'src/app/fonts/display'))}; export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body className={display.variable}>{children}</body></html>}`);
  await writeFile(path.join(scratch,'app/page.tsx'),`import Workbench from ${JSON.stringify(path.join(root,'src/app/member/consulting/workbench'))}; export default function Page(){return <main className="workspace-stack mx-auto flex max-w-6xl flex-col p-5"><h1 className="text-2xl">Consulting workbench · isolated synthetic test</h1><Workbench userId="synthetic-member" cycleId="synthetic-cycle"/></main>}`);
  // Deliberately allowlist child environment: no account/provider credentials.
  child = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)], {cwd:scratch,env:{PATH:process.env.PATH,HOME:homedir(),NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  let logs=''; for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-15000)});
  const base=`http://127.0.0.1:${port}`;let ready=false;
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(logs);try{const r=await fetch(base,{signal:AbortSignal.timeout(4000)});if(r.ok){ready=true;break}}catch{}await setTimeout(400)}
  if(!ready)throw new Error(`Harness unavailable: ${logs}`);
  browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  console.log('Harness ready; exercising workflows');
  await page.goto(base);await page.getByRole('button',{name:'Load synthetic case',exact:true}).click();
  for(const title of ['Research & competitors','Customer feedback','Document questions','Process mapping','Business reporting','Proposal preparation','Discovery & scope','Deliverable review','Project handoff']){
    await page.getByRole('button',{name:title,exact:false}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.getByRole('button',{name:'Run evidence checks',exact:true}).click();await page.getByRole('heading',{name:'Working output',exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`Mobile overflow: ${title}`);await page.setViewportSize({width:1440,height:1000});
  }
  console.log('Nine workflows rendered at desktop and phone widths');
  // Correct the seeded reconciliation error through the real form.
  await page.getByRole('button',{name:'Business reporting',exact:false}).click();await page.getByLabel('Independent control total',{exact:true}).fill('30');await page.getByRole('button',{name:'Run evidence checks',exact:true}).click();await page.getByRole('heading',{name:'Ready for human review',exact:true}).waitFor();
  console.log('Seeded reconciliation corrected');
  // Save/restart/restore, then check member/cycle-bound local state is recoverable.
  await page.getByText('Save or restore a draft on this browser',{exact:true}).click();await page.getByRole('checkbox',{name:'I understand this is public/synthetic data saved on this device.'}).check();await page.getByRole('button',{name:'Save browser draft',exact:true}).click();await page.reload();await page.getByText('Save or restore a draft on this browser',{exact:true}).click();await page.getByRole('button',{name:'Restore browser draft',exact:true}).click();await page.getByLabel('Project title',{exact:true}).waitFor();if(await page.getByLabel('Project title',{exact:true}).inputValue()!=='Synthetic service study')throw new Error('Restore failed');
  console.log('Browser draft survived reload');
  // Export then corrupt-import without losing the open project.
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export project JSON',exact:true}).click();const download=await downloaded;const exported=JSON.parse(await readFile(await download.path(),'utf8'));if(exported.records.metrics[0].expected!=='30')throw new Error('Export lost correction');
  await page.getByLabel('Import project JSON',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"dataClass":"confidential"}')});await page.getByRole('alert').filter({hasText:'Confidential data is not supported'}).waitFor();if(await page.getByLabel('Project title',{exact:true}).inputValue()!=='Synthetic service study')throw new Error('Bad import changed project');
  await page.getByLabel('Import project JSON',{exact:true}).setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  console.log('Project JSON exported and re-imported');
  // Optional provider unavailable state is real UX, not a fabricated model run.
  await page.route('**/api/member/consulting',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Model assistance is not configured.'})}));await page.getByRole('checkbox',{name:'This is public/synthetic material I may send to the configured provider.'}).check();await page.getByRole('button',{name:'Request model suggestions',exact:true}).click();await page.getByRole('alert').filter({hasText:'not configured'}).waitFor();
  console.log('Unavailable-provider state rendered');
  await page.unroute('**/api/member/consulting');
  await page.getByRole('button',{name:'Discovery & scope',exact:false}).click();
  const proposed={...exported.records.requirements[0],id:'MODEL-R1',state:'confirmed',confirmation:'model must not assert this'};
  await page.route('**/api/member/consulting',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions:{summary:'Synthetic transport fixture — not a live model.',tables:[{table:'requirements',rows:[proposed]}]},model:'synthetic-fixture'})}));await page.getByRole('button',{name:'Request model suggestions',exact:true}).click();
  
  // Title uses the catalogue's ampersand.
  const suggestion=page.locator('details').filter({has:page.locator('summary').filter({hasText:'MODEL-R1'})}).last();await suggestion.locator('summary').click();await suggestion.getByRole('button',{name:'Add draft row',exact:true}).click();
  const lastDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export project JSON',exact:true}).click();const latest=JSON.parse(await readFile(await (await lastDownload).path(),'utf8'));const draft=latest.records.requirements.find(r=>r.id==='MODEL-R1');if(draft?.state!=='proposed'||draft.confirmation!=='')throw new Error('Model forged confirmation');
  await page.getByRole('button',{name:'Customer feedback',exact:false}).click();
  const feedback=page.getByRole('region',{name:'Feedback records',exact:true});
  await feedback.getByLabel('Import feedback records CSV',{exact:true}).setInputFiles({name:'bulk.csv',mimeType:'text/csv',buffer:Buffer.from('text,segment\n"Bulk wait, needs help",new\n')});
  await feedback.getByRole('status').filter({hasText:'Imported 1 rows'}).waitFor();
  await feedback.getByLabel('Search feedback records',{exact:true}).fill('Bulk wait');
  await feedback.getByText('1 matching rows.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Run evidence checks',exact:true}).click();
  await page.getByText('Deduplicated English denominator: 3.',{exact:false}).waitFor();
  await feedback.getByLabel('Import feedback records CSV',{exact:true}).setInputFiles({name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from('id,text\nF1,do not overwrite\n')});
  await feedback.getByRole('status').filter({hasText:'unique ID'}).waitFor();
  await page.getByRole('button',{name:'Undo last edit',exact:true}).click();
  await feedback.getByLabel('Search feedback records',{exact:true}).fill('');
  const undoDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export project JSON',exact:true}).click();
  const afterUndo=JSON.parse(await readFile(await (await undoDownload).path(),'utf8'));
  if(afterUndo.records.feedback.length!==3)throw new Error('Undo failed to restore pre-import feedback');
  await page.getByRole('button',{name:'Deliverable review',exact:false}).click();
  await page.getByLabel('Report text',{exact:false}).fill('[[claim:C1]] TODO: finish');
  await page.getByRole('button',{name:'Run evidence checks',exact:true}).click();
  await page.getByText('Unfinished placeholder text remains in the deliverable.',{exact:true}).first().waitFor();
  await page.getByText('24 hours [C1; S1;', {exact:false}).first().waitFor();
  console.log('PASS: bulk CSV, atomic duplicate rejection, filtered rows included in checks, undo, source-bound claims and unfinished-draft detection');
  await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'docs/features/consulting-workbench/mobile.png'),fullPage:false});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(root,'docs/features/consulting-workbench/desktop.png'),fullPage:false});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PASS: nine workflows, desktop/phone overflow, reconciliation correction, browser restart/restore, JSON roundtrip, invalid import recovery, unavailable-provider UX, reviewed model-row acceptance with confirmation stripped. No live auth, model, client data or hosted persistence tested.');
} catch(error) { await mkdir(path.join(root,'docs/features/consulting-workbench'),{recursive:true}); await writeFile(path.join(root,'docs/features/consulting-workbench/ui-failure.txt'),String(error)); throw error; } finally {await browser?.close();if(child){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited}await rm(scratch,{recursive:true,force:true})}
