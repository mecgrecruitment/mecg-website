// Authorized member-tools release. No client/member/recruitment data is imported.
// Existing pending optimizations are gated by full schema tests and an RLS
// equivalence proof in the workflow before this script can run.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const ref='chrxtsohxazngabdcpzb';
const allowed=['20261021120000','20261021130000','20261112120000'];
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token || !process.env.SUPABASE_DB_PASSWORD) throw new Error('Protected project credentials are required');
async function pending() {
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({query:'select version from supabase_migrations.schema_migrations order by version'}),
 });
 if(!response.ok) throw new Error(`Project ledger query failed: HTTP ${response.status}`);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.some(row=>typeof row.version!=='string')) throw new Error('Invalid project migration ledger');
 const remote=rows.map(row=>row.version);
 const local=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).map(name=>name.split('_')[0]);
 if(remote.some(version=>!local.includes(version))) throw new Error('Unreviewed remote migration history; stop rollout');
 const missing=local.filter(version=>!remote.includes(version));
 if(missing.some(version=>!allowed.includes(version))) throw new Error(`Unreviewed pending migrations: ${missing.join(',')}`);
 return missing;
}
const missing=await pending();
console.log('Reviewed pending migrations:',JSON.stringify(missing));
if(missing.length) {
 execFileSync('supabase',['link','--project-ref',ref],{stdio:'inherit'});
 execFileSync('supabase',['db','push','--linked','--dry-run'],{stdio:'inherit'});
 // Check the ledger again immediately before applying; do not accept new drift.
 await pending();
 execFileSync('supabase',['db','push','--linked','--yes'],{stdio:'inherit'});
}
if((await pending()).length) throw new Error('Migration rollout incomplete');
console.log('Live migration ledger parity OK; no access grants or member records created.');
